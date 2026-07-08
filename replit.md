# Advanced Talent Agency (ATA) Platform

A full-stack sports streaming & P2P betting exchange platform targeting the Ugandan market (Kampala). Features live stream access (wallet-gated, pay-per-view), P2P betting with a 10% brokerage fee, and integrated mobile money/crypto payments.

## Stack

- **Monorepo**: pnpm workspaces
- **Frontend**: React 19 + Vite + Tailwind CSS v4 + TanStack Query + Wouter + Zustand (`artifacts/ata-platform`, port 5000)
- **Backend**: Node.js + Express 5 + WebSockets (`artifacts/api-server`, port 8080)
- **Database**: PostgreSQL (Replit managed) + Drizzle ORM (`lib/db`)
- **API Contract**: OpenAPI spec (`lib/api-spec`) → Orval generates React hooks + Zod schemas (`lib/api-client-react`)

## How to Run

Both workflows start automatically (configured as plain Replit workflows in this environment — artifact-managed `.toml` services are not registered here):
- **Start application** (frontend, port 5000, webview): `PORT=5000 BASE_PATH=/ pnpm --filter @workspace/ata-platform run dev`
- **API Server** (port 8080, console): `pnpm --filter @workspace/api-server run dev`

Note: `artifacts/ata-platform/vite.config.ts` defaults to port 23218 when `PORT` is unset (leftover from a prior artifact-managed setup); the workflow above overrides it to 5000, which is required for the Replit webview.

## Environment Variables

| Key | Source | Purpose |
|---|---|---|
| `DATABASE_URL` | Replit managed | PostgreSQL connection string |
| `SESSION_SECRET` | Replit Secret | JWT signing key |
| `PORT` | Workflow config | Server port (8080 for API, 5000 for frontend) |

## Database

Schema is defined in `lib/db/src/schema/` (Drizzle). The initial schema and seed data were applied from `gktp.sql` via psql, stripping the `\restrict`/`\unrestrict` control lines: `grep -v "^\\\\restrict\|^\\\\unrestrict" gktp.sql | psql "$DATABASE_URL"`. To push schema changes: `pnpm --filter @workspace/db run push` (requires a TTY — run from the Shell tab, not a workflow).

> ⚠️ **`gktp.sql` (and files under `attached_assets/`) may contain real user PII and API tokens** from the original deployment. Do not commit them to a public repository or share them. Rotate any API tokens they reference, and consider removing these dumps from the repo once the database has been restored.

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
