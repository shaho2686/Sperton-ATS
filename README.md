# Sperton Recruitment Portal

This is a recruitment portal for managing job candidates and tracking them through the hiring pipeline. It's built to work locally on your computer without needing any extra setup or cloud services.

You can log in, see a list of all candidates, click on each one to see their details, add new candidates, update their status, and even use AI to help score candidates and write outreach messages.

## What's included

### Core features

- **Candidate list** — Search, filter, and browse all candidates
- **Add candidates** — Quickly add new people to the system
- **Update status** — Move candidates through the pipeline (Applied, Screening, Interview, Offer, Hired, Rejected)
- **Candidate details** — View full profile with notes, scores, position, market segment, and resume
- **Admin login** — Simple username/password protection
- **Data storage** — Everything saves to a local database (no cloud needed)

### Bonus features I added

- Multiple admin and recruiter users
- Resume upload and download
- AI-powered candidate scoring and feedback
- AI-generated email outreach templates
- Dashboard with hiring stats and summaries
- Avatar profile pictures
- Automated testing script for the core workflows

## What technology I used and why

**Backend: Node.js and Express** — JavaScript on the server side. It's fast, easy to understand, and great for building APIs. Express is a lightweight web framework that handles all the routes (GET, POST, PUT, DELETE).

**Frontend: Plain HTML, CSS, and JavaScript** — No heavy build tools or frameworks. Just vanilla code that's easy to read and modify. This makes it transparent what the UI is doing and helps reviewers understand the logic quickly.

**Storage: SQLite** — A simple, lightweight database that works locally without needing PostgreSQL or any external service. Everything saves to a file automatically. Perfect for a self-contained project that works on any computer.

**Authentication: JWT tokens** — When you log in, the system gives you a token. Future requests include that token to prove you're logged in. It's stateless (the server doesn't need to remember anything) and simple to implement.

**AI (optional): Groq API** — If you provide an API key, you can use Groq to automatically analyze candidates and generate email drafts. If you don't provide the key, the system works fine without it.

## How to run this locally

**You need:** Node.js installed on your computer

### Step 1: Install

Open a terminal in the project folder and run:

```bash
npm install
```

This downloads all the code dependencies.

### Step 2: Set up the admin account

```bash
node scripts/reset-portal-admin.js
```

This creates your default login:
- **Username:** `admin`
- **Password:** `123456`

### Step 3: Add sample candidates

```bash
node scripts/seed-sample-candidates.js
```

This loads 6 example candidates into the database so you have data to see.

### Step 4: Start the server

```bash
npm start
```

The server will start on `http://localhost:3000`. Open this URL in your browser and go to `/portal`.

### Step 5: Log in

Use the credentials from Step 2 (admin / 123456) and start exploring.

## Optional: Add AI features

If you want the AI candidate scoring and outreach features to work, create a `.env` file in the root with:

```env
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile
JWT_SECRET=any_random_text_here
```

Without this, the portal works fine—AI features just won't be available.

## How this scales to production

This system is intentionally kept simple for the assessment, but it's built with a clean foundation that can grow.

**What we have now (works great for small teams):**
- Simple candidate storage and status tracking
- Basic login and permissions
- Fast local setup with no dependencies

**To scale this to production (for larger teams and more candidates):**

1. **Database:** Move from local SQLite to PostgreSQL or similar. This lets many users work at the same time without conflicts.

2. **Architecture:** Separate the frontend, API, and database onto different servers. This way each can grow independently if needed.

3. **Background jobs:** Move slow tasks (AI analysis, sending emails, generating reports) to run in the background instead of while users wait. Use a job queue like Bull or RabbitMQ.

4. **Storage:** Move resume files from local disk to cloud storage (S3, Azure Blob, Google Cloud). This scales better and is more reliable.

5. **Caching:** Add Redis to cache frequently accessed data so the database isn't slammed.

6. **Permissions:** Today it's simple admin/recruiter roles. Production needs fine-grained permissions (who can see what, who can do what).

7. **Integrations:** An ATS needs to sync with other systems like email, calendars, and job boards. The current structure already separates integrations nicely so they can be added cleanly.

8. **Monitoring & logs:** Add tools to track errors, performance, and user actions. This helps catch problems early.

**The good news:** The code is already structured to support all this. The API layer is separate from the UI. The database layer is separate from the business logic. Adding these production features doesn't mean starting over—it means upgrading each piece when needed.