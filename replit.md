# Advanced Talent Agency (ATA) Platform

A full-stack sports streaming & P2P betting exchange platform targeting the Ugandan market (Kampala). Features live stream access (wallet-gated, pay-per-view), P2P betting with a 10% brokerage fee, and integrated mobile money/crypto payments.

## Stack

- **Monorepo**: pnpm workspaces
- **Frontend**: React 19 + Vite + Tailwind CSS v4 + TanStack Query + Wouter + Zustand (`artifacts/ata-platform`, port 5000)
- **Backend**: Node.js + Express 5 + WebSockets (`artifacts/api-server`, port 8080)
- **Database**: PostgreSQL (Replit managed) + Drizzle ORM (`lib/db`)
- **API Contract**: OpenAPI spec (`lib/api-spec`) → Orval generates React hooks + Zod schemas (`lib/api-client-react`)

## How to Run

The single **Start application** workflow starts both services in parallel and is supervised so the workflow fails visibly if either process dies (webview, port 5000):
```
(PORT=8080 pnpm --filter @workspace/api-server dev) & (PORT=5000 pnpm --filter @workspace/ata-platform dev) & wait -n; exit $?
```
`PORT` is set per-command above — there is no single global `PORT` value shared by both services.

Note: `artifacts/ata-platform/vite.config.ts` defaults to port 23218 when `PORT` is unset (leftover from a prior artifact-managed setup); the workflow above overrides it to 5000, which is required for the Replit webview.

## Environment Variables

| Key | Source | Purpose |
|---|---|---|
| `DATABASE_URL` | Replit managed | PostgreSQL connection string |
| `SESSION_SECRET` | Replit Secret | JWT signing key |
| `PORT` | Workflow config | Set per-command in the workflow (8080 for API, 5000 for frontend) |
| `GOOGLE_CLIENT_ID` | Replit Secret (optional) | Enables Google Sign-In; without it the API returns 503 for those endpoints and the feature is just hidden |

## Database

Schema is defined in `lib/db/src/schema/` (Drizzle). On a fresh import the database is empty; restore it from the dump in `attached_assets/` via: `psql "$DATABASE_URL" -f attached_assets/ata_db_1783623312620.sql`. To push schema changes going forward: `pnpm --filter @workspace/db run push` (requires a TTY — run from the Shell tab, not a workflow) — or apply SQL directly via `psql "$DATABASE_URL"` if non-interactive.

> ⚠️ **Files under `attached_assets/` (the `.sql` dumps) may contain real user PII and API tokens** from the original deployment. Do not commit them to a public repository or share them. Rotate any API tokens they reference, and consider removing these dumps from the repo once the database has been restored.

## API Code Generation

After changing `lib/api-spec/openapi.yaml`, regenerate client hooks:
```
pnpm --filter @workspace/api-spec run codegen
```

## Key Rules

- Use `req.log` (not `console.log`) in API server code — enforced by convention
- Auth is JWT-based, stored in Zustand with persistence, passed as Bearer tokens
- Streaming is pay-per-view ($1.50/24h); bets take a 10% brokerage fee
- `pnpm-workspace.yaml` enforces `minimumReleaseAge: 1440` (1 day) for supply-chain safety — don't disable it

## User Preferences
