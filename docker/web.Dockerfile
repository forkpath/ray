# ─── web: runtime-only image ────────────────────────────────────────
# Build artifacts are produced on the host via `nx run web:build`
# and then copied into this lightweight image.
#
# TanStack Start + Nitro (node-server preset) bundles everything
# into dist/apps/web/ — no npm install needed at runtime.
# ────────────────────────────────────────────────────────────────────
FROM node:24.14.1-alpine@sha256:8510330d3eb72c804231a834b1a8ebb55cb3796c3e4431297a24d246b8add4d5

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

COPY dist/apps/web ./

EXPOSE 3000
USER node
CMD ["node", "server/index.mjs"]
