"""
Smart UX Analyzer – Production-Grade AI-Powered UI/UX Analysis Engine
=======================================================================
FastAPI backend with:
  • Google PageSpeed Insights v5 API (real performance/SEO/accessibility)
  • Async concurrent fetching (HTML + PSI in parallel)
  • Claude AI-generated suggestions (Anthropic)
  • Smart UX heuristic scoring (CTA, nav, headings, readability)
  • Weighted final scoring: 50% PSI + 30% HTML/SEO + 20% UX
  • TTL in-memory cache (5 min) to avoid duplicate API calls
  • SQLite persistence with core_web_vitals column
  • JWT auth, PDF export, user profiles/settings

Run:
    ./venv/bin/uvicorn main:app --reload --host 0.0.0.0 --port 8000
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import sqlite3
import time
import uuid
from datetime import datetime, timedelta, timezone
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional

from dotenv import load_dotenv

load_dotenv()

# ── Third-party imports ───────────────────────────────────────────────────────
from jose import JWTError, jwt as jose_jwt
import bcrypt as _bcrypt

import httpx
import requests
from bs4 import BeautifulSoup
from cachetools import TTLCache

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field, HttpUrl

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

# ──────────────────────────────────────────────────────────────────────────────
# Config / Logging
# ──────────────────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
)
logger = logging.getLogger("smart_ux_analyzer")

# ── Environment variables ─────────────────────────────────────────────────────
PAGESPEED_API_KEY: str = os.getenv("PAGESPEED_API_KEY", "")
ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
SECRET_KEY: str = os.getenv("SECRET_KEY", "smart-ux-analyzer-jwt-secret-change-in-production-2024")
GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7

# ── Tuning constants ──────────────────────────────────────────────────────────
REQUEST_TIMEOUT_SECONDS = 15
PAGESPEED_TIMEOUT_SECONDS = 30
USER_AGENT = "Mozilla/5.0 (compatible; SmartUXAnalyzer/2.0; +https://smart-ux-analyzer.vercel.app)"

SLOW_RESPONSE_THRESHOLD = 2.0
VERY_SLOW_RESPONSE_THRESHOLD = 4.0
IDEAL_TITLE_MIN = 50
IDEAL_TITLE_MAX = 60
TOO_MANY_LINKS = 100
EXCESSIVE_LINKS = 200

CTA_KEYWORDS = (
    "buy", "sign up", "signup", "get started", "subscribe", "download",
    "try", "start", "join", "order", "book", "contact", "learn more",
    "add to cart", "shop", "register", "free trial", "get started",
    "request demo", "book demo", "watch demo", "see pricing",
)

PAGESPEED_API_URL = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"

# ── TTL cache: keyed by URL, expires after 5 minutes ─────────────────────────
_psi_cache: TTLCache = TTLCache(maxsize=200, ttl=300)

# ──────────────────────────────────────────────────────────────────────────────
# SQLite Database
# ──────────────────────────────────────────────────────────────────────────────

DB_PATH = Path(__file__).parent / "ux_analyzer.db"


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS reports (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id         TEXT    NOT NULL DEFAULT 'guest',
                url             TEXT    NOT NULL,
                ux_score        INTEGER NOT NULL,
                accessibility   INTEGER NOT NULL,
                performance     INTEGER NOT NULL,
                seo             INTEGER NOT NULL,
                suggestions     TEXT    NOT NULL,
                core_web_vitals TEXT    NOT NULL DEFAULT '{}',
                created_at      TEXT    NOT NULL
            )
        """)
        # migrate: add core_web_vitals column if it doesn't exist yet
        try:
            conn.execute("ALTER TABLE reports ADD COLUMN core_web_vitals TEXT NOT NULL DEFAULT '{}'")
        except sqlite3.OperationalError:
            pass

        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id         TEXT PRIMARY KEY,
                name       TEXT NOT NULL DEFAULT '',
                email      TEXT NOT NULL DEFAULT '',
                phone      TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS user_settings (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id       TEXT UNIQUE NOT NULL,
                dark_mode     INTEGER NOT NULL DEFAULT 1,
                auto_analysis INTEGER NOT NULL DEFAULT 0,
                data_sharing  INTEGER NOT NULL DEFAULT 0,
                created_at    TEXT NOT NULL,
                updated_at    TEXT NOT NULL
            )
        """)
        for col in ("auto_analysis", "data_sharing"):
            try:
                conn.execute(f"ALTER TABLE user_settings ADD COLUMN {col} INTEGER NOT NULL DEFAULT 0")
            except sqlite3.OperationalError:
                pass

        conn.execute("""
            CREATE TABLE IF NOT EXISTS auth_users (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                name          TEXT    NOT NULL DEFAULT '',
                email         TEXT    UNIQUE NOT NULL,
                password_hash TEXT,
                google_id     TEXT,
                profile_image TEXT,
                created_at    TEXT    NOT NULL
            )
        """)
        conn.commit()
    logger.info("✅ Database initialised at %s", DB_PATH)


init_db()

# ──────────────────────────────────────────────────────────────────────────────
# Auth: JWT + Password Hashing
# ──────────────────────────────────────────────────────────────────────────────

bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return _bcrypt.hashpw(password.encode(), _bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False


def create_access_token(user_id: int, email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    payload = {"sub": str(user_id), "email": email, "exp": expire}
    return jose_jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        return jose_jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None


def get_auth_user_from_token(token: str) -> Optional[Dict[str, Any]]:
    payload = decode_token(token)
    if not payload:
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    with get_db() as conn:
        row = conn.execute(
            "SELECT id, name, email, profile_image, created_at FROM auth_users WHERE id = ?",
            (int(user_id),),
        ).fetchone()
    return dict(row) if row else None


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> Dict[str, Any]:
    if not credentials:
        raise HTTPException(status_code=401, detail="Authentication required.")
    user = get_auth_user_from_token(credentials.credentials)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
    return user


# ──────────────────────────────────────────────────────────────────────────────
# Pydantic Models
# ──────────────────────────────────────────────────────────────────────────────

# ── Auth Models ───────────────────────────────────────────────────────────────

class UserRegister(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: str = Field(..., min_length=3)
    password: str = Field(..., min_length=6)


class UserLogin(BaseModel):
    email: str
    password: str


class SocialLogin(BaseModel):
    name: str
    email: str
    google_id: Optional[str] = None
    profile_image: Optional[str] = None


class AuthUserResponse(BaseModel):
    id: int
    name: str
    email: str
    profile_image: Optional[str] = None
    created_at: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: AuthUserResponse


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=6)


# ── Analyze Models ────────────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    url: HttpUrl = Field(..., description="Full URL of the website to analyze")
    user_id: str = Field(default="guest", description="User ID for report ownership")


class Suggestion(BaseModel):
    title: str
    description: str
    priority: Literal["High", "Medium", "Low"]


class CoreWebVitals(BaseModel):
    lcp: Optional[str] = None   # Largest Contentful Paint
    fcp: Optional[str] = None   # First Contentful Paint
    cls: Optional[str] = None   # Cumulative Layout Shift
    tbt: Optional[str] = None   # Total Blocking Time
    ttfb: Optional[str] = None  # Time to First Byte
    speed_index: Optional[str] = None


class AnalyzeResponse(BaseModel):
    id: int
    url: str
    ux_score: int = Field(..., ge=0, le=100)
    accessibility: int = Field(..., ge=0, le=100)
    performance: int = Field(..., ge=0, le=100)
    seo: int = Field(..., ge=0, le=100)
    core_web_vitals: CoreWebVitals = Field(default_factory=CoreWebVitals)
    suggestions: List[Suggestion]
    data_source: str = "html_only"  # "pagespeed" | "html_only"
    created_at: str


class ReportListItem(BaseModel):
    id: int
    user_id: str
    url: str
    ux_score: int
    accessibility: int
    performance: int
    seo: int
    core_web_vitals: CoreWebVitals = Field(default_factory=CoreWebVitals)
    suggestions: List[Suggestion]
    created_at: str


class UserProfile(BaseModel):
    id: str
    name: str = ""
    email: str = ""
    phone: str = ""
    created_at: str = ""


class UserProfileUpdate(BaseModel):
    name: str = ""
    email: str = ""
    phone: str = ""


class SettingsUpdate(BaseModel):
    user_id: str
    dark_mode: bool = True
    auto_analysis: bool = False
    data_sharing: bool = False


class SettingsResponse(BaseModel):
    user_id: str
    dark_mode: bool
    auto_analysis: bool
    data_sharing: bool


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _clamp(value: float, lo: int = 0, hi: int = 100) -> int:
    return max(lo, min(hi, round(value)))


# ──────────────────────────────────────────────────────────────────────────────
# 1. HTML Fetch  (sync, runs in thread pool via asyncio.to_thread)
# ──────────────────────────────────────────────────────────────────────────────

def _fetch_html_sync(url: str) -> dict:
    """Synchronous HTML fetch — call via asyncio.to_thread()."""
    headers = {"User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.9"}
    start = time.perf_counter()
    try:
        response = requests.get(
            url, headers=headers, timeout=REQUEST_TIMEOUT_SECONDS, allow_redirects=True
        )
    except requests.exceptions.Timeout:
        logger.warning("Timeout fetching %s", url)
        raise HTTPException(status_code=504, detail=f"Timed out while fetching {url}.")
    except requests.exceptions.MissingSchema:
        raise HTTPException(
            status_code=400,
            detail=f"'{url}' is not a valid URL. Include the scheme, e.g. https://example.com",
        )
    except requests.exceptions.ConnectionError:
        raise HTTPException(
            status_code=502,
            detail=f"Could not connect to {url}. The site may be down or blocking requests.",
        )
    except requests.exceptions.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch {url}: {exc}")

    elapsed = time.perf_counter() - start

    if response.status_code in (403, 999):
        raise HTTPException(
            status_code=403,
            detail=f"{url} is blocking automated requests (HTTP {response.status_code}).",
        )
    if response.status_code == 404:
        raise HTTPException(status_code=404, detail=f"{url} returned 404 Not Found.")
    if response.status_code >= 500:
        raise HTTPException(
            status_code=502, detail=f"{url} returned a server error (HTTP {response.status_code})."
        )
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"{url} returned HTTP {response.status_code}.")

    return {"html": response.text, "status_code": response.status_code, "response_time": elapsed}


# ──────────────────────────────────────────────────────────────────────────────
# 2. Google PageSpeed Insights API  (async)
# ──────────────────────────────────────────────────────────────────────────────

async def _call_pagespeed(client: httpx.AsyncClient, url: str, strategy: str) -> dict:
    """Call PSI API for a single strategy. Returns raw JSON or {}."""
    params: dict = {
        "url": url,
        "strategy": strategy,
        "category": ["performance", "seo", "accessibility", "best-practices"],
    }
    if PAGESPEED_API_KEY:
        params["key"] = PAGESPEED_API_KEY

    try:
        r = await client.get(
            PAGESPEED_API_URL,
            params=params,
            timeout=PAGESPEED_TIMEOUT_SECONDS,
        )
        r.raise_for_status()
        return r.json()
    except Exception as exc:
        logger.warning("PageSpeed %s call failed for %s: %s", strategy, url, exc)
        return {}


def _extract_metric_display(audits: dict, audit_id: str) -> Optional[str]:
    """Safely extract the displayValue string for a given audit."""
    audit = audits.get(audit_id, {})
    return audit.get("displayValue") or audit.get("numericValue") and f"{audit['numericValue']:.0f}"


def _parse_psi_response(mobile_data: dict, desktop_data: dict) -> dict:
    """
    Parse both PSI responses and return a unified dict with:
    - scores: performance, seo, accessibility, best_practices (0-100)
    - core_web_vitals: lcp, fcp, cls, tbt, ttfb, speed_index
    Averages mobile + desktop for a balanced score.
    """
    result = {
        "performance": None,
        "seo": None,
        "accessibility": None,
        "best_practices": None,
        "core_web_vitals": {},
        "available": False,
    }

    def _extract_scores(data: dict) -> dict:
        cats = data.get("lighthouseResult", {}).get("categories", {})
        return {
            "performance": round((cats.get("performance", {}).get("score") or 0) * 100),
            "seo": round((cats.get("seo", {}).get("score") or 0) * 100),
            "accessibility": round((cats.get("accessibility", {}).get("score") or 0) * 100),
            "best_practices": round((cats.get("best-practices", {}).get("score") or 0) * 100),
        }

    mobile_scores = _extract_scores(mobile_data) if mobile_data else {}
    desktop_scores = _extract_scores(desktop_data) if desktop_data else {}

    if not mobile_scores and not desktop_scores:
        return result

    result["available"] = True

    # Average mobile + desktop (mobile weighted slightly more: 60/40)
    def _avg(key: str) -> Optional[int]:
        m = mobile_scores.get(key)
        d = desktop_scores.get(key)
        if m is not None and d is not None:
            return round(m * 0.6 + d * 0.4)
        return m or d

    result["performance"] = _avg("performance")
    result["seo"] = _avg("seo")
    result["accessibility"] = _avg("accessibility")
    result["best_practices"] = _avg("best_practices")

    # Core Web Vitals from mobile (primary) or desktop fallback
    audits_mobile = mobile_data.get("lighthouseResult", {}).get("audits", {})
    audits_desktop = desktop_data.get("lighthouseResult", {}).get("audits", {})
    audits = audits_mobile or audits_desktop

    result["core_web_vitals"] = {
        "lcp": _extract_metric_display(audits, "largest-contentful-paint"),
        "fcp": _extract_metric_display(audits, "first-contentful-paint"),
        "cls": _extract_metric_display(audits, "cumulative-layout-shift"),
        "tbt": _extract_metric_display(audits, "total-blocking-time"),
        "ttfb": _extract_metric_display(audits, "server-response-time"),
        "speed_index": _extract_metric_display(audits, "speed-index"),
    }

    return result


async def fetch_pagespeed(url: str) -> dict:
    """
    Fetch PageSpeed Insights for both mobile and desktop concurrently.
    Results are cached for 5 minutes per URL.
    Returns parsed result dict (or dict with available=False on failure).
    """
    cache_key = f"psi:{url}"
    if cache_key in _psi_cache:
        logger.info("PSI cache hit for %s", url)
        return _psi_cache[cache_key]

    if not PAGESPEED_API_KEY:
        logger.warning(
            "PAGESPEED_API_KEY not set — skipping real performance data. "
            "Set it in backend/.env to enable Lighthouse scores."
        )

    async with httpx.AsyncClient(follow_redirects=True) as client:
        mobile_task = _call_pagespeed(client, url, "mobile")
        desktop_task = _call_pagespeed(client, url, "desktop")
        mobile_data, desktop_data = await asyncio.gather(mobile_task, desktop_task)

    parsed = _parse_psi_response(mobile_data, desktop_data)
    if parsed["available"]:
        _psi_cache[cache_key] = parsed
    return parsed


# ──────────────────────────────────────────────────────────────────────────────
# 3. HTML Parsing
# ──────────────────────────────────────────────────────────────────────────────

def parse_html(html: str) -> dict:
    soup = BeautifulSoup(html, "lxml")

    title_tag = soup.find("title")
    title = title_tag.get_text(strip=True) if title_tag else ""

    meta_desc_tag = soup.find("meta", attrs={"name": "description"})
    meta_description = (meta_desc_tag.get("content") or "").strip() if meta_desc_tag else ""

    og_title = soup.find("meta", property="og:title")
    og_description = soup.find("meta", property="og:description")
    canonical = soup.find("link", rel="canonical")
    robots = soup.find("meta", attrs={"name": "robots"})

    viewport_tag = soup.find("meta", attrs={"name": "viewport"})

    images = soup.find_all("img")
    num_images = len(images)
    num_images_missing_alt = sum(1 for img in images if not img.get("alt", "").strip())

    links = soup.find_all("a")
    buttons = soup.find_all("button")

    cta_count = 0
    for el in list(links) + list(buttons):
        text = el.get_text(strip=True).lower()
        if any(kw in text for kw in CTA_KEYWORDS):
            cta_count += 1

    body = soup.find("body")
    body_text = body.get_text(separator=" ", strip=True) if body else ""
    words = body_text.split()
    word_count = len(words)

    # Heading hierarchy analysis
    headings = {f"h{i}": len(soup.find_all(f"h{i}")) for i in range(1, 7)}

    # Nav landmark detection
    nav_elements = len(soup.find_all("nav"))
    has_main_landmark = bool(soup.find("main"))
    has_footer = bool(soup.find("footer"))
    has_header = bool(soup.find("header"))

    # Skip navigation link
    skip_links = [a for a in links if "skip" in (a.get("href", "") + a.get_text("")).lower()]

    # Form analysis
    forms = soup.find_all("form")
    inputs_missing_label = 0
    for inp in soup.find_all("input"):
        inp_id = inp.get("id", "")
        inp_type = inp.get("type", "text")
        if inp_type in ("submit", "button", "hidden", "image"):
            continue
        if not inp_id or not soup.find("label", attrs={"for": inp_id}):
            inputs_missing_label += 1

    # Schema / structured data
    has_schema = bool(soup.find("script", type="application/ld+json"))

    # Paragraph / content structure
    paragraphs = soup.find_all("p")

    return {
        "title": title,
        "title_length": len(title),
        "meta_description": meta_description,
        "meta_description_length": len(meta_description),
        "has_meta_description": bool(meta_description),
        "has_og_tags": bool(og_title or og_description),
        "has_canonical": bool(canonical),
        "has_robots_meta": bool(robots),
        "has_schema": has_schema,
        "num_images": num_images,
        "num_images_missing_alt": num_images_missing_alt,
        "num_links": len(links),
        "num_buttons": len(buttons),
        "num_cta_elements": cta_count,
        "h1_count": headings["h1"],
        "h2_count": headings["h2"],
        "h3_count": headings["h3"],
        "h4_count": headings["h4"],
        "has_viewport_meta": viewport_tag is not None,
        "word_count": word_count,
        "html_size_bytes": len(html.encode("utf-8")),
        "nav_elements": nav_elements,
        "has_main_landmark": has_main_landmark,
        "has_footer": has_footer,
        "has_header": has_header,
        "has_skip_links": len(skip_links) > 0,
        "num_forms": len(forms),
        "inputs_missing_label": inputs_missing_label,
        "num_paragraphs": len(paragraphs),
    }


# ──────────────────────────────────────────────────────────────────────────────
# 4. HTML/SEO Score  (30% of final)
# ──────────────────────────────────────────────────────────────────────────────

def _score_html_seo(data: dict) -> int:
    """
    Score SEO signals from HTML. Returns 0-100.
    """
    score = 100

    # Title (25 pts)
    if data["title_length"] == 0:
        score -= 25
    elif not (IDEAL_TITLE_MIN <= data["title_length"] <= IDEAL_TITLE_MAX):
        score -= 8

    # Meta description (20 pts)
    if not data["has_meta_description"]:
        score -= 20
    elif data["meta_description_length"] > 160:
        score -= 5

    # H1 (15 pts)
    if data["h1_count"] == 0:
        score -= 15
    elif data["h1_count"] > 1:
        score -= 5

    # OG tags (5 pts)
    if not data["has_og_tags"]:
        score -= 5

    # Canonical (5 pts)
    if not data["has_canonical"]:
        score -= 5

    # Schema markup (5 pts)
    if not data["has_schema"]:
        score -= 5

    # Image alt text (10 pts)
    if data["num_images"] > 0:
        missing_ratio = data["num_images_missing_alt"] / data["num_images"]
        score -= round(missing_ratio * 10)

    # Viewport meta (10 pts)
    if not data["has_viewport_meta"]:
        score -= 10

    return _clamp(score)


# ──────────────────────────────────────────────────────────────────────────────
# 5. UX Heuristic Score  (20% of final)
# ──────────────────────────────────────────────────────────────────────────────

def _score_ux_heuristics(data: dict, response_time: float) -> int:
    """
    Smart UX scoring based on real HTML signals.
    Replaces all hardcoded / static scores with signal-based evaluation.
    Returns 0-100.
    """
    score = 0

    # ── CTA Presence (0–25 pts) ───────────────────────────────────────────────
    cta = data["num_cta_elements"]
    if cta >= 3:
        score += 25
    elif cta == 2:
        score += 20
    elif cta == 1:
        score += 13
    else:
        score += 0  # No CTA is a major UX failure

    # ── Navigation Clarity (0–20 pts) ─────────────────────────────────────────
    nav_score = 0
    total_clickable = data["num_links"] + data["num_buttons"]

    if data["nav_elements"] >= 1:
        nav_score += 8
    if data["has_main_landmark"]:
        nav_score += 4
    if data["has_header"]:
        nav_score += 4
    if data["has_footer"]:
        nav_score += 4
    # Too many links hurts clarity
    if total_clickable > EXCESSIVE_LINKS:
        nav_score = max(0, nav_score - 10)
    elif total_clickable > TOO_MANY_LINKS:
        nav_score = max(0, nav_score - 5)
    score += min(20, nav_score)

    # ── Heading Hierarchy (0–20 pts) ──────────────────────────────────────────
    heading_score = 0
    if data["h1_count"] == 1:
        heading_score += 10  # Exactly one H1: ideal
    elif data["h1_count"] > 1:
        heading_score += 3   # Multiple H1s: poor
    if data["h2_count"] >= 2:
        heading_score += 6
    elif data["h2_count"] == 1:
        heading_score += 4
    if data["h3_count"] >= 1:
        heading_score += 4
    score += min(20, heading_score)

    # ── Content Structure (0–20 pts) ──────────────────────────────────────────
    content_score = 0
    if data["word_count"] >= 300:
        content_score += 10
    elif data["word_count"] >= 100:
        content_score += 6
    elif data["word_count"] >= 50:
        content_score += 2

    if data["num_paragraphs"] >= 5:
        content_score += 5
    elif data["num_paragraphs"] >= 2:
        content_score += 3

    if data["num_images"] >= 1:
        content_score += 5  # Visual content present
    score += min(20, content_score)

    # ── Readability / Accessibility signals (0–15 pts) ────────────────────────
    read_score = 0
    if data["has_skip_links"]:
        read_score += 5
    if data["inputs_missing_label"] == 0 and data["num_forms"] > 0:
        read_score += 5
    elif data["num_forms"] == 0:
        read_score += 3  # No forms → not penalised
    if data["num_images_missing_alt"] == 0:
        read_score += 5
    score += min(15, read_score)

    return _clamp(score)


# ──────────────────────────────────────────────────────────────────────────────
# 6. HTML-only Accessibility Score  (fallback when no PSI data)
# ──────────────────────────────────────────────────────────────────────────────

def _score_html_accessibility(data: dict) -> int:
    score = 100
    if data["num_images"] > 0:
        missing_ratio = data["num_images_missing_alt"] / data["num_images"]
        score -= round(missing_ratio * 40)
    if not data["has_viewport_meta"]:
        score -= 15
    if data["h1_count"] == 0 and data["h2_count"] == 0:
        score -= 10
    if data["inputs_missing_label"] > 0:
        score -= min(20, data["inputs_missing_label"] * 5)
    if not data["has_skip_links"] and data["nav_elements"] > 0:
        score -= 5
    return _clamp(score)


# ──────────────────────────────────────────────────────────────────────────────
# 7. Final Score Computation  (weighted merge)
# ──────────────────────────────────────────────────────────────────────────────

def calculate_scores(page_data: dict, psi: dict) -> dict:
    """
    Final weighted scoring:
      - PSI available : 50% PSI + 30% HTML/SEO + 20% UX heuristics
      - PSI unavailable: 50% HTML/SEO + 30% response-time performance + 20% UX
    """
    response_time = page_data.get("response_time", 0)
    html_seo = _score_html_seo(page_data)
    ux_heuristics = _score_ux_heuristics(page_data, response_time)

    if psi["available"]:
        performance = _clamp(psi["performance"] or 0)
        seo = _clamp(round(psi["seo"] * 0.5 + html_seo * 0.5))  # blend PSI + HTML signals
        accessibility = _clamp(psi["accessibility"] or 0)

        # UX score: 50% PSI performance + 30% HTML/SEO + 20% UX heuristics
        ux_score = _clamp(
            0.5 * performance + 0.3 * html_seo + 0.2 * ux_heuristics
        )
    else:
        # Fallback: HTML-only scoring
        html_accessibility = _score_html_accessibility(page_data)
        seo = html_seo

        # Performance from response time
        if response_time > VERY_SLOW_RESPONSE_THRESHOLD:
            performance = _clamp(100 - 40 - (page_data["html_size_bytes"] > 500_000) * 15)
        elif response_time > SLOW_RESPONSE_THRESHOLD:
            performance = _clamp(100 - 20 - (page_data["html_size_bytes"] > 500_000) * 15)
        else:
            performance = _clamp(80 - (page_data["html_size_bytes"] > 500_000) * 15)

        accessibility = html_accessibility

        ux_score = _clamp(
            0.35 * ux_heuristics + 0.25 * accessibility + 0.20 * performance + 0.20 * seo
        )

    return {
        "ux_score": ux_score,
        "accessibility": accessibility,
        "performance": performance,
        "seo": seo,
    }


# ──────────────────────────────────────────────────────────────────────────────
# 8. AI Suggestions via Claude  (async, falls back to rule-based)
# ──────────────────────────────────────────────────────────────────────────────

async def generate_ai_suggestions(
    url: str, page_data: dict, psi: dict, scores: dict
) -> List[Suggestion]:
    """
    Use Claude to generate contextual, actionable suggestions.
    Falls back to rule-based generation if ANTHROPIC_API_KEY is not set.
    """
    if not ANTHROPIC_API_KEY:
        logger.info("ANTHROPIC_API_KEY not set — using rule-based suggestions.")
        return _rule_based_suggestions(page_data, psi, scores)

    cwv = psi.get("core_web_vitals", {})
    prompt = f"""You are an expert UX engineer and web performance specialist.
