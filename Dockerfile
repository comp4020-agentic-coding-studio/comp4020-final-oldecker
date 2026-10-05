# syntax = docker/dockerfile:1

# The image Fly builds and runs: install, build, then keep only the built
# server and its production dependencies. Must serve HTTP on 0.0.0.0:$PORT
# (fly.toml sets PORT) --- the node adapter's standalone server reads HOST
# and PORT from the environment, so HOST is the only one set here.

ARG NODE_VERSION=24
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="Astro"

WORKDIR /app
ENV NODE_ENV=production

ARG PNPM_VERSION=11.9.0
RUN npm install -g pnpm@$PNPM_VERSION

# --- build stage: install everything, build, then prune to prod deps -------
FROM base AS build

# toolchain for native modules (better-sqlite3), in case no prebuilt binary
# matches the image platform
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential pkg-config python-is-python3

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod=false

COPY . .
RUN pnpm run build
RUN pnpm prune --prod

# --- runtime stage: just the built server and its production deps ----------
FROM base

COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/dist /app/dist
# README.md is read at request time (src/pages/readme/index.astro), not
# bundled, so it has to ship in the runtime image too.
COPY --from=build /app/README.md /app/README.md
# the committed migrations, applied at boot (see src/lib/db.ts)
COPY --from=build /app/drizzle /app/drizzle

ENV HOST=0.0.0.0
# /data is the Fly volume (see fly.toml) --- the SQLite file and uploaded
# photos both live there, so they survive a restart or a redeploy.
ENV DB_PATH=/data/app.db
ENV UPLOADS_DIR=/data/uploads
EXPOSE 8080
CMD ["node", "./dist/server/entry.mjs"]
