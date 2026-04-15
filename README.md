# Sperton Recruitment Portal

Simplified full-stack recruitment portal.

## What this project includes

- Candidate management: list, add, edit, update status
- Candidate profile view with evaluation scoring
- Basic authentication (admin/recruiter)
- Persistent local database (SQLite via sql.js)
- Dashboard and hiring pipeline stats
- Resume upload/download support

## Assignment coverage

This implementation covers the requested scope:

- Backend endpoints for:
	- list candidates
	- add candidate
	- update candidate status
- Frontend consuming backend APIs with:
	- searchable/filterable candidate list
	- candidate detail/profile screen
	- at least 3 evaluation parameters (technical, experience, culture fit)
- Persistent data storage
- Basic access control
- Local runnable setup with clear README instructions

## Tech stack

- Frontend: Next.js + React
- Backend: Node.js + Express
- Database: SQLite (sql.js)
- Auth: JWT + API key fallback support

## Run locally

Prerequisite: Node.js installed.

1. Install dependencies

```bash
npm install
```

2. Start application

```bash
npm start
```

3. Open portal

```text
http://localhost:3000/portal
```

## Login

- Username: admin
- Password: 123456

## Main API routes (used by frontend)

- POST /api/auth/login
- GET /api/candidates
- POST /api/candidates
- PUT /api/candidates/:id
- GET /api/candidates/:id
- GET /api/stats

## Notes

- The database file is stored at mini-services/recruitment-portal/data/recruitment.db.
- The start command builds and runs the app through npm start.