Analyze the following real data for: {url}

SCORES:
- Performance: {scores['performance']}/100
- SEO: {scores['seo']}/100
- Accessibility: {scores['accessibility']}/100
- UX Score: {scores['ux_score']}/100

CORE WEB VITALS:
- LCP (Largest Contentful Paint): {cwv.get('lcp', 'N/A')}
- FCP (First Contentful Paint): {cwv.get('fcp', 'N/A')}
- CLS (Cumulative Layout Shift): {cwv.get('cls', 'N/A')}
- TBT (Total Blocking Time): {cwv.get('tbt', 'N/A')}
- TTFB (Time to First Byte): {cwv.get('ttfb', 'N/A')}

HTML STRUCTURE SIGNALS:
- Page title length: {page_data['title_length']} characters (ideal: 50-60)
- Has meta description: {page_data['has_meta_description']} (length: {page_data['meta_description_length']})
- H1 count: {page_data['h1_count']} (should be exactly 1)
- H2 count: {page_data['h2_count']}
- Images total: {page_data['num_images']}, missing alt: {page_data['num_images_missing_alt']}
- CTA elements found: {page_data['num_cta_elements']}
- Navigation elements: {page_data['nav_elements']}
- Has canonical URL: {page_data['has_canonical']}
- Has OG tags: {page_data['has_og_tags']}
- Has structured data (schema): {page_data['has_schema']}
- Word count: {page_data['word_count']}
- Forms: {page_data['num_forms']}, inputs missing labels: {page_data['inputs_missing_label']}
- Has skip navigation links: {page_data['has_skip_links']}

