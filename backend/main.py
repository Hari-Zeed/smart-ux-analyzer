"""
Smart UX Analyzer – AI-Powered UI/UX Improvement Tool
Single-file FastAPI backend with SQLite persistence and PDF export.

Run with:
    uvicorn main:app --reload --port 8000
"""

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

from jose import JWTError, jwt as jose_jwt
import bcrypt as _bcrypt

import requests
from bs4 import BeautifulSoup
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

REQUEST_TIMEOUT_SECONDS = 10
USER_AGENT = "Mozilla/5.0 (compatible; SmartUXAnalyzer/1.0)"

SLOW_RESPONSE_THRESHOLD = 2.0
VERY_SLOW_RESPONSE_THRESHOLD = 4.0
IDEAL_TITLE_MIN = 50
IDEAL_TITLE_MAX = 60
TOO_MANY_LINKS = 100
EXCESSIVE_LINKS = 200

CTA_KEYWORDS = (
    "buy", "sign up", "signup", "get started", "subscribe", "download",
    "try", "start", "join", "order", "book", "contact", "learn more",
    "add to cart", "shop", "register",
)

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
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id     TEXT    NOT NULL DEFAULT 'guest',
                url         TEXT    NOT NULL,
                ux_score    INTEGER NOT NULL,
                accessibility INTEGER NOT NULL,
                performance INTEGER NOT NULL,
                seo         INTEGER NOT NULL,
                suggestions TEXT    NOT NULL,
                created_at  TEXT    NOT NULL
            )
        """)
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
        try:
            conn.execute("ALTER TABLE user_settings ADD COLUMN auto_analysis INTEGER NOT NULL DEFAULT 0")
        except sqlite3.OperationalError:
            pass
        try:
            conn.execute("ALTER TABLE user_settings ADD COLUMN data_sharing INTEGER NOT NULL DEFAULT 0")
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
    logger.info("Database initialised at %s", DB_PATH)


init_db()


# ──────────────────────────────────────────────────────────────────────────────
# Auth: JWT + Password Hashing
# ──────────────────────────────────────────────────────────────────────────────

SECRET_KEY = os.getenv("SECRET_KEY", "smart-ux-analyzer-jwt-secret-change-in-production-2024")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7

pwd_context = None  # not used — direct bcrypt
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


def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)) -> Dict[str, Any]:
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


# ── Analyze Models ─────────────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    url: HttpUrl = Field(..., description="Full URL of the website to analyze")
    user_id: str = Field(default="guest", description="User ID for report ownership")



class Suggestion(BaseModel):
    title: str
    description: str
    priority: Literal["High", "Medium", "Low"]


class AnalyzeResponse(BaseModel):
    id: int
    url: str
    ux_score: int = Field(..., ge=0, le=100)
    accessibility: int = Field(..., ge=0, le=100)
    performance: int = Field(..., ge=0, le=100)
    seo: int = Field(..., ge=0, le=100)
    suggestions: List[Suggestion]
    created_at: str


class ReportListItem(BaseModel):
    id: int
    user_id: str
    url: str
    ux_score: int
    accessibility: int
    performance: int
    seo: int
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
# 1. Fetching
# ──────────────────────────────────────────────────────────────────────────────


def fetch_html(url: str) -> dict:
    headers = {"User-Agent": USER_AGENT}
    start = time.perf_counter()

    try:
        response = requests.get(
            url, headers=headers, timeout=REQUEST_TIMEOUT_SECONDS, allow_redirects=True
        )
    except requests.exceptions.Timeout as exc:
        logger.warning("Timeout fetching %s", url)
        raise HTTPException(status_code=504, detail=f"Timed out while fetching {url}.") from exc
    except requests.exceptions.MissingSchema as exc:
        logger.warning("Invalid URL %s", url)
        raise HTTPException(
            status_code=400,
            detail=f"'{url}' is not a valid URL. Include the scheme, e.g. https://example.com",
        ) from exc
    except requests.exceptions.ConnectionError as exc:
        logger.warning("Connection error fetching %s", url)
        raise HTTPException(
            status_code=502,
            detail=f"Could not connect to {url}. The site may be down or blocking requests.",
        ) from exc
    except requests.exceptions.RequestException as exc:
        logger.warning("Request error fetching %s: %s", url, exc)
        raise HTTPException(status_code=502, detail=f"Failed to fetch {url}: {exc}") from exc

    elapsed = time.perf_counter() - start

    if response.status_code in (403, 999):
        raise HTTPException(
            status_code=403,
            detail=f"{url} appears to be blocking automated requests (HTTP {response.status_code}).",
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
# 2. Parsing
# ──────────────────────────────────────────────────────────────────────────────


def parse_html(html: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")

    title_tag = soup.find("title")
    title = title_tag.get_text(strip=True) if title_tag else ""

    meta_desc_tag = soup.find("meta", attrs={"name": "description"})
    meta_description = (meta_desc_tag.get("content") or "").strip() if meta_desc_tag else ""

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
    word_count = len(body.get_text(separator=" ", strip=True).split()) if body else 0

    return {
        "title": title,
        "title_length": len(title),
        "meta_description": meta_description,
        "has_meta_description": bool(meta_description),
        "num_images": num_images,
        "num_images_missing_alt": num_images_missing_alt,
        "num_links": len(links),
        "num_buttons": len(buttons),
        "num_cta_elements": cta_count,
        "h1_count": len(soup.find_all("h1")),
        "h2_count": len(soup.find_all("h2")),
        "has_viewport_meta": viewport_tag is not None,
        "word_count": word_count,
        "html_size_bytes": len(html.encode("utf-8")),
    }


# ──────────────────────────────────────────────────────────────────────────────
# 3 & 4. Scoring + Suggestions
# ──────────────────────────────────────────────────────────────────────────────


def _clamp(value: float) -> int:
    return max(0, min(100, round(value)))


def generate_suggestions(data: dict) -> List[Suggestion]:
    suggestions: List[Suggestion] = []

    if data["title_length"] == 0:
        suggestions.append(Suggestion(
            title="Add a page title",
            description="No <title> tag was found. Search engines and browser tabs rely on this.",
            priority="High",
        ))
    elif data["title_length"] < IDEAL_TITLE_MIN:
        suggestions.append(Suggestion(
            title="Lengthen the page title",
            description=f"Title is {data['title_length']} characters; aim for {IDEAL_TITLE_MIN}–{IDEAL_TITLE_MAX}.",
            priority="Medium",
        ))
    elif data["title_length"] > IDEAL_TITLE_MAX:
        suggestions.append(Suggestion(
            title="Shorten the page title",
            description=f"Title is {data['title_length']} characters and may be truncated in search results.",
            priority="Medium",
        ))

    if not data["has_meta_description"]:
        suggestions.append(Suggestion(
            title="Add a meta description",
            description="No meta description tag was found. This hurts search result click-through rates.",
            priority="High",
        ))
    elif len(data["meta_description"]) > 160:
        suggestions.append(Suggestion(
            title="Shorten the meta description",
            description="Meta description exceeds 160 characters and may be truncated in search results.",
            priority="Low",
        ))

    if data["h1_count"] == 0:
        suggestions.append(Suggestion(
            title="Improve heading structure",
            description="No H1 tag found. A single clear H1 helps both SEO and page structure.",
            priority="Medium",
        ))
    elif data["h1_count"] > 1:
        suggestions.append(Suggestion(
            title="Use a single H1 per page",
            description=f"Found {data['h1_count']} H1 tags, which can dilute SEO signal.",
            priority="Low",
        ))

    if data["num_images"] > 0 and data["num_images_missing_alt"] > 0:
        ratio = data["num_images_missing_alt"] / data["num_images"]
        suggestions.append(Suggestion(
            title="Optimize images",
            description=f"{data['num_images_missing_alt']} of {data['num_images']} images are missing alt attributes.",
            priority="High" if ratio > 0.5 else "Medium",
        ))

    if not data["has_viewport_meta"]:
        suggestions.append(Suggestion(
            title="Add a responsive viewport meta tag",
            description='No <meta name="viewport"> tag found, which can hurt mobile rendering.',
            priority="Medium",
        ))

    suggestions.append(Suggestion(
        title="Improve color contrast (simulated)",
        description="Automated contrast checking requires rendered CSS; run a manual or Lighthouse audit to confirm WCAG AA compliance.",
        priority="Low",
    ))

    response_time = data.get("response_time", 0)
    if response_time > VERY_SLOW_RESPONSE_THRESHOLD:
        suggestions.append(Suggestion(
            title="Reduce server response time",
            description=f"The page took {response_time:.2f}s to respond, which is very slow.",
            priority="High",
        ))
    elif response_time > SLOW_RESPONSE_THRESHOLD:
        suggestions.append(Suggestion(
            title="Improve page load speed",
            description=f"The page took {response_time:.2f}s to respond. Aim for under {SLOW_RESPONSE_THRESHOLD:.0f}s.",
            priority="Medium",
        ))

    total_clickable = data["num_links"] + data["num_buttons"]
    if total_clickable > EXCESSIVE_LINKS:
        suggestions.append(Suggestion(
            title="Reduce navigation clutter",
            description=f"Page has {total_clickable} links/buttons, which can overwhelm users.",
            priority="Medium",
        ))
    elif total_clickable > TOO_MANY_LINKS:
        suggestions.append(Suggestion(
            title="Simplify navigation",
            description=f"Page has {total_clickable} links/buttons. Too many choices can slow decision-making.",
            priority="Low",
        ))

    if data["num_cta_elements"] == 0:
        suggestions.append(Suggestion(
            title="Improve CTA visibility",
            description="No clear call-to-action buttons or links were detected. Add prominent CTAs.",
            priority="High",
        ))

    priority_rank = {"High": 0, "Medium": 1, "Low": 2}
    suggestions.sort(key=lambda s: priority_rank[s.priority])
    return suggestions


def calculate_scores(data: dict) -> dict:
    seo = 100
    if data["title_length"] == 0:
        seo -= 25
    elif not (IDEAL_TITLE_MIN <= data["title_length"] <= IDEAL_TITLE_MAX):
        seo -= 10
    if not data["has_meta_description"]:
        seo -= 20
    elif len(data["meta_description"]) > 160:
        seo -= 5
    if data["h1_count"] == 0:
        seo -= 15
    elif data["h1_count"] > 1:
        seo -= 5
    seo = _clamp(seo)

    accessibility = 100
    if data["num_images"] > 0:
        missing_ratio = data["num_images_missing_alt"] / data["num_images"]
        accessibility -= round(missing_ratio * 40)
    if not data["has_viewport_meta"]:
        accessibility -= 15
    if data["h1_count"] == 0 and data["h2_count"] == 0:
        accessibility -= 10
    accessibility = _clamp(accessibility)

    performance = 100
    response_time = data.get("response_time", 0)
    if response_time > VERY_SLOW_RESPONSE_THRESHOLD:
        performance -= 40
    elif response_time > SLOW_RESPONSE_THRESHOLD:
        performance -= 20
    if data["html_size_bytes"] > 500_000:
        performance -= 15
    if data["num_images"] > 30:
        performance -= 10
    performance = _clamp(performance)

    ux_clarity = 100
    total_clickable = data["num_links"] + data["num_buttons"]
    if total_clickable > EXCESSIVE_LINKS:
        ux_clarity -= 25
    elif total_clickable > TOO_MANY_LINKS:
        ux_clarity -= 10
    if data["num_cta_elements"] == 0:
        ux_clarity -= 20
    if data["word_count"] < 50:
        ux_clarity -= 10
    ux_clarity = _clamp(ux_clarity)

    ux_score = _clamp(
        0.35 * ux_clarity + 0.25 * accessibility + 0.20 * performance + 0.20 * seo
    )

    return {"ux_score": ux_score, "accessibility": accessibility, "performance": performance, "seo": seo}


# ──────────────────────────────────────────────────────────────────────────────
# 5. PDF Report Generation
# ──────────────────────────────────────────────────────────────────────────────

SCORE_COLORS = {
    "excellent": colors.HexColor("#10b981"),  # emerald
    "good":      colors.HexColor("#6366f1"),  # indigo
    "fair":      colors.HexColor("#f59e0b"),  # amber
    "poor":      colors.HexColor("#ef4444"),  # red
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
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )

    styles = getSampleStyleSheet()
    story = []

    # ── Header ──
    header_style = ParagraphStyle(
        "Header",
        parent=styles["Heading1"],
        fontSize=22,
        textColor=colors.HexColor("#7c5cff"),
        spaceAfter=4,
    )
    sub_style = ParagraphStyle(
        "Sub",
        parent=styles["Normal"],
        fontSize=10,
        textColor=colors.HexColor("#94a3b8"),
        spaceAfter=2,
    )
    body_style = ParagraphStyle(
        "Body",
        parent=styles["Normal"],
        fontSize=10,
        textColor=colors.HexColor("#e2e8f0"),
        spaceAfter=4,
    )

    story.append(Paragraph("Smart UX Analyzer", header_style))
    story.append(Paragraph("AI-Powered UX Analysis Report", sub_style))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#334155"), spaceAfter=12))

    story.append(Paragraph(f"<b>URL:</b> {report['url']}", body_style))
    story.append(Paragraph(f"<b>Analyzed:</b> {report['created_at']}", body_style))
    story.append(Spacer(1, 0.4 * cm))

    # ── Score Grid ──
    score_title_style = ParagraphStyle(
        "ScoreTitle",
        parent=styles["Normal"],
        fontSize=9,
        textColor=colors.HexColor("#94a3b8"),
        alignment=1,
    )
    score_value_style = ParagraphStyle(
        "ScoreValue",
        parent=styles["Normal"],
        fontSize=28,
        alignment=1,
        leading=32,
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

    # ── Suggestions ──
    story.append(Paragraph("AI-Powered Suggestions", ParagraphStyle(
        "SugHeader",
        parent=styles["Heading2"],
        fontSize=14,
        textColor=colors.HexColor("#7c5cff"),
        spaceBefore=8,
        spaceAfter=6,
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
                Paragraph(desc,
                           ParagraphStyle("dc", parent=styles["Normal"], fontSize=8, textColor=colors.HexColor("#94a3b8"))),
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

    # ── Footer ──
    story.append(Spacer(1, 1 * cm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#334155")))
    story.append(Paragraph(
        "Generated by Smart UX Analyzer · AI-Powered UX Analysis",
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
    description="AI-Powered UI/UX Improvement Tool — analyzes a website and returns UX, "
    "accessibility, performance, and SEO scores with suggestions.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info("%s %s", request.method, request.url.path)
    response = await call_next(request)
    logger.info("%s %s -> %s", request.method, request.url.path, response.status_code)
    return response


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
@app.get("/healthz")
def health_check():
    return {"status": "ok", "version": "2.0.0"}


# ── Analyze + Save ────────────────────────────────────────────────────────────

@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(payload: AnalyzeRequest):
    url = str(payload.url)
    user_id = payload.user_id or "guest"
    logger.info("Analyzing %s for user %s", url, user_id)

    fetch_result = fetch_html(url)
    page_data = parse_html(fetch_result["html"])
    page_data["response_time"] = fetch_result["response_time"]

    scores = calculate_scores(page_data)
    suggestions = generate_suggestions(page_data)

    created_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    # Persist to SQLite
    with get_db() as conn:
        cursor = conn.execute(
            """
            INSERT INTO reports (user_id, url, ux_score, accessibility, performance, seo, suggestions, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                url,
                scores["ux_score"],
                scores["accessibility"],
                scores["performance"],
                scores["seo"],
                json.dumps([s.model_dump() for s in suggestions]),
                created_at,
            ),
        )
        report_id = cursor.lastrowid
        conn.commit()

    logger.info(
        "Saved report %d for %s -> ux=%s accessibility=%s performance=%s seo=%s (%.2fs)",
        report_id, url, scores["ux_score"], scores["accessibility"],
        scores["performance"], scores["seo"], fetch_result["response_time"],
    )

    return AnalyzeResponse(
        id=report_id,
        url=url,
        ux_score=scores["ux_score"],
        accessibility=scores["accessibility"],
        performance=scores["performance"],
        seo=scores["seo"],
        suggestions=suggestions,
        created_at=created_at,
    )


