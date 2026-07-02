# Advanced Talent Agency (ATA) Platform

A full-stack sports streaming & P2P betting exchange platform targeting the Ugandan market (Kampala). Features live stream access (wallet-gated, pay-per-view), P2P betting with a 10% brokerage fee, and integrated mobile money/crypto payments.

## Stack

- **Monorepo**: pnpm workspaces
- **Frontend**: React 19 + Vite + Tailwind CSS v4 + TanStack Query + Wouter + Zustand (`artifacts/ata-platform`, port 5000)
- **Backend**: Node.js + Express 5 + WebSockets (`artifacts/api-server`, port 8080)
- **Database**: PostgreSQL (Replit managed) + Drizzle ORM (`lib/db`)
- **API Contract**: OpenAPI spec (`lib/api-spec`) → Orval generates React hooks + Zod schemas (`lib/api-client-react`)

## How to Run

Both workflows start automatically:
- **Frontend** (`artifacts/ata-platform: web`): `pnpm --filter @workspace/ata-platform run dev`
- **API Server** (`artifacts/api-server: API Server`): `pnpm --filter @workspace/api-server run dev`

## Environment Variables

| Key | Source | Purpose |
|---|---|---|
| `DATABASE_URL` | Replit managed | PostgreSQL connection string |
| `SESSION_SECRET` | Replit Secret | JWT signing key |
| `PORT` | Workflow config | Server port (8080 for API, 5000 for frontend) |

## Database

Schema is defined in `lib/db/src/schema/` (Drizzle). The initial schema was applied from `dt.sql`. To push schema changes: `pnpm --filter @workspace/db run push` (requires a TTY — run from the Shell tab, not a workflow).

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
