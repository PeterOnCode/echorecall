# syntax=docker/dockerfile:1

# ---- Build stage -----------------------------------------------------------
# Full Node 22 image (matches the pinned 22.22.2 runtime) so the native
# better-sqlite3 addon compiles/installs against the right ABI.
FROM node:22.22.2-bookworm AS build
WORKDIR /app

# Pin pnpm to match the committed lockfile (lockfileVersion 9.0).
RUN corepack enable && corepack prepare pnpm@10.30.2 --activate

# Copy the whole source before install: the `postinstall` hook runs
# `nuxt prepare`, which needs nuxt.config.ts and the app sources present.
# `.dockerignore` keeps node_modules/, .output/, data/, and secrets out.
COPY . .

# Frozen install (build scripts enabled so better-sqlite3 builds its binary).
RUN pnpm install --frozen-lockfile

# Produce the self-contained Nitro server bundle under .output/.
RUN pnpm build

# ---- Runtime stage ---------------------------------------------------------
# Slim image carrying only the Nitro output (which bundles its server deps,
# including the better-sqlite3 native binary built in the matching base above).
FROM node:22.22.2-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
# Nitro's node-server listens on $HOST:$PORT.
ENV HOST=0.0.0.0 PORT=3000
# SQLite DB + generated audio live here; mount it as a volume to persist them.
ENV NUXT_DATA_DIR=/app/data

COPY --from=build /app/.output ./.output

EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
