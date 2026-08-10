FROM node:24.14.1-alpine@sha256:8510330d3eb72c804231a834b1a8ebb55cb3796c3e4431297a24d246b8add4d5

RUN apk add --no-cache libc6-compat && \
    corepack enable && corepack prepare pnpm@10.25.0 --activate

WORKDIR /app

COPY docker/migrator/package.json docker/migrator/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

WORKDIR /app/libs/pg-dao
COPY libs/pg-dao/src ./src
COPY libs/pg-dao/scripts ./scripts
COPY docker/migrator/prisma.config.ts ./prisma.config.ts
COPY docker/migrator/entrypoint.sh /usr/local/bin/ray-migrator

RUN chmod 0555 /usr/local/bin/ray-migrator && \
    chown -R node:node /app

USER node
ENTRYPOINT ["ray-migrator"]
CMD ["migrate"]
