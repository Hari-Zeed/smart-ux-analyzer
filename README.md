# Smart UX Analyzer — AI-Powered UX Intelligence Platform

Full-stack platform that evaluates website usability, accessibility, and performance, replacing manual UX audits with automated, data-driven scoring.

## Key Features
- Real-time usability, accessibility, and performance scoring
- AI-generated UX recommendations
- Automated audits via web scraping and PageSpeed metrics
- Interactive dashboard with data visualizations
- Google authentication

## Tech Stack
- **Frontend:** Next.js
- **Backend:** FastAPI
- **Deployment:** Vercel (frontend), Render (backend)
- **Integrations:** PageSpeed API, web scraping

## Key Results
- Automated scoring model replacing manual UX audits
- Improved audit efficiency by identifying design bottlenecks automatically

## Setup
```bash
git clone https://github.com/Hari-Zeed/smart-ux-analyzer.git
cd smart-ux-analyzer
# Frontend
npm install && npm run dev
# Backend
pip install -r requirements.txt
uvicorn main:app --reload
```
Configure API keys (PageSpeed, Google Auth) in a `.env` file before running.

## Demo
🔗 [https://smart-ux-analyzer.vercel.app](https://smart-ux-analyzer.vercel.app)
