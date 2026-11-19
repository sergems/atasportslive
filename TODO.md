# ATA Sports Live setup outcomes

## Source is adopted into the managed Webdev project

- The existing `sergems/atasportslive` source is available in the managed project directory at `/home/ubuntu/atasports`.
- The existing monorepo layout, source files, assets, package manager, and lockfile are preserved.
- The Webdev project has managed server and database capabilities enabled.

Status: complete.

## The locked dependency environment is reproducible

- The project uses the repository’s Docker-compatible pnpm setup and a frozen lockfile with PostgreSQL dependencies.
- The committed workspace policy explicitly allows only the native dependency build scripts required by this repository.
- `pnpm install --frozen-lockfile` completes successfully.

Status: complete.

## The managed database is ready for the current application schema

- The production target is PostgreSQL through `DATABASE_URL`.
- The current Drizzle schema in `lib/db/src/schema/` uses PostgreSQL builders and enums.
- The API database package uses `pg` and `drizzle-orm/node-postgres`.

Status: prepared for safe production deployment. No Linode production data was contacted or modified during this task.

## The frontend preview and API are runnable together

- The API listens on its local service port with a development-only session secret.
- The frontend listens on the configured Webdev preview port and keeps its existing API, uploads, and WebSocket proxy paths.
- `GET /api/healthz` returns a successful health response.
- `GET /manus-routes.json` returns the complete page route manifest rather than SPA fallback HTML.

Status: complete for startup verification. The API health endpoint returns HTTP 200 on port 8080, the Vite preview returns HTTP 200 on port 23218, and `/manus-routes.json` is served as JSON.

## Every business endpoint is PostgreSQL-compatible

- The original PostgreSQL route/query behavior is restored, including `.returning()`, PostgreSQL conflict clauses/casts, and PostgreSQL raw-result handling.
- The API package typecheck is clean.
- The API production bundle and frontend production bundle build successfully.

Status: complete for code/build validation. Production deployment still requires a database backup and a controlled Linode rollout.

## The next product edit is defined before implementation

- The user provides the first requested functional or visual change.
- The edit is scoped against the existing frontend, API, and schema structure before code changes are made.

Status: pending user direction.