Generate exactly 6 specific, actionable improvement suggestions.
Return ONLY a valid JSON array (no other text) in this format:
[
  {{
    "title": "Short action title (max 8 words)",
    "description": "Specific, detailed explanation of the issue and how to fix it. Reference actual data above where relevant.",
    "priority": "High"
  }}
]
Priority must be exactly "High", "Medium", or "Low".
Order by priority: High first, then Medium, then Low.
Do NOT include generic advice. Base every suggestion on the actual data provided."""

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": "claude-3-haiku-20240307",
                    "max_tokens": 1024,
                    "messages": [{"role": "user", "content": prompt}],
                },
                timeout=30,
            )
            response.raise_for_status()
            content = response.json()["content"][0]["text"].strip()

            # Parse JSON array from Claude's response
            start_idx = content.find("[")
            end_idx = content.rfind("]") + 1
            if start_idx == -1 or end_idx == 0:
                raise ValueError("No JSON array found in Claude response")

            suggestions_raw = json.loads(content[start_idx:end_idx])
            suggestions = []
            for s in suggestions_raw[:8]:
                priority = s.get("priority", "Medium")
                if priority not in ("High", "Medium", "Low"):
                    priority = "Medium"
                suggestions.append(Suggestion(
                    title=s.get("title", "Improvement needed"),
                    description=s.get("description", ""),
                    priority=priority,
                ))
            logger.info("✅ Claude generated %d suggestions for %s", len(suggestions), url)
            return suggestions

    except Exception as exc:
        logger.warning("Claude suggestion generation failed: %s — falling back to rule-based", exc)
        return _rule_based_suggestions(page_data, psi, scores)


def _rule_based_suggestions(page_data: dict, psi: dict, scores: dict) -> List[Suggestion]:
    """
    Improved rule-based suggestions — contextual and non-static.
    Used as fallback when Claude is unavailable.
    """
    suggestions: List[Suggestion] = []
    cwv = psi.get("core_web_vitals", {}) if psi else {}

    # Performance / Core Web Vitals
    if scores["performance"] < 50:
        lcp_val = cwv.get("lcp", "unknown")
        suggestions.append(Suggestion(
            title="Critical: Fix poor page performance",
            description=f"Performance score is {scores['performance']}/100. LCP is {lcp_val} — aim for under 2.5s. Optimize images (use WebP/AVIF), enable compression, and defer non-critical JS.",
            priority="High",
        ))
    elif scores["performance"] < 75:
        suggestions.append(Suggestion(
            title="Improve page load performance",
            description=f"Performance score is {scores['performance']}/100. Use lazy loading, minify CSS/JS, and consider a CDN to improve Core Web Vitals.",
            priority="Medium",
        ))

    if cwv.get("cls") and cwv["cls"] not in ("0", "0.00", "0 "):
        suggestions.append(Suggestion(
            title="Fix layout shift (CLS)",
            description=f"Cumulative Layout Shift is {cwv['cls']} — above the 0.1 threshold. Reserve space for images, ads, and embeds to prevent content jumping.",
            priority="High",
        ))

    if cwv.get("tbt"):
        suggestions.append(Suggestion(
            title="Reduce Total Blocking Time",
            description=f"TBT is {cwv['tbt']}. Break up long JavaScript tasks, use Web Workers, and defer third-party scripts to improve interactivity.",
            priority="Medium",
        ))

    # SEO issues
    if page_data["title_length"] == 0:
        suggestions.append(Suggestion(
            title="Add a page title",
            description="No <title> tag was found. This is critical for SEO and browser tab display. Add a descriptive 50-60 character title.",
            priority="High",
        ))
    elif not (IDEAL_TITLE_MIN <= page_data["title_length"] <= IDEAL_TITLE_MAX):
        suggestions.append(Suggestion(
            title="Optimize page title length",
            description=f"Title is {page_data['title_length']} chars (ideal: {IDEAL_TITLE_MIN}–{IDEAL_TITLE_MAX}). {'Shorten' if page_data['title_length'] > IDEAL_TITLE_MAX else 'Lengthen'} it for better search result display.",
            priority="Medium",
        ))

    if not page_data["has_meta_description"]:
        suggestions.append(Suggestion(
            title="Add a meta description",
            description="No meta description found. This directly impacts click-through rates in search results. Write a compelling 120-160 character description.",
            priority="High",
        ))

    if page_data["h1_count"] == 0:
        suggestions.append(Suggestion(
            title="Add a single H1 heading",
            description="No H1 tag found. The H1 is the primary signal for both users and search engines about the page topic. Every page needs exactly one.",
            priority="High",
        ))
    elif page_data["h1_count"] > 1:
        suggestions.append(Suggestion(
            title="Use exactly one H1 per page",
            description=f"Found {page_data['h1_count']} H1 tags. Multiple H1s dilute SEO signals. Keep one primary H1 and use H2-H3 for sub-sections.",
            priority="Medium",
        ))

    if not page_data["has_canonical"]:
        suggestions.append(Suggestion(
            title="Add canonical URL tag",
            description="No canonical link tag found. This can cause duplicate content issues in search engines. Add <link rel='canonical' href='...'> to specify the preferred URL.",
            priority="Medium",
        ))

    if not page_data["has_og_tags"]:
        suggestions.append(Suggestion(
            title="Add Open Graph meta tags",
            description="No OG tags found. When shared on social media, the page will have no preview image or description. Add og:title, og:description, and og:image.",
            priority="Medium",
        ))

    if not page_data["has_schema"]:
        suggestions.append(Suggestion(
            title="Add structured data (Schema.org)",
            description="No JSON-LD structured data found. Schema markup helps search engines understand your content and enables rich snippets in search results.",
            priority="Low",
        ))

    # Accessibility issues
    if page_data["num_images"] > 0 and page_data["num_images_missing_alt"] > 0:
        ratio = page_data["num_images_missing_alt"] / page_data["num_images"]
        suggestions.append(Suggestion(
            title="Add alt text to images",
            description=f"{page_data['num_images_missing_alt']} of {page_data['num_images']} images missing alt text. Screen readers rely on alt text — add descriptive text for all informational images.",
            priority="High" if ratio > 0.5 else "Medium",
        ))

    if page_data["inputs_missing_label"] > 0:
        suggestions.append(Suggestion(
            title="Label all form inputs",
            description=f"{page_data['inputs_missing_label']} form input(s) lack associated labels. Screen reader users cannot identify unlabeled fields. Use <label for='...'> or aria-label.",
            priority="High",
        ))

    # UX issues
    if page_data["num_cta_elements"] == 0:
        suggestions.append(Suggestion(
            title="Add clear call-to-action buttons",
            description="No CTA elements detected (e.g., 'Get Started', 'Buy Now', 'Sign Up'). CTAs guide users toward your conversion goals and are essential for engagement.",
            priority="High",
        ))

    total_clickable = page_data["num_links"] + page_data["num_buttons"]
    if total_clickable > EXCESSIVE_LINKS:
        suggestions.append(Suggestion(
            title="Reduce navigation clutter",
            description=f"Page has {total_clickable} clickable elements — overwhelming for users. Apply progressive disclosure: show primary actions prominently, hide secondary ones.",
            priority="Medium",
        ))

    # Sort and limit
    priority_rank = {"High": 0, "Medium": 1, "Low": 2}
    suggestions.sort(key=lambda s: priority_rank[s.priority])
    return suggestions[:8]


# ──────────────────────────────────────────────────────────────────────────────
# 9. PDF Report Generation
# ──────────────────────────────────────────────────────────────────────────────

SCORE_COLORS = {
    "excellent": colors.HexColor("#10b981"),
    "good":      colors.HexColor("#6366f1"),
    "fair":      colors.HexColor("#f59e0b"),
    "poor":      colors.HexColor("#ef4444"),
}

PRIORITY_COLORS = {
    "High":   colors.HexColor("#ef4444"),
    "Medium": colors.HexColor("#f59e0b"),
    "Low":    colors.HexColor("#6366f1"),
}


def _score_color(score: int):
    if score >= 90: return SCORE_COLORS["excellent"]
    if score >= 75: return SCORE_COLORS["good"]
    if score >= 60: return SCORE_COLORS["fair"]
    return SCORE_COLORS["poor"]


def _score_label(score: int) -> str:
    if score >= 90: return "Excellent"
    if score >= 75: return "Good"
    if score >= 60: return "Fair"
    return "Poor"


def generate_pdf_report(report: dict) -> bytes:
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2 * cm, leftMargin=2 * cm,
        topMargin=2 * cm, bottomMargin=2 * cm,
    )

    styles = getSampleStyleSheet()
    story = []

    header_style = ParagraphStyle(
        "Header", parent=styles["Heading1"],
        fontSize=22, textColor=colors.HexColor("#7c5cff"), spaceAfter=4,
    )
    sub_style = ParagraphStyle(
        "Sub", parent=styles["Normal"],
        fontSize=10, textColor=colors.HexColor("#94a3b8"), spaceAfter=2,
    )
    body_style = ParagraphStyle(
        "Body", parent=styles["Normal"],
        fontSize=10, textColor=colors.HexColor("#e2e8f0"), spaceAfter=4,
    )

    story.append(Paragraph("Smart UX Analyzer", header_style))
    story.append(Paragraph("AI-Powered UX Analysis Report", sub_style))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#334155"), spaceAfter=12))
    story.append(Paragraph(f"<b>URL:</b> {report['url']}", body_style))
    story.append(Paragraph(f"<b>Analyzed:</b> {report['created_at']}", body_style))
    story.append(Paragraph(f"<b>Data Source:</b> {report.get('data_source', 'html_only').replace('_', ' ').title()}", body_style))
    story.append(Spacer(1, 0.4 * cm))

    # Core Web Vitals section
    cwv = report.get("core_web_vitals", {})
    if isinstance(cwv, str):
        try:
            cwv = json.loads(cwv)
        except Exception:
            cwv = {}

    if any(v for v in cwv.values() if v):
        story.append(Paragraph("Core Web Vitals", ParagraphStyle(
            "CWVHeader", parent=styles["Heading2"],
            fontSize=13, textColor=colors.HexColor("#7c5cff"), spaceBefore=8, spaceAfter=6,
        )))
        cwv_items = [
            ("LCP", cwv.get("lcp")), ("FCP", cwv.get("fcp")),
            ("CLS", cwv.get("cls")), ("TBT", cwv.get("tbt")),
            ("TTFB", cwv.get("ttfb")), ("Speed Index", cwv.get("speed_index")),
        ]
        cwv_data = [["Metric", "Value"]] + [
            [label, val or "N/A"] for label, val in cwv_items if val
        ]
        cwv_table = Table(cwv_data, colWidths=[4 * cm, 5 * cm])
        cwv_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e1b4b")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#94a3b8")),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#0f0a1a"), colors.HexColor("#1a1030")]),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#334155")),
            ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#334155")),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
        ]))
        story.append(cwv_table)
        story.append(Spacer(1, 0.4 * cm))

    # Score Grid
    score_title_style = ParagraphStyle(
        "ScoreTitle", parent=styles["Normal"],
        fontSize=9, textColor=colors.HexColor("#94a3b8"), alignment=1,
    )
    score_value_style = ParagraphStyle(
        "ScoreValue", parent=styles["Normal"],
        fontSize=28, alignment=1, leading=32,
    )

    def score_cell(label: str, value: int):
        c = _score_color(value)
        return [
            Paragraph(label, score_title_style),
            Paragraph(f'<font color="{c.hexval()}" size="28"><b>{value}</b></font>', score_value_style),
            Paragraph(f'<font color="{c.hexval()}" size="9">{_score_label(value)}</font>', score_title_style),
        ]

    score_data = [[
        score_cell("UX Score", report["ux_score"]),
        score_cell("Accessibility", report["accessibility"]),
        score_cell("Performance", report["performance"]),
        score_cell("SEO", report["seo"]),
    ]]

    score_table = Table(score_data, colWidths=[4.1 * cm] * 4)
    score_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#1e1b4b")),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#334155")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#334155")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("ROUNDEDCORNERS", [6]),
    ]))
    story.append(score_table)
    story.append(Spacer(1, 0.6 * cm))

    # Suggestions
    story.append(Paragraph("AI-Powered Suggestions", ParagraphStyle(
        "SugHeader", parent=styles["Heading2"],
        fontSize=14, textColor=colors.HexColor("#7c5cff"), spaceBefore=8, spaceAfter=6,
    )))

    suggestions = report.get("suggestions", [])
    if suggestions:
        sug_data = [["Priority", "Title", "Description"]]
        for s in suggestions:
            pri = s["priority"] if isinstance(s, dict) else s.priority
            title = s["title"] if isinstance(s, dict) else s.title
            desc = s["description"] if isinstance(s, dict) else s.description
            sug_data.append([
                Paragraph(f'<font color="{PRIORITY_COLORS[pri].hexval()}"><b>{pri}</b></font>',
                           ParagraphStyle("pc", parent=styles["Normal"], fontSize=9, alignment=1)),
                Paragraph(f"<b>{title}</b>",
                           ParagraphStyle("tc", parent=styles["Normal"], fontSize=9)),
                Paragraph(desc, ParagraphStyle("dc", parent=styles["Normal"], fontSize=8,
                                               textColor=colors.HexColor("#94a3b8"))),
            ])

        sug_table = Table(sug_data, colWidths=[2 * cm, 4.5 * cm, 10.1 * cm])
        sug_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e1b4b")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#94a3b8")),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 9),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#0f0a1a"), colors.HexColor("#1a1030")]),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#334155")),
            ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#334155")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(sug_table)
    else:
        story.append(Paragraph("No suggestions — this site looks great!", body_style))

    story.append(Spacer(1, 1 * cm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#334155")))
    story.append(Paragraph(
        "Generated by Smart UX Analyzer · Powered by Google PageSpeed Insights + Claude AI",
        ParagraphStyle("Footer", parent=styles["Normal"], fontSize=8,
                       textColor=colors.HexColor("#475569"), alignment=1, spaceBefore=6),
    ))

    doc.build(story)
    return buffer.getvalue()


# ──────────────────────────────────────────────────────────────────────────────
# FastAPI App
# ──────────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Smart UX Analyzer",
    description=(
        "Production-grade AI-Powered UI/UX Analysis Engine. "
        "Combines Google PageSpeed Insights v5 + Claude AI + HTML heuristics."
    ),
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info("→ %s %s", request.method, request.url.path)
    start = time.perf_counter()
    response = await call_next(request)
    elapsed = time.perf_counter() - start
    logger.info("← %s %s %s (%.2fs)", request.method, request.url.path, response.status_code, elapsed)
    return response


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})


# ── Health ─────────────────────────────────────────────────────────────────────

@app.get("/health")
@app.get("/healthz")
def health_check():
    return {
        "status": "ok",
        "version": "3.0.0",
        "pagespeed_enabled": bool(PAGESPEED_API_KEY),
        "ai_suggestions_enabled": bool(ANTHROPIC_API_KEY),
    }


# ── Analyze + Save ────────────────────────────────────────────────────────────

@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(payload: AnalyzeRequest):
    url = str(payload.url)
    user_id = payload.user_id or "guest"
    logger.info("🔍 Analyzing %s for user %s", url, user_id)

    # Run HTML fetch + PageSpeed API concurrently
    fetch_task = asyncio.to_thread(_fetch_html_sync, url)
    psi_task = fetch_pagespeed(url)

    try:
        fetch_result, psi = await asyncio.gather(fetch_task, psi_task)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Analysis failed for %s: %s", url, exc)
        raise HTTPException(status_code=502, detail=f"Analysis failed: {exc}")

    page_data = parse_html(fetch_result["html"])
    page_data["response_time"] = fetch_result["response_time"]

    scores = calculate_scores(page_data, psi)

    # Generate suggestions (Claude AI or rule-based fallback)
    suggestions = await generate_ai_suggestions(url, page_data, psi, scores)

    core_web_vitals = psi.get("core_web_vitals", {}) if psi["available"] else {}
    data_source = "pagespeed" if psi["available"] else "html_only"
    created_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    # Persist to SQLite
    with get_db() as conn:
        cursor = conn.execute(
            """
            INSERT INTO reports
              (user_id, url, ux_score, accessibility, performance, seo, suggestions, core_web_vitals, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id, url,
                scores["ux_score"], scores["accessibility"],
                scores["performance"], scores["seo"],
                json.dumps([s.model_dump() for s in suggestions]),
                json.dumps(core_web_vitals),
                created_at,
            ),
        )
        report_id = cursor.lastrowid
        conn.commit()

    logger.info(
        "✅ Report %d | %s | perf=%s seo=%s access=%s ux=%s | source=%s",
        report_id, url, scores["performance"], scores["seo"],
        scores["accessibility"], scores["ux_score"], data_source,
    )

    cwv_model = CoreWebVitals(**core_web_vitals) if core_web_vitals else CoreWebVitals()

    return AnalyzeResponse(
        id=report_id,
        url=url,
        ux_score=scores["ux_score"],
        accessibility=scores["accessibility"],
        performance=scores["performance"],
        seo=scores["seo"],
        core_web_vitals=cwv_model,
        suggestions=suggestions,
        data_source=data_source,
        created_at=created_at,
    )


