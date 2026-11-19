# ATA Sports Live — setup and editing plan

## Objective

Adopt the existing `sergems/atasportslive` repository as the working ATA Sports Live web project, keep its current React/Vite + Express + WebSocket architecture, connect it to the project-scoped managed database, and leave the code ready for the next requested product edits.

## Implementation approach

- Preserve the existing pnpm workspace and lockfile rather than replacing the stack with a starter.
- Run the React/Vite frontend from `artifacts/ata-platform` on the Webdev preview port and keep its existing relative `/api`, `/uploads`, and `/ws` proxy paths.
- Run the Express API from `artifacts/api-server` on its separate local listener, with `DATABASE_URL` supplied by the managed project environment and a generated development-only `SESSION_SECRET` supplied only to the local process.
- Use the existing Drizzle schema in `lib/db/src/schema/` as the source of truth with Drizzle PostgreSQL builders and `pg`. The production target is the existing Linode PostgreSQL database; future schema changes must be additive and reviewed because it contains real data.
- Keep the existing ATA Sports Live visual language and component system. No visual redesign or feature assumptions are introduced until the user specifies the first edit.
- Maintain `artifacts/ata-platform/public/manus-routes.json` whenever a page route is added or removed.

## Project structure

- `artifacts/ata-platform/`: React frontend, Vite configuration, page components, layouts, UI primitives, assets, and the route manifest.
- `artifacts/api-server/`: Express 5 API, authentication, WebSocket server, cron jobs, uploads, and route handlers.
- `lib/db/`: Drizzle ORM connection, schema definitions, and database commands.
- `lib/api-client-react/`: generated API client and fetch utilities shared by the frontend.
- `lib/api-zod/` and `lib/api-spec/`: API validation and OpenAPI-related contracts.
- `attached_assets/`: existing project assets and database backup artifacts supplied by the repository.
- `Dockerfile` and `docker-compose.yml`: repository deployment references; local sandbox setup uses managed Webdev services instead of Docker.

## Design and interaction direction

The existing ATA Sports Live interface is the design reference: a dark, information-dense sports streaming and betting experience with strong brand imagery, high-contrast status colors, compact dashboards, and role-based navigation. Preserve that system for edits, favoring clear live/upcoming/ended states, responsive layouts, and fast feedback for financial and streaming actions. Use the existing typography, Tailwind tokens, assets, and Radix-based UI components unless a future request explicitly changes the visual direction.

## Database and safety constraints

The managed database is project-scoped and shared by development and published deployments. The initial setup must not delete or overwrite existing records. Schema work should use deterministic, reviewable Drizzle changes; destructive SQL requires explicit approval after stating what data would be lost.

## Current setup outcomes

The cloned source is copied into the managed project directory at `/home/ubuntu/atasports`. The PostgreSQL persistence layer, Drizzle dialect, `pg` driver, PostgreSQL cron queries, settings route, and mailer are restored for the Linode deployment target. The API production bundle and frontend production bundle build successfully. No production database was contacted or modified.
