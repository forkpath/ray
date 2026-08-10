# ─── engine: runtime-only image ─────────────────────────────────────
# Build artifacts + pruned lockfile are produced on the host:
#   `pnpm nx run engine:package` → bundle + lockfile in dist/services/engine/
#
# Using pnpm (same as the monorepo) avoids npm/pnpm peer-dep mismatch.
# ────────────────────────────────────────────────────────────────────
FROM node:24.14.1-alpine@sha256:8510330d3eb72c804231a834b1a8ebb55cb3796c3e4431297a24d246b8add4d5

RUN apk add --no-cache libc6-compat && \
    corepack enable && corepack prepare pnpm@10.25.0 --activate

WORKDIR /app

ENV NODE_ENV=production
ENV ENGINE_PORT=8000

COPY .npmrc ./
COPY dist/services/engine ./
COPY libs/i18n/src/translations ./libs/i18n/src/translations

RUN pnpm install --frozen-lockfile --prod

EXPOSE 8000
USER node
CMD ["node", "main.js"]