# ── Reports CRUD ──────────────────────────────────────────────────────────────

def _row_to_report(row: sqlite3.Row) -> dict:
    cwv_raw = row["core_web_vitals"] if "core_web_vitals" in row.keys() else "{}"
    try:
        cwv = json.loads(cwv_raw) if cwv_raw else {}
    except Exception:
        cwv = {}
    return {
        "id": row["id"],
        "user_id": row["user_id"],
        "url": row["url"],
        "ux_score": row["ux_score"],
        "accessibility": row["accessibility"],
        "performance": row["performance"],
        "seo": row["seo"],
        "suggestions": json.loads(row["suggestions"]),
        "core_web_vitals": cwv,
        "created_at": row["created_at"],
    }


@app.get("/reports")
def list_reports(user_id: Optional[str] = Query(default=None)):
    with get_db() as conn:
        if user_id:
            rows = conn.execute(
                "SELECT * FROM reports WHERE user_id = ? ORDER BY id DESC", (user_id,)
            ).fetchall()
        else:
            rows = conn.execute("SELECT * FROM reports ORDER BY id DESC").fetchall()
    return [_row_to_report(r) for r in rows]


@app.get("/reports/{report_id}")
def get_report(report_id: int):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM reports WHERE id = ?", (report_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail=f"Report {report_id} not found.")
    return _row_to_report(row)


