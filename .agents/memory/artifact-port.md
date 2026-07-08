---
name: Artifact Frontend Port
description: The ata-platform artifact workflow has waitForPort locked to 23218 — Vite must listen on this port or the proxy returns 502.
---

# Artifact Frontend Port

**Rule:** Vite must listen on port **23218**, not 5000 — but only when the platform's artifact-management system is actually active for this project.

**Why:** The `artifacts/ata-platform: web` workflow is artifact-managed (cannot be reconfigured by the agent) in environments where the platform recognizes the pre-existing `artifact.toml` files. Its `waitForPort` is hardcoded to 23218 by the platform in that case. Replit's reverse proxy routes the external dev URL to `localhost:23218`. If Vite listens on any other port there, the proxy returns HTTP 502.

**How to apply:** `vite.config.ts` reads `Number(process.env.PORT) || 23218`, defaulting to 23218 when PORT is unset. The `PORT` env var is set to 8080 for the API server; the frontend defaults to 23218 unless overridden.

**Re-import caveat:** On a fresh GitHub re-import, the project's `artifacts/` skill can report "this project only supports mockup-sandbox" and no managed `artifacts/*` workflows exist (`WorkflowsRestart`/`configureWorkflow` under those names fails). In that case, treat it as a plain pnpm monorepo instead: create a standard `configureWorkflow` webview workflow on port 5000, overriding Vite's port explicitly (e.g. `PORT=5000 pnpm --filter @workspace/ata-platform run dev`), and a separate console workflow for the API server on 8080. Don't try to force port 23218 through `configureWorkflow` — it isn't in the supported port list.

**API server port:** the API server listens on 8080 (`PORT=8080`), reverse-proxied by Vite's dev server (`/api`, `/uploads`, `/ws`) to `http://localhost:8080` regardless of which workflow system is active.
