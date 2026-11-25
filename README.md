# ReachInbox Email Scheduler

Full-stack email scheduler: schedule emails through a REST API or a React dashboard, and a BullMQ worker sends them through Ethereal (fake SMTP) at the exact scheduled time.

- **Frontend:** React + Vite + Tailwind CSS
- **Backend:** Node.js + Express
- **Queue:** BullMQ delayed jobs on Redis (**no cron jobs anywhere**)
- **Email:** Nodemailer + Ethereal (free, nothing is delivered to real inboxes)

## How it works

```
React dashboard --HTTP--> Express API --queue.add(delay)--> Redis (BullMQ)
                                                              |  (job waits in Redis until its time)
                                                              v
                                          BullMQ Worker --Nodemailer--> Ethereal SMTP
```

1. `POST /api/emails` validates the request and adds a BullMQ job with `delay = scheduledAt - now`.
2. Redis stores the job. When the delay expires BullMQ moves it to `waiting` and the worker picks it up. No `cron`, no `setInterval`, no polling loop of ours.
3. The worker sends the email via Nodemailer. If sending throws, BullMQ retries with exponential backoff (configurable attempts and delay).
4. The dashboard polls `GET /api/emails` every 4 seconds.

### Design decisions

- **No MongoDB.** BullMQ already persists job data, state, attempt count, timestamps, return value and failure reason in Redis, which is everything the dashboard needs. A second database would add complexity with no benefit.
- **Persistence.** Delayed jobs live in Redis, not in the Node process. Redis runs with `appendonly yes` and a Docker volume, so jobs survive both backend restarts and Redis restarts. Verified: a job that came due while the backend was down was sent right after restart.
- **Cancelled status.** BullMQ deletes a removed job, so on cancel the API stores a small snapshot in a Redis hash (`reachinbox:<queue>:cancelled`). This keeps the `cancelled` status visible and persistent.
- **`retrying` status.** In addition to the required statuses, a job waiting for its next retry (backoff) is shown as `retrying` so it is not confused with a not-yet-sent `scheduled` job.
- **Secrets.** SMTP credentials exist only in the backend process (`.env` or auto-generated). The frontend never sees them. `.env` is git-ignored; `.env.example` is committed.

## Quick start (Windows PowerShell + Docker Desktop)

Prerequisites: Node.js 18+ (20/22 LTS recommended), Docker Desktop (running).

```powershell
cd reachinbox
powershell -ExecutionPolicy Bypass -File .\setup.ps1   # starts Redis, creates backend\.env, installs everything
npm run dev                                            # starts API (4000) and dashboard (5173)
```

Manual equivalent of `setup.ps1`:

```powershell
docker compose up -d
Copy-Item backend\.env.example backend\.env
npm install
npm --prefix backend install
npm --prefix frontend install
npm run dev
```

Open:
- Dashboard: http://localhost:5173
- Health check: http://localhost:4000/api/health

### Ethereal inbox

Leave `SMTP_USER` and `SMTP_PASS` empty in `backend\.env`. On startup the backend creates a free Ethereal account and prints something like:

```
[mail] Ethereal inbox ready. View sent emails at https://ethereal.email/login
[mail]   user: abc.def@ethereal.email
[mail]   pass: xxxxxxxxxx
```

Each sent email also gets a **preview URL**, visible in the dashboard under *View* > *Open the sent email*. To keep the same inbox between restarts, paste the printed user/pass into `backend\.env`.

## Configuration (`backend/.env`)

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `4000` | API port |
| `CORS_ORIGIN` | `http://localhost:5173,...` | Allowed browser origins (comma-separated) |
| `RUN_WORKER` | `true` | Run the worker inside the API process. Use `false` + `npm run worker` for a separate process |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | `127.0.0.1` / `6379` / empty | Redis connection |
| `QUEUE_NAME` | `email-scheduler` | BullMQ queue name |
| `JOB_ATTEMPTS` | `3` | Default attempts per email (1 = no retry) |
| `JOB_BACKOFF_DELAY_MS` | `5000` | Exponential backoff base: 5s, 10s, 20s... |
| `WORKER_CONCURRENCY` | `5` | Emails sent in parallel |
| `SMTP_HOST` / `SMTP_PORT` | `smtp.ethereal.email` / `587` | SMTP server |
| `SMTP_USER` / `SMTP_PASS` | empty | Empty = auto-create Ethereal account |
| `EMAIL_FROM` | `ReachInbox <no-reply@reachinbox.local>` | Sender |

