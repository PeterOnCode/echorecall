# syntax=docker/dockerfile:1

# ---- Build stage -----------------------------------------------------------
# Full Node 22 image (matches the pinned 22.22.2 runtime) so the native
# better-sqlite3 addon compiles/installs against the right ABI.
FROM node:22.22.2-bookworm AS build
WORKDIR /app

# Pin pnpm to match the committed lockfile (lockfileVersion 9.0).
RUN corepack enable && corepack prepare pnpm@10.30.2 --activate

# Copy only the manifest + config the postinstall `nuxt prepare` needs, so the
# dependency layer (including the slow better-sqlite3 native build) stays cached
# when only app code changes. `.dockerignore` keeps node_modules/, .output/,
# data/, and secrets out of the build context.
COPY package.json pnpm-lock.yaml nuxt.config.ts tsconfig.json ./

# Frozen install (build scripts enabled so better-sqlite3 builds its binary).
RUN pnpm install --frozen-lockfile

# Copy the rest of the source and produce the self-contained Nitro bundle.
COPY . .
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