# ── Reports CRUD ──────────────────────────────────────────────────────────────

def _row_to_report(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "user_id": row["user_id"],
        "url": row["url"],
        "ux_score": row["ux_score"],
        "accessibility": row["accessibility"],
        "performance": row["performance"],
        "seo": row["seo"],
        "suggestions": json.loads(row["suggestions"]),
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
            rows = conn.execute(
                "SELECT * FROM reports ORDER BY id DESC"
            ).fetchall()
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
        # Return empty profile (user hasn't saved one yet)
        return UserProfile(
            id=user_id,
            created_at=datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
        )
    return UserProfile(
        id=row["id"],
        name=row["name"],
        email=row["email"],
        phone=row["phone"],
        created_at=row["created_at"],
    )


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
        return SettingsResponse(
            user_id=user_id,
            dark_mode=True,
            auto_analysis=False,
            data_sharing=False,
        )
    return SettingsResponse(
        user_id=user_id,
        dark_mode=bool(row["dark_mode"]),
        auto_analysis=bool(row["auto_analysis"]),
        data_sharing=bool(row["data_sharing"]),
    )


@app.post("/settings/update", response_model=SettingsResponse)
def update_user_settings(payload: SettingsUpdate):
    user_id = str(payload.user_id)
    dark_mode_val = 1 if payload.dark_mode else 0
    auto_analysis_val = 1 if payload.auto_analysis else 0
    data_sharing_val = 1 if payload.data_sharing else 0
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
            (user_id, dark_mode_val, auto_analysis_val, data_sharing_val, now, now),
        )
        conn.commit()

    return SettingsResponse(
        user_id=user_id,
        dark_mode=payload.dark_mode,
        auto_analysis=payload.auto_analysis,
        data_sharing=payload.data_sharing,
    )


