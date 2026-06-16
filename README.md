# EchoRecall

Turn written text into spoken audio and keep a permanent, browsable library of
everything you've generated. EchoRecall is a small web app: enter text, pick a
voice, and listen — every successful generation is saved so you can replay,
download, or delete it later without regenerating.

- **Generate & listen** — type/paste text (up to 4,096 chars), choose a voice, hear MP3 audio.
- **Persistent library** — every generation is stored (SQLite + on-disk MP3) and survives restarts; replay makes no new provider call.
- **Manage** — download any clip as `<id>.mp3`, or permanently delete it behind a confirmation.

There is no built-in authentication — secure network access yourself (localhost,
reverse proxy, or VPN).

## Stack

TypeScript (strict) on Node.js · Nuxt 4 (Vue 3 + Nitro) · OpenAI TTS (MP3) ·
SQLite (`better-sqlite3`) + filesystem audio under `data/` · Vitest + `@nuxt/test-utils`
· Docker Compose. A framework-agnostic core lives in `src/core/`; the Nuxt server
(`server/`) and UI (`app/`) are adapters over it.

## Prerequisites

- **Node.js 22.22.2** — pinned in `.mise.toml` / `.node-version`. Using [mise](https://mise.jdx.dev)
  (`mise install`) is recommended; the native `better-sqlite3` addon must be built
  against this version.
- **pnpm 10** (`corepack enable` will provide it).
- An **OpenAI API key** with TTS access.

## Local development

```bash
pnpm install
cp .env.example .env          # then set NUXT_OPENAI_API_KEY=sk-...
pnpm dev                      # http://localhost:3102
```

Environment variables (server-only; never commit real keys):

| Variable              | Required | Default  | Purpose                                  |
| --------------------- | -------- | -------- | ---------------------------------------- |
| `NUXT_OPENAI_API_KEY` | yes      | —        | OpenAI key used for TTS generation.      |
| `NUXT_DATA_DIR`       | no       | `./data` | Where the SQLite DB + MP3 audio are kept. |

## Tests, types, and lint

```bash
pnpm test            # core unit + server integration (TTS provider mocked — no live calls)
pnpm test:component  # Vue component tests (@nuxt/test-utils)
pnpm typecheck       # nuxt typecheck
pnpm lint            # eslint
```

The TTS provider is mocked at the core port boundary, so the suite never makes a
live network call.

## Docker

```bash
# Reads NUXT_OPENAI_API_KEY from .env; serves on http://localhost:3102
docker compose up --build -d
```

`docker-compose.yml` bind-mounts `./data` into the container, so the SQLite
database and generated MP3s persist across container recreation. Stop with
`docker compose down`.

## Project layout

```
src/core/      framework-agnostic domain: tts/, library/, shared/ (ports + use-cases)
server/        Nitro API routes (server/api/) + DI container & error mapping (server/utils/)
app/           Nuxt UI: components/, composables/, pages/
tests/         unit/ · integration/ · component/
data/          runtime SQLite DB + audio/ (gitignored; Docker volume)
specs/001-tts-generation-library/   spec, plan, data model, API contract, quickstart
```

## Documentation

End-to-end validation steps and acceptance criteria live in
[`specs/001-tts-generation-library/quickstart.md`](specs/001-tts-generation-library/quickstart.md).
The full specification, plan, data model, and REST API contract are alongside it in
[`specs/001-tts-generation-library/`](specs/001-tts-generation-library/).
