---
name: Artifact Frontend Port
description: The ata-platform artifact workflow has waitForPort locked to 23218 — Vite must listen on this port or the proxy returns 502.
---

# Artifact Frontend Port

**Rule:** Vite must listen on port **23218**, not 5000.

**Why:** The `artifacts/ata-platform: web` workflow is artifact-managed (cannot be reconfigured by the agent). Its `waitForPort` is hardcoded to 23218 by the platform. Replit's reverse proxy routes the external dev URL to `localhost:23218`. If Vite listens on any other port (e.g. 5000), the proxy returns HTTP 502 and the UI shows "Your app is starting..." indefinitely.

**How to apply:** `vite.config.ts` reads `Number(process.env.PORT) || 23218`. The `PORT` env var is set to 8080 for the API server; the frontend defaults to 23218. Never change the Vite port back to 5000 hardcoded.

**API server port:** `artifacts/api-server: API Server` artifact workflow has `waitForPort: 8080`. `PORT=8080` is set in shared env. The Vite proxy points to `http://localhost:8080`.