Attempts and backoff can also be set **per email** in the API body (`attempts`, `backoffDelayMs`) and in the form under *Retry options*.

## Job statuses

| Status | Meaning |
|---|---|
| `scheduled` | Waiting in Redis for its send time |
| `waiting` | Due, queued for a worker |
| `active` | Being sent right now |
| `completed` | Sent successfully |
| `failed` | All attempts failed (see `failedReason`) |
| `cancelled` | Cancelled by the user before sending |
| `retrying` | A previous attempt failed, waiting for the backoff delay |

Only `scheduled`, `waiting` and `retrying` emails can be cancelled.

## API documentation

Base URL: `http://localhost:4000/api`. All bodies are JSON. Success responses are `{ "data": ... }`; errors are `{ "error": "CODE", "message": "...", "details": [...] }`.

### `GET /health`

Returns `200` when Redis is reachable, `503` otherwise.

```powershell
Invoke-RestMethod http://localhost:4000/api/health
```
```json
{ "status": "ok", "service": "reachinbox-backend", "uptimeSeconds": 42, "redis": "up", "worker": "running",
  "queue": { "delayed": 1, "waiting": 0, "active": 0, "completed": 3, "failed": 0 } }
```

### `POST /emails` - schedule an email

| Field | Type | Rules |
|---|---|---|
| `to` | string | required, valid email |
| `subject` | string | required, 1-200 chars |
| `body` | string | required, 1-10000 chars |
| `scheduledAt` | string | required, ISO 8601 **with timezone** (`...Z` or `+05:30`), not more than 60s in the past, max 1 year ahead |
| `attempts` | number | optional, 1-10 |
| `backoffDelayMs` | number | optional, 100-3600000 |

PowerShell:
```powershell
$body = @{
  to          = "test@example.com"
  subject     = "Hello from ReachInbox"
  body        = "This email was scheduled with BullMQ."
  scheduledAt = (Get-Date).AddMinutes(2).ToUniversalTime().ToString("o")
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/emails -ContentType "application/json" -Body $body
```

curl (macOS/Linux/Git Bash):
```bash
curl -X POST http://localhost:4000/api/emails -H "Content-Type: application/json" \
  -d '{"to":"test@example.com","subject":"Hello","body":"Scheduled!","scheduledAt":"2026-12-01T10:00:00Z"}'
```

Response `201`:
```json
{ "data": { "id": "da38c089-df07-42d0-854a-3589150b4ef7", "to": "test@example.com", "subject": "Hello",
  "scheduledAt": "2026-12-01T10:00:00.000Z", "status": "scheduled", "attemptsMade": 0, "maxAttempts": 3,
  "createdAt": "...", "processedAt": null, "finishedAt": null, "failedReason": null, "previewUrl": null, "body": "Scheduled!" } }
```
Errors: `400 VALIDATION_ERROR` (with per-field `details`), `400 INVALID_JSON`, `503 REDIS_UNAVAILABLE`.

### `GET /emails` - list

Optional `?status=scheduled|retrying|waiting|active|completed|failed|cancelled`. Newest first (up to 200 per state).

```powershell
Invoke-RestMethod "http://localhost:4000/api/emails?status=scheduled"
```
Response: `{ "data": [ ... ], "count": 3 }`

### `GET /emails/:id` - inspect

Returns the full job including `body`, `attemptsMade`, `failedReason`, timestamps and (after sending) `messageId` and the Ethereal `previewUrl`.

```powershell
Invoke-RestMethod http://localhost:4000/api/emails/<id>
```
Errors: `404 NOT_FOUND`.

### `DELETE /emails/:id` - cancel

