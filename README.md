# Sperton Recruitment Portal (Assessment Submission)

This project is a simplified but functional full-stack recruitment portal built for the Sperton practical assignment.

It includes:
- Candidate management (list, add, update status)
- Candidate profile with evaluation parameters
- Basic authentication
- Persistent storage
- Optional AI features (Groq) for analysis and outreach

## Assignment requirements coverage

Implemented items from the assignment:

- Backend API with candidate endpoints:
	- List candidates
	- Add candidate
	- Update candidate status
- Frontend consuming the API:
	- Candidate list with filtering/search
	- Candidate profile/detail view
	- Evaluation parameters (technical, experience, culture-fit/overall scoring)
- Persistent storage (SQLite)
- Basic authentication (JWT-based)
- Mock/seed data support

## Tech stack

- Frontend: Next.js + React (plus portal UI assets)
- Backend API: Node.js + Express
- Database: SQLite
- Auth: JWT
- Optional AI: Groq SDK

## Run in 30 seconds

Prerequisite: Node.js installed.

1. Install dependencies

```bash
npm install
```

2. Create env file (for AI features)

```bash
copy .env.example .env
```

Then add your Groq key inside `.env`:

```env
GROQ_API_KEY=your_groq_api_key_here
```

3. (Optional but recommended) reset admin account

```bash
node scripts/reset-portal-admin.js
```

Default login:
- Username: `admin`
- Password: `123456`

4. (Optional) seed sample candidates

```bash
node scripts/seed-sample-candidates.js
```

5. Start the app

```bash
npm start
```

The app runs on:
- `http://localhost:3000`
- Main portal path: `http://localhost:3000/portal`

## Environment variables

Use `.env.example` as the template and keep real values in `.env`.

```env
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile
JWT_SECRET=any_random_text_here
```

Behavior without Groq key:
- Core portal features continue to work.
- AI endpoints/features require `GROQ_API_KEY`.

## Production priorities (short answer)

If promoted beyond assignment scope, top priorities would be:

1. Stronger security controls
- Secret management (vault/secret manager), key rotation, strict CORS, rate limiting, audit logging.

2. Scalability and reliability
- Move from SQLite to managed Postgres, add caching, background workers for long AI tasks, and horizontal API scaling.

3. Better access control
- Role-based and permission-based authorization with least-privilege policies.

4. Observability
- Centralized structured logs, error tracking, metrics, and alerting.

## Security and scalability risks (short answer)

Main risks in a portal like this:

- Credential/key leakage from poor secret handling
- Overly broad auth permissions
- API abuse without throttling/rate limiting
- Single-node bottlenecks (database and API)
- Large file upload handling and storage growth

## ATS integration approach (short answer)

Recommended architecture for external ATS integration:

1. Integration layer
- Add a dedicated adapter/service module per ATS provider.

2. Unified internal model
- Map ATS-specific fields into one canonical internal candidate schema.

3. Sync strategy
- Use webhook-first updates when available; fall back to scheduled polling.

4. Resilience
- Idempotent sync jobs, retries with backoff, dead-letter queue for failed syncs.

5. Security
- Store provider credentials in secure secret storage and sign/verify webhook payloads.