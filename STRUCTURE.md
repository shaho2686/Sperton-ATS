# Sperton ATS — Project Structure

## Overview

A recruitment ATS (Applicant Tracking System) built as a hybrid of Next.js (frontend + API proxy) and a standalone Express backend. The root page immediately redirects to a static HTML portal served from `public/portal/`.

---

## Architecture

```
Browser
  └── public/portal/index.html  (static SPA — HTML/CSS/JS)
           │
           ▼ API calls
  src/app/api/[...path]/route.ts  (Next.js catch-all proxy)
           │
           ▼ proxied to http://127.0.0.1:3000
  server.js  (Express API server, port 3000)
           │
           ├── /api/auth/*
           ├── /api/users/*
           ├── /api/candidates/*
           └── /api/ai/*
                    │
                    ├── sql.js (SQLite DB — recruitment.db)
                    └── groq-sdk (AI features)
```

---

## Root Files

| File | Purpose |
|------|---------|
| `server.js` | Main Express server (port 3000). Mounts all API routes from the mini-service, serves Next.js standalone output. |
| `next.config.ts` | Next.js config — `output: "standalone"`, build errors ignored. |
| `package.json` | Root package — scripts for dev, build, db, qa. |
| `tailwind.config.ts` | Tailwind CSS configuration. |
| `tsconfig.json` | TypeScript config. |
| `postcss.config.mjs` | PostCSS config for Tailwind. |
| `components.json` | shadcn/ui component registry config. |
| `eslint.config.js` | ESLint flat config. |
| `.env` | Environment variables (DB path, JWT secret, Groq API key, etc.). |

---

## Directory Structure

```
Sperton ATS/
│
├── server.js                        # Root Express server — entry point for production
│
├── src/                             # Next.js application
│   ├── app/
│   │   ├── layout.tsx               # Root layout
│   │   ├── page.tsx                 # Redirects → /portal/index.html
│   │   ├── globals.css              # Global styles
│   │   └── api/
│   │       ├── [...path]/
│   │       │   └── route.ts         # Catch-all proxy → Express backend
│   │       ├── ai/
│   │       │   ├── analyze/         # (route stub)
│   │       │   └── outreach/        # (route stub)
│   │       ├── auth/
│   │       │   ├── login/           # (route stub)
│   │       │   └── me/              # (route stub)
│   │       ├── candidates/          # (route stub)
│   │       └── stats/               # (route stub)
│   ├── components/
│   │   └── ui/                      # shadcn/ui components (40+ components)
│   │       ├── button.tsx
│   │       ├── dialog.tsx
│   │       ├── table.tsx
│   │       └── ...                  # accordion, badge, card, chart, form, etc.
│   ├── hooks/
│   │   ├── use-mobile.ts            # Responsive breakpoint hook
│   │   └── use-toast.ts             # Toast notification hook
│   └── lib/
│       ├── db.ts                    # Prisma client instance
│       └── utils.ts                 # Utility helpers (cn, etc.)
│
├── public/                          # Static assets served by Next.js
│   ├── logo.svg
│   ├── robots.txt
│   └── portal/                      # Static frontend SPA
│       ├── index.html               # Main portal UI
│       ├── css/
│       │   └── style.css            # Portal styles
│       └── js/
│           └── app.js               # Portal app logic (auth, candidates, AI, etc.)
│
├── mini-services/
│   └── recruitment-portal/          # Self-contained Express service
│       ├── index.js                 # Standalone server entry (mirrors server.js)
│       ├── package.json             # Service-level dependencies
│       ├── qa_test.js               # QA / integration test runner
│       ├── artifacts/
│       │   └── qa-report.json       # Latest QA test report
│       ├── data/
│       │   ├── recruitment.db       # SQLite database (sql.js)
│       │   └── resumes/             # Uploaded PDF resumes (UUID-named)
│       └── src/
│           ├── config/
│           │   ├── database.js      # sql.js DB init, schema, helper functions
│           │   └── seed.js          # Seed script — creates admin + sample data
│           ├── middleware/
│           │   └── auth.js          # JWT auth middleware + adminOnly guard
│           ├── routes/
│           │   ├── auth.js          # POST /api/auth/login, GET /api/auth/me
│           │   ├── users.js         # User management (admin only)
│           │   ├── candidates.js    # CRUD + resume upload for candidates
│           │   └── ai.js            # AI analyze + outreach generation (Groq)
│           └── utils/
│               ├── groq.js          # Groq SDK wrapper (LLM calls)
│               └── resumeStorage.js # PDF resume save/read/delete helpers
│
├── prisma/
│   └── schema.prisma                # Prisma schema (SQLite, placeholder models)
│
└── scripts/
    ├── copy-standalone.js           # Post-build: copies Next.js standalone output
    ├── reset-portal-admin.js        # Resets admin password in the SQLite DB
    └── seed-sample-candidates.js    # Seeds sample candidate records
```

---

## API Routes (Express)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/health` | None | Service health + candidate count |
| `POST` | `/api/auth/login` | None | Login, returns JWT |
| `GET` | `/api/auth/me` | JWT | Current user info |
| `GET` | `/api/users` | Admin | List all users |
| `POST` | `/api/users` | Admin | Create user |
| `PUT` | `/api/users/:id` | Admin | Update user |
| `DELETE` | `/api/users/:id` | Admin | Delete user |
| `GET` | `/api/candidates` | JWT | List candidates (filterable) |
| `POST` | `/api/candidates` | JWT | Create candidate + resume upload |
| `GET` | `/api/candidates/:id` | JWT | Get candidate detail |
| `PUT` | `/api/candidates/:id` | JWT | Update candidate |
| `DELETE` | `/api/candidates/:id` | Admin | Delete candidate |
| `POST` | `/api/ai/analyze` | JWT | AI analysis of a candidate resume |
| `POST` | `/api/ai/outreach` | JWT | Generate outreach email via AI |

---

## Database (sql.js / SQLite)

File: `mini-services/recruitment-portal/data/recruitment.db`

Core tables (managed by `src/config/database.js`):

- **users** — `id, username, password_hash, role, email, created_at`
- **candidates** — `id, name, email, phone, position, status, resume_path, notes, created_at, updated_at`

> Prisma (`prisma/schema.prisma`) has placeholder `User` and `Post` models but is not used for recruitment logic.

---

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `next` | React framework, routing, API proxy |
| `express` | HTTP server for the recruitment API |
| `sql.js` | In-memory SQLite with file persistence |
| `jsonwebtoken` | JWT auth tokens |
| `groq-sdk` | AI resume analysis + outreach (LLM) |
| `@prisma/client` | ORM (placeholder, not used for core logic) |
| `@radix-ui/*` | Headless UI primitives (shadcn/ui) |
| `tailwindcss` | Utility-first CSS |
| `zod` | Schema validation |
| `react-hook-form` | Form state management |
| `@tanstack/react-query` | Server state / data fetching |
| `recharts` | Charts / analytics UI |
| `framer-motion` | Animations |

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Next.js dev server on port 3000 |
| `npm run build` | Next.js build + copy standalone |
| `npm start` | Production server via `server.js` |
| `npm run qa:portal` | Run portal QA tests |
| `npm run db:push` | Prisma DB push |
| `npm run db:migrate` | Prisma migrations |
| `node scripts/reset-portal-admin.js` | Reset admin credentials |
| `node scripts/seed-sample-candidates.js` | Seed sample candidates |
