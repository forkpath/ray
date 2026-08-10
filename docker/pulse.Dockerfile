# ─── pulse: runtime-only image ──────────────────────────────────────
FROM node:24.14.1-alpine@sha256:8510330d3eb72c804231a834b1a8ebb55cb3796c3e4431297a24d246b8add4d5

RUN apk add --no-cache libc6-compat && \
    corepack enable && corepack prepare pnpm@10.25.0 --activate

WORKDIR /app

ENV NODE_ENV=production
ENV PULSE_PORT=3001

COPY .npmrc ./
COPY dist/services/pulse ./

RUN pnpm install --frozen-lockfile --prod

EXPOSE 3001
USER node
CMD ["node", "main.js"]
