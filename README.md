# HackSentinel

> **Comprehensive Web Vulnerability Scanner and Security Platform**

A modern, full-stack security platform for identifying and managing web vulnerabilities with real-time monitoring, AI-powered insights, and 2FA authentication.

---

## Project Structure

```
Working1/
├── backend/                    # Express + MongoDB API
│   ├── index.js                # Entry point
│   ├── routes/                 # HTTP route handlers
│   ├── models/                 # Mongoose schemas
│   ├── services/               # Business logic (Gemini, agent, reportGenerator)
│   ├── middleware/             # Express middleware
│   ├── utils/                  # Helpers
│   ├── scripts/                # One-off admin/seed/dev scripts
│   │   └── dev/                # Debug scripts (diagnose_db, test_gemini, ...)
│   ├── Dockerfile
│   ├── package.json
│   └── .env.example
│
├── frontend/                   # React + Vite + TypeScript
│   ├── src/                    # Components, pages, services
│   ├── public/                 # Static assets
│   ├── index.html
│   ├── vite.config.ts
│   ├── Dockerfile
│   ├── package.json
│   └── .env.example
│
├── scripts/                    # Cross-cutting utility scripts
├── docs/                       # Project docs & reports
└── README.md
```

---

## Technology Stack

### Backend (`backend/`)
- **Node.js 18+** with **Express 5**
- **MongoDB** via **Mongoose**
- **JWT** for auth, **bcrypt** for password hashing
- **@google/generative-ai** (Gemini) for AI chat / insights
- **pdfkit** + **docx** for report generation
- **multer** + **sharp** for image uploads

### Frontend (`frontend/`)
- **React 18** with **TypeScript**
- **Vite 5** build tool
- **React Router 6**
- **Firebase** (phone auth)
- **Bootstrap** + **lucide-react** / **react-icons**
- **recharts** for charts

---

## Local Development

### Prerequisites
- Node.js 18+
- MongoDB running locally (or an Atlas connection string)
- (Optional) Python scan API on `http://localhost:8000` for scan features
- (Optional) Firebase project for phone OTP

### Backend

```bash
cd backend
npm install
cp .env.example .env       # then edit .env with real values
npm run dev                # or: npm start
```

Backend runs on `http://localhost:5000`.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env       # then edit VITE_API_BASE if needed
npm run dev
```

Frontend runs on `http://localhost:5173`.

---

## Environment Variables

See `backend/.env.example` and `frontend/.env.example` for the full list.

**Required backend keys:** `MONGO_URI`, `JWT_SECRET`, `GEMINI_API_KEY`
**Required frontend keys:** `VITE_API_BASE`

Never commit real `.env` files — they are gitignored.

---

## Features

- **Authentication** — Email/password + JWT, dual 2FA (email or phone OTP), password reset
- **Vulnerability scanning** — Passive scan pipeline via Python model service
- **AI chatbot** — Gemini-powered security assistant
- **Reports** — Auto-generated PDF/Word bug bounty reports
- **Admin dashboard** — User + subscription management
- **Subscriptions** — Tiered plans with payment handling

---

## API Overview

Base URL: `http://localhost:5000/api`

| Group | Prefix | Purpose |
|---|---|---|
| Auth | `/auth` | signup, signin, 2FA, password reset |
| Contact | `/contact` | contact form |
| Settings | `/settings` | user settings |
| Subscription | `/subscription` | plans, purchases |
| Notifications | `/notifications` | in-app notifications |
| Admin | `/admin` | admin operations |
| Chat | `/chat` | AI chatbot (Gemini) |
| QA | `/qa` | knowledge base Q&A |
| Scan | `/scan` | proxy to Python scan API |
| Report | `/report` | vulnerability report generation |

---

## Deployment

- **Backend** → Railway (or any Node host). Set env vars from `backend/.env.example`.
- **Frontend** → Vercel (or any static host). Set `VITE_API_BASE` to your backend URL.
- After deploy, ensure the backend CORS origin allows the frontend domain (currently CORS is permissive in dev — tighten via `CLIENT_ORIGIN` for production).

---

## License

Private / proprietary — HackSentinel FYP project.
