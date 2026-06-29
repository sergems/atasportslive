---
name: DB Schema Gotchas
description: Important notes about applying schema changes in this project
---

# DB Schema Gotchas

## drizzle-kit push requires TTY
`pnpm --filter @workspace/db run push` fails in non-interactive environments (no TTY).

**How to apply schema changes:** Run SQL directly via psql:
```bash
psql "$DATABASE_URL" << 'SQL'
ALTER TABLE ...;
CREATE TABLE IF NOT EXISTS ...;
SQL
```

**Why:** drizzle-kit push prompts for confirmation interactively and hangs/fails without a TTY.

## Schema files live in lib/db/src/schema/
After adding a new schema file, export it from `lib/db/src/schema/index.ts`.

## bcrypt must be in onlyBuiltDependencies
In `pnpm-workspace.yaml`, bcrypt must be listed under `onlyBuiltDependencies` (native module requirement).
