# Advanced Talent Agency (ATA)

A full-stack sports streaming and P2P betting exchange platform for Kampala, Uganda. Users watch live Pool and Boxing matches ($1.50/day, wallet-gated) and bet peer-to-peer with a 10% brokerage fee.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at `/api`)
- `pnpm --filter @workspace/ata-platform run dev` — run the frontend (proxied at `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts run seed` — seed demo data (idempotent)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET` — session signing secret

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + WebSocket (ws)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Frontend: React + Vite, Tailwind CSS v4, TanStack Query, Wouter, Zustand, Recharts

## Where things live

- `artifacts/api-server/src/routes/` — all Express route files
- `artifacts/api-server/src/routes/index.ts` — route registration
- `artifacts/api-server/src/index.ts` — HTTP + WebSocket server entry
- `artifacts/ata-platform/src/App.tsx` — all frontend routes
- `artifacts/ata-platform/src/pages/` — all page components
- `artifacts/ata-platform/src/lib/auth-store.ts` — Zustand auth store (JWT token + user)
- `lib/db/` — Drizzle schema and client
- `lib/api-spec/` — OpenAPI spec (source of truth for API contracts)
- `lib/api-client-react/src/generated/` — generated React Query hooks and Zod schemas

## Architecture decisions

- Contract-first API: OpenAPI spec in `lib/api-spec` drives both server validation (Zod) and client hooks (Orval codegen)
- JWT auth: tokens stored in Zustand with `persist` middleware (localStorage), passed as Bearer tokens
- WebSocket notifications: authenticated via `?userId=` query param on connect; server broadcasts to specific user rooms
- Wallet-gated streaming: `POST /api/streams/:id/access` charges $1.50 from wallet balance, returns 24h access token
- P2P betting exchange: open bets matched at same odds; 10% brokerage taken from winnings on settlement

## Product

- **Home** — hero landing with live/upcoming event previews
- **Streams** — browse Pool and Boxing live streams; $1.50/day paywall; HLS playback via hls.js
- **Games / Betting** — P2P betting exchange; place/match bets on Pool and Boxing matches
- **Wallet** — MTN MoMo / Airtel Money / BTC deposits and withdrawals; transaction history
- **Dashboard** — user stats, active bets, recent activity
- **Notifications** — real-time WebSocket notifications
- **Admin** — user management, stream management, game management, wallet approvals, reports

## Demo accounts

- Admin: `admin@ata.ug` / `admin123`
- User: `demo@ata.ug` / `demo123`

## Replit setup

- Database schema applied from `database.sql` on initial setup (Replit's built-in PostgreSQL)
- `DATABASE_URL` and `PGHOST/PGUSER/PGPASSWORD/PGDATABASE` are runtime-managed by Replit — do not set manually
- `SESSION_SECRET` is stored as a Replit Secret ✓
- SMTP vars (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `NOTIFY_EMAIL`) are optional — email is silently skipped when absent
- Two workflows: **ATA Platform** (port 5000, frontend) and **API Server** (port 8080, backend)

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `bcrypt` must be in `onlyBuiltDependencies` in `pnpm-workspace.yaml` (native module)
- `zustand` and `hls.js` are in the pnpm catalog; must be explicitly listed in ata-platform devDependencies
- Never use `console.log` in server code — use `req.log` in handlers, `logger` singleton elsewhere
- Run `pnpm --filter @workspace/api-spec run codegen` after any OpenAPI spec change before editing frontend

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
