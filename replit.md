# ATA Platform

Africa's sports streaming platform — live betting, livestreams, events, and e-commerce.

## Stack

- **Frontend**: React 19 + Vite 7 + Tailwind CSS 4 (in `artifacts/ata-platform/`)
- **Backend**: Node.js + Express 5 + WebSockets (in `artifacts/api-server/`)
- **Database**: PostgreSQL via Drizzle ORM (in `lib/db/`)
- **Auth**: Google OAuth + JWT
- **Monorepo**: pnpm workspaces

## How to run

Two workflows run in parallel (configured in `.replit`):

- **Start application** — `PORT=5000 pnpm --filter @workspace/ata-platform dev` → frontend on port 5000
- **API Server** — `PORT=8080 pnpm --filter @workspace/api-server dev` → backend on port 8080

The Vite dev server proxies `/api`, `/uploads`, and `/ws` to the API server at port 8080.

## Environment variables

All set in `.replit` `[userenv.shared]` or as Replit Secrets:

| Variable | Where | Notes |
|---|---|---|
| `SESSION_SECRET` | Secret | JWT signing key |
| `DATABASE_URL` | Runtime-managed | Replit built-in PostgreSQL |
| `GOOGLE_CLIENT_ID` | Shared env | Google OAuth client ID |
| `NODE_ENV` | Shared env | `development` |
| `ATA_SYSTEM_USER_ID` | Shared env | System user ID (default `1`) |

## Key directories

```
artifacts/
  ata-platform/   React frontend
  api-server/     Express backend
lib/
  db/             Drizzle schema & migrations
  api-zod/        Shared Zod validation schemas
  api-client-react/  Generated API client
scripts/          Utility scripts (seed, etc.)
deploy/           Docker/Nginx config & .env.example
```

## User preferences

- Keep existing monorepo structure and pnpm workspace layout
- Apply DB schema changes directly via `psql "$DATABASE_URL"` (drizzle-kit push requires TTY and hangs non-interactively)
