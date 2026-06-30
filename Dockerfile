# =============================================================================
# ATA Platform — Multi-stage Dockerfile
# Node.js 24 slim  |  pnpm 11.8.0  |  Express 5.x
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1 — base: Node 24 slim + pnpm 11.8.0
# -----------------------------------------------------------------------------
FROM node:24-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@11.8.0 --activate

# -----------------------------------------------------------------------------
# Stage 2 — deps: install full workspace dependencies
# -----------------------------------------------------------------------------
FROM base AS deps
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY lib/db/package.json                lib/db/
COPY lib/api-spec/package.json          lib/api-spec/
COPY lib/api-zod/package.json           lib/api-zod/
COPY lib/api-client-react/package.json  lib/api-client-react/
COPY scripts/package.json               scripts/
COPY artifacts/api-server/package.json  artifacts/api-server/
COPY artifacts/ata-platform/package.json artifacts/ata-platform/

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# Stage 3 — builder: compile API server + frontend
# -----------------------------------------------------------------------------
FROM deps AS builder
WORKDIR /app
COPY . .

# Build API server (esbuild → artifacts/api-server/dist/index.mjs)
RUN pnpm --filter @workspace/api-server run build

# Build frontend (Vite → artifacts/ata-platform/dist/public)
# PORT and BASE_PATH are validated at vite.config.ts load time even for builds
RUN PORT=3000 BASE_PATH=/ pnpm --filter @workspace/ata-platform run build

# -----------------------------------------------------------------------------
# Stage 4 — native-deps: compile bcrypt native addon in isolation
#            (keeps build tools OUT of the production image)
# -----------------------------------------------------------------------------
FROM node:24-slim AS native-deps
RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /deps
# Install only the packages that esbuild externalises at runtime
RUN npm install --save-exact \
        bcrypt@6.0.0 \
        nodemailer@9.0.1

# -----------------------------------------------------------------------------
# Stage 5 — api: slim production API image
# -----------------------------------------------------------------------------
FROM node:24-slim AS api
WORKDIR /app

# Runtime node_modules (bcrypt compiled binary + nodemailer)
COPY --from=native-deps /deps/node_modules ./node_modules

# Compiled server bundle + pino worker threads
COPY --from=builder /app/artifacts/api-server/dist ./artifacts/api-server/dist

# Persistent volume mount point for user-uploaded files
RUN mkdir -p /app/uploads

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]

# -----------------------------------------------------------------------------
# Stage 6 — nginx: serve frontend static files + reverse-proxy the API
# -----------------------------------------------------------------------------
FROM nginx:alpine AS nginx

COPY --from=builder /app/artifacts/ata-platform/dist/public /usr/share/nginx/html
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