@app.delete("/reports/{report_id}")
def delete_report(report_id: int):
    with get_db() as conn:
        result = conn.execute("DELETE FROM reports WHERE id = ?", (report_id,))
        conn.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail=f"Report {report_id} not found.")
    return {"deleted": report_id}


@app.get("/reports/{report_id}/pdf")
def download_pdf(report_id: int):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM reports WHERE id = ?", (report_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail=f"Report {report_id} not found.")
    report = _row_to_report(row)
    pdf_bytes = generate_pdf_report(report)
    safe_url = report["url"].replace("https://", "").replace("http://", "").replace("/", "_")[:40]
    filename = f"ux-report-{report_id}-{safe_url}.pdf"
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── User Profile ──────────────────────────────────────────────────────────────

@app.get("/profile/{user_id}", response_model=UserProfile)
def get_profile(user_id: str):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if not row:
        return UserProfile(
            id=user_id,
            created_at=datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
        )
    return UserProfile(id=row["id"], name=row["name"], email=row["email"],
                       phone=row["phone"], created_at=row["created_at"])


@app.put("/profile/{user_id}", response_model=UserProfile)
def upsert_profile(user_id: str, payload: UserProfileUpdate):
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO users (id, name, email, phone, created_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name  = excluded.name,
                email = excluded.email,
                phone = excluded.phone
            """,
            (user_id, payload.name, payload.email, payload.phone, now),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return UserProfile(id=row["id"], name=row["name"], email=row["email"],
                       phone=row["phone"], created_at=row["created_at"])


@app.get("/stats/{user_id}")
def get_user_stats(user_id: str):
    with get_db() as conn:
        rows = conn.execute(
            "SELECT ux_score, accessibility, performance, seo FROM reports WHERE user_id = ?",
            (user_id,),
        ).fetchall()
    if not rows:
        return {"total_analyses": 0, "avg_ux": 0, "avg_accessibility": 0,
                "avg_performance": 0, "avg_seo": 0}
    n = len(rows)
    return {
        "total_analyses": n,
        "avg_ux": round(sum(r["ux_score"] for r in rows) / n),
        "avg_accessibility": round(sum(r["accessibility"] for r in rows) / n),
        "avg_performance": round(sum(r["performance"] for r in rows) / n),
        "avg_seo": round(sum(r["seo"] for r in rows) / n),
    }


# ── User Settings ─────────────────────────────────────────────────────────────

@app.get("/settings/{user_id}", response_model=SettingsResponse)
def get_user_settings(user_id: str):
    with get_db() as conn:
        row = conn.execute(
            "SELECT dark_mode, auto_analysis, data_sharing FROM user_settings WHERE user_id = ?",
            (user_id,),
        ).fetchone()
    if not row:
        return SettingsResponse(user_id=user_id, dark_mode=True, auto_analysis=False, data_sharing=False)
    return SettingsResponse(
        user_id=user_id,
        dark_mode=bool(row["dark_mode"]),
        auto_analysis=bool(row["auto_analysis"]),
        data_sharing=bool(row["data_sharing"]),
    )


@app.post("/settings/update", response_model=SettingsResponse)
def update_user_settings(payload: SettingsUpdate):
    user_id = str(payload.user_id)
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO user_settings (user_id, dark_mode, auto_analysis, data_sharing, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                dark_mode = excluded.dark_mode,
                auto_analysis = excluded.auto_analysis,
                data_sharing = excluded.data_sharing,
                updated_at = excluded.updated_at
            """,
            (user_id, int(payload.dark_mode), int(payload.auto_analysis),
             int(payload.data_sharing), now, now),
        )
        conn.commit()
    return SettingsResponse(user_id=user_id, dark_mode=payload.dark_mode,
                            auto_analysis=payload.auto_analysis, data_sharing=payload.data_sharing)


