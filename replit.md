# ATA Sports Live

A sports streaming and peer-to-peer betting platform for African grassroots sports (Pool, Boxing, Darts, FIFA, Chess, Futsal). Built for Kampala, Uganda.

## Architecture

pnpm monorepo with two main services:

| Package | Purpose | Port |
|---|---|---|
| `artifacts/ata-platform` | React 19 + Vite frontend | 5000 |
| `artifacts/api-server` | Node.js + Express API + WebSocket | 8080 |
| `lib/db` | Shared Drizzle ORM schema & client | — |

The frontend proxies `/api`, `/uploads`, and `/ws` to the API server at `localhost:8080`.

## Running on Replit

Two workflows must both be running:

- **Start application** — `PORT=5000 pnpm --filter @workspace/ata-platform dev`
- **API Server** — `PORT=8080 pnpm --filter @workspace/api-server dev` (console, no port check)

> The API Server workflow is configured without `waitForPort` because the Replit platform's port-detection races with the process startup. The server is healthy — confirm with `curl -s http://localhost:8080/api/settings/public`.

## Database

Replit-managed PostgreSQL 16. The schema is managed by Drizzle ORM (`lib/db/src/schema/`).

To apply schema changes:
```bash
psql $DATABASE_URL -f <migration.sql>
# or push via drizzle-kit (requires a TTY — use the Shell tab, not a workflow)
pnpm --filter @workspace/db db:push
```

The initial dataset was imported from `bt.sql` (5 092 users, 12 streams, 2 games).

## Key Environment Variables

| Variable | Source | Notes |
|---|---|---|
| `DATABASE_URL` | Replit-managed | PostgreSQL connection string |
| `SESSION_SECRET` | Replit Secret | Used as JWT secret |
| `GOOGLE_CLIENT_ID` | Shared env var | Google OAuth client |
| `PORT` | Set per-workflow | 5000 (frontend), 8080 (API) |
| `PAWAPAY_API_TOKEN` | Not yet set | Mobile money payments |
| `PESAPAL_CONSUMER_KEY/SECRET` | Not yet set | Pesapal payment gateway |
| SMTP vars | Not yet set | Transactional email |

## Stack

- **Frontend:** React 19, Vite, Tailwind CSS 4, Framer Motion, TanStack Query, Zustand, Wouter
- **Backend:** Node.js (ESM), Express 5, WebSocket (ws), JWT auth, Pino logging, node-cron
- **Database:** PostgreSQL 16, Drizzle ORM
- **Payments:** PawaPay, Pesapal (credentials needed)
- **Package manager:** pnpm (workspace)

## User Preferences

- Keep the existing monorepo structure — do not restructure or migrate.