# ── Authentication Endpoints ───────────────────────────────────────────────────

@app.post("/auth/register", response_model=TokenResponse)
def register(payload: UserRegister):
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    with get_db() as conn:
        existing = conn.execute("SELECT id FROM auth_users WHERE email = ?", (payload.email.lower(),)).fetchone()
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
    logger.info("New user registered: %s (id=%s)", row["email"], row["id"])
    return TokenResponse(
        access_token=token,
        user=AuthUserResponse(id=row["id"], name=row["name"], email=row["email"],
                              profile_image=row["profile_image"], created_at=row["created_at"]),
    )


@app.post("/auth/login", response_model=TokenResponse)
def login(payload: UserLogin):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM auth_users WHERE email = ?", (payload.email.lower().strip(),)).fetchone()
    if not row or not row["password_hash"]:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    if not verify_password(payload.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    token = create_access_token(row["id"], row["email"])
    logger.info("User logged in: %s", row["email"])
    return TokenResponse(
        access_token=token,
        user=AuthUserResponse(id=row["id"], name=row["name"], email=row["email"],
                              profile_image=row["profile_image"], created_at=row["created_at"]),
    )


@app.post("/auth/social-login", response_model=TokenResponse)
def social_login(payload: SocialLogin):
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    with get_db() as conn:
        row = conn.execute("SELECT * FROM auth_users WHERE email = ?", (payload.email.lower(),)).fetchone()
        if row:
            if payload.google_id and not row["google_id"]:
                conn.execute("UPDATE auth_users SET google_id = ?, profile_image = ? WHERE id = ?",
                             (payload.google_id, payload.profile_image, row["id"]))
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
        row = conn.execute("SELECT id FROM auth_users WHERE email = ?", (payload.email.lower(),)).fetchone()
    if not row:
        return {"message": "If an account exists, a reset link has been sent."}
    reset_token = jose_jwt.encode(
        {"sub": str(row["id"]), "type": "reset",
         "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
        SECRET_KEY, algorithm=ALGORITHM,
    )
    logger.info("Password reset token for %s: %s", payload.email, reset_token)
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
        conn.execute("UPDATE auth_users SET password_hash = ? WHERE id = ?",
                     (hash_password(payload.new_password), int(data["sub"])))
        conn.commit()
    return {"message": "Password reset successfully. You may now log in."}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)