# ── Authentication ─────────────────────────────────────────────────────────────

@app.post("/auth/register", response_model=TokenResponse)
def register(payload: UserRegister):
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    with get_db() as conn:
        existing = conn.execute(
            "SELECT id FROM auth_users WHERE email = ?", (payload.email.lower(),)
        ).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="An account with this email already exists.")
        hashed = hash_password(payload.password)
        cursor = conn.execute(
            "INSERT INTO auth_users (name, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
            (payload.name.strip(), payload.email.lower().strip(), hashed, now),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM auth_users WHERE id = ?", (cursor.lastrowid,)).fetchone()
    token = create_access_token(row["id"], row["email"])
    logger.info("👤 New user registered: %s (id=%s)", row["email"], row["id"])
    return TokenResponse(
        access_token=token,
        user=AuthUserResponse(id=row["id"], name=row["name"], email=row["email"],
                              profile_image=row["profile_image"], created_at=row["created_at"]),
    )


@app.post("/auth/login", response_model=TokenResponse)
def login(payload: UserLogin):
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM auth_users WHERE email = ?", (payload.email.lower().strip(),)
        ).fetchone()
    if not row or not row["password_hash"]:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    if not verify_password(payload.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    token = create_access_token(row["id"], row["email"])
    logger.info("🔐 User logged in: %s", row["email"])
    return TokenResponse(
        access_token=token,
        user=AuthUserResponse(id=row["id"], name=row["name"], email=row["email"],
                              profile_image=row["profile_image"], created_at=row["created_at"]),
    )


@app.post("/auth/social-login", response_model=TokenResponse)
def social_login(payload: SocialLogin):
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM auth_users WHERE email = ?", (payload.email.lower(),)
        ).fetchone()
        if row:
            if payload.google_id and not row["google_id"]:
                conn.execute(
                    "UPDATE auth_users SET google_id = ?, profile_image = ? WHERE id = ?",
                    (payload.google_id, payload.profile_image, row["id"]),
                )
                conn.commit()
                row = conn.execute("SELECT * FROM auth_users WHERE id = ?", (row["id"],)).fetchone()
        else:
            cursor = conn.execute(
                "INSERT INTO auth_users (name, email, google_id, profile_image, created_at) VALUES (?,?,?,?,?)",
                (payload.name, payload.email.lower(), payload.google_id, payload.profile_image, now),
            )
            conn.commit()
            row = conn.execute("SELECT * FROM auth_users WHERE id = ?", (cursor.lastrowid,)).fetchone()
    token = create_access_token(row["id"], row["email"])
    return TokenResponse(
        access_token=token,
        user=AuthUserResponse(id=row["id"], name=row["name"], email=row["email"],
                              profile_image=row["profile_image"], created_at=row["created_at"]),
    )