```powershell
Invoke-RestMethod -Method Delete http://localhost:4000/api/emails/<id>
```
Response `200` with `status: "cancelled"`. Errors: `404 NOT_FOUND`, `409 ALREADY_CANCELLED`, `409 NOT_CANCELLABLE` (already sent/sending/failed).

## Testing

**Automated smoke test** (backend must be running):

```powershell
npm run smoke
```

It checks: health, validation (400), scheduling (201), cancel, double-cancel (409), unknown id (404), list, and that a 5-second email reaches `completed`. It prints the Ethereal preview URL at the end.

**Manual tests**

1. *Delayed send:* open the dashboard, schedule an email with *In 1 min*, watch it go `scheduled` > `active` > `completed`, click *View* > *Open the sent email*.
2. *Persistence across restarts:* schedule an email 2 minutes ahead, stop the backend (`Ctrl+C`), start it again with `npm run dev`. The email is still listed and is sent on time. Also try `docker compose restart redis`.
3. *Retries:* set `SMTP_HOST=127.0.0.1` and `SMTP_PORT=1026` (nothing listens there) in `backend\.env`, restart, and schedule an email with *Retry options* (3 attempts, 1000 ms). It goes `retrying` and ends `failed` after 3 attempts, with the error shown in *View*. Restore the SMTP settings afterwards.
4. *Cancel:* schedule an email 1 hour ahead and click *Cancel*; the status becomes `cancelled`.
5. *Validation:* submit a past date or an API call with a bad email; the dashboard shows an error toast.

## Docker / Redis

`docker-compose.yml` runs `redis:7-alpine` with AOF persistence (`appendonly yes`), `noeviction` (required by BullMQ) and a named volume `redis-data`.

```powershell
docker compose up -d      # start
docker compose ps         # check
docker compose logs redis # logs
docker compose down       # stop (data kept in the volume)
docker compose down -v    # stop AND delete all queued jobs
```

## Troubleshooting

| Problem | Fix |
|---|---|
| `docker compose` fails / cannot connect to daemon | Start Docker Desktop and wait until it says "running" |
| `port is already allocated` for 6379 | Another Redis is running. Stop it, or change the left port in `docker-compose.yml` (e.g. `"6380:6379"`) and set `REDIS_PORT=6380` |
| Dashboard shows "Redis is down" | `docker compose up -d` and check `docker compose ps` |
| `[mail] SMTP setup failed ... ENOTFOUND` | No internet access to Ethereal. Check your connection/VPN; it retries on the next email |
| `setup.ps1` blocked by execution policy | Use `powershell -ExecutionPolicy Bypass -File .\setup.ps1` or the manual commands |
| Emails not sending but API works | Check the backend terminal for `[worker]` lines; make sure `RUN_WORKER` is not `false` |

## Project structure

```
reachinbox/
  docker-compose.yml        Redis with persistence
  setup.ps1                 One-shot setup for Windows
  package.json              Root scripts (npm run dev runs backend + frontend)
  backend/
    src/
      config/               env.js, redis.js
      queues/               emailQueue.js (BullMQ Queue)
      workers/              emailWorker.js (BullMQ Worker), standalone.js
      services/             emailService.js (queue logic), mailService.js (Nodemailer/Ethereal)
      controllers/ routes/ middleware/ utils/
      app.js server.js
    scripts/smoke-test.js
    .env.example
  frontend/
    src/
      pages/Dashboard.jsx
      components/           ScheduleForm, JobTable, JobDetails, StatusBadge, Toasts, HealthBadge
      services/api.js
```

## Submitting to GitHub

```powershell
cd reachinbox
git init
git add .
git status                # confirm .env and node_modules are NOT listed
git commit -m "ReachInbox email scheduler"
git branch -M main
git remote add origin https://github.com/<your-username>/reachinbox-email-scheduler.git
git push -u origin main
```

Create the empty repository first on github.com (do not add a README there). If git asks who you are, run `git config --global user.name "Your Name"` and `git config --global user.email "you@example.com"`, then commit again. Submit the repository URL.