@app.get("/auth/me", response_model=AuthUserResponse)
def get_me(current_user: dict = Depends(get_current_user)):
    return AuthUserResponse(
        id=current_user["id"], name=current_user["name"],
        email=current_user["email"], profile_image=current_user.get("profile_image"),
        created_at=current_user["created_at"],
    )


@app.post("/auth/forgot-password")
def forgot_password(payload: ForgotPasswordRequest):
    with get_db() as conn:
        row = conn.execute(
            "SELECT id FROM auth_users WHERE email = ?", (payload.email.lower(),)
        ).fetchone()
    if not row:
        return {"message": "If an account exists, a reset link has been sent."}
    reset_token = jose_jwt.encode(
        {"sub": str(row["id"]), "type": "reset",
         "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
        SECRET_KEY, algorithm=ALGORITHM,
    )
    logger.info("🔑 Password reset token for %s", payload.email)
    return {"message": "If an account exists, a reset link has been sent.", "reset_token": reset_token}


@app.post("/auth/reset-password")
def reset_password(payload: ResetPasswordRequest):
    try:
        data = jose_jwt.decode(payload.token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=400, detail="Reset token is invalid or expired.")
    if data.get("type") != "reset":
        raise HTTPException(status_code=400, detail="Invalid token type.")
    with get_db() as conn:
        conn.execute(
            "UPDATE auth_users SET password_hash = ? WHERE id = ?",
            (hash_password(payload.new_password), int(data["sub"])),
        )
        conn.commit()
    return {"message": "Password reset successfully. You may now log in."}


# ──────────────────────────────────────────────────────────────────────────────
# Entrypoint
# ──────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    logger.info("🚀 Starting Smart UX Analyzer v3.0 on port %d", port)
    logger.info("   PageSpeed API: %s", "✅ Enabled" if PAGESPEED_API_KEY else "⚠️  Not configured (HTML-only mode)")
    logger.info("   Claude AI:     %s", "✅ Enabled" if ANTHROPIC_API_KEY else "⚠️  Not configured (rule-based suggestions)")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
