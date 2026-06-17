# Core API Contract: TTS Studio Enhancements

**Feature**: `002-studio-enhancements` | **Surface**: framework-agnostic `src/core/`

The public core API the Nitro adapter (and a future CLI) consume. Server-only modules pull
in Node built-ins / better-sqlite3 / openai / taglib-wasm (WASM) and are exported from `#core`;
the browser-safe subset is re-exported from `#core/client`. Types/signatures are normative;
bodies are not shown.

## Client-safe (`#core/client`) — no Node/server deps

```ts
// catalogs + limits (reused by the browser to render selects & validate)
export const VOICES: readonly Voice[]            // widened set
export const MODELS: readonly Model[]             // tts-1 | tts-1-hd | gpt-4o-mini-tts
export const FORMATS: readonly FormatInfo[]       // { id: Format; ext: string; taggable: 'id3'|'vorbis'|'none' }
export const MAX_INPUT_LENGTH = 4096
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

export function isKnownVoice(id: string): boolean
export function isKnownModel(id: string): boolean
export function isKnownFormat(id: string): boolean

// slug rules — shared so client preview matches server result (FR-025)
export function slugify(title: string): string    // ASCII translit, lowercase, normalise, cap 64; '' if un-sluggable

// .txt batch parsing — pure, reused client-side so the upload is never persisted (FR-001..005)
export function parseUploadText(content: string): {
  items: { text: string }[]                       // one per valid non-blank line, in order
  added: number; skippedBlank: number; rejectedTooLong: number
}

// shared domain types + errors (DomainError, ErrorCode, Metadata, Generation, …)
```

## Server-only (`#core`)

### tts (extended)

```ts
interface TtsProvider {
  synthesize(input: {
    text: string; voiceId: string; model: string; format: Format
    speed: number; instructions?: string           // applied only for gpt-4o-mini-tts
  }): Promise<Buffer>                                // bytes in the requested format
}

class OpenAiTtsProvider implements TtsProvider {     // constructed per request from the resolved key
  constructor(config: { apiKey: string })
}

// validate (voice/model/format/length/instructions rule) → synthesize; no network on invalid input
function generateSpeech(provider: TtsProvider, input: GenerationInput): Promise<Buffer>
```

### tagging (new)

```ts
type TagResult = { bytes: Buffer; skipped: string[] }  // skipped = fields/paths dropped for the format

interface AudioTagger {
  // Embed metadata for the given format. AAC/PCM → returns input bytes + skipped=['*'].
  // FLAC/Opus → drops non-mappable fields (e.g. customUrl) into `skipped`.
  tag(format: Format, audio: Buffer, metadata: Metadata): Promise<TagResult>
}

class TagLibAudioTagger implements AudioTagger {        // taglib-wasm — pure WASM, in-memory, no system binary
  static create(): Promise<TagLibAudioTagger>           // loads/initialises the WASM module once
}
// Implementation flow (per call): taglib.openFile(audio) → map Metadata → setProperties(...)
// → file.save() → file.getFileBuffer() → dispose. Unsupported fields for the format are
// collected into TagResult.skipped (from PROPERTIES[*].supportedFormats / getPropertiesByFormat).

function tagAudio(tagger: AudioTagger, format: Format, audio: Buffer, metadata: Metadata): Promise<TagResult>
```

> **Tagging spike (from research §1).** TagLib natively supports ID3v2.4, `TXXX`,
> `TLAN`/multi-value, and Vorbis comments (incl. Opus). Three narrow points to confirm in the
> bundled TagLib version: (a) custom **URL** entries round-trip as `WXXX` via the PropertyMap
> — if the binding exposes only PropertyMap, custom URLs fall back to `TXXX` (acceptable; they
> are ID3-only per spec, skipped for FLAC/Opus); (b) the ID3v2 save version is **2.4**
> (TagLib 2.x default); (c) **WAV is written as an ID3v2.4 chunk, not only RIFF `INFO`**
> (FR-019 requires ID3v2.4.0 for WAV; force ID3v2 if the binding defaults to INFO). The
> `AudioTagger` port is unaffected either way.

### naming (new)

```ts
function slugify(title: string): string                 // same rule as client (single source)
function datedDir(createdAt: Date): string              // 'YYYY/MM/DD' (UTC)
// allocate a collision-safe filename in a directory; appends _2, _3, … ; never overwrites
function allocateFilename(dir: string, slug: string, ext: string,
                          exists: (name: string) => boolean): string
```

### library (extended)

```ts
type NewGenerationRecord = {
  id: string; text: string; voiceId: string; model: string; format: Format
  speed: number; createdAt: string; path: string; metadata: Metadata
}

interface GenerationRepository {
  insert(record: NewGenerationRecord): void
  list(query: LibraryQuery): { rows: Generation[]; total: number }   // server-side filter/sort/page
  get(id: string): Generation | undefined
  update(id: string, patch: { path?: string; metadata?: Metadata }): boolean
  delete(id: string): boolean
  bulkDelete(filter: { from?: string; to?: string; voiceId?: string }): Generation[]  // returns removed (to delete files)
}

class SqliteGenerationRepository implements GenerationRepository {   // + idempotent migrate()+backfill in ctor
  constructor(dbPath: string)
}

class FileAudioStore {                                  // now path-based (dated dirs)
  saveAt(relPath: string, bytes: Buffer): Promise<void>
  readAt(relPath: string): Promise<Buffer>
  existsAt(relPath: string): Promise<boolean>
  rename(fromRel: string, toRel: string): Promise<void>
  deleteAt(relPath: string): Promise<void>
}

class LibraryService {
  save(input, taggedBytes: Buffer): Promise<Generation>           // dated path + slug name + atomic
  list(query: LibraryQuery): { rows: Generation[]; total: number }
  get(id: string): Generation
  rename(id: string, newName: string): Promise<Generation>       // slug+collision; reject empty
  updateMetadata(id: string, metadata: Metadata): Promise<Generation>  // taglib-wasm retag + persist
  delete(id: string): Promise<void>
  bulkClean(filter): Promise<{ deleted: number }>
  archive(ids: string[]): Promise<NodeJS.ReadableStream>         // archiver zip stream
  readAudio(id: string): Promise<Buffer>                         // by stored path; never contacts provider
}
```

### settings (new)

```ts
function encryptSecret(plaintext: string, appSecret: string): string   // AES-256-GCM → 'iv:tag:ct' base64
function decryptSecret(payload: string, appSecret: string): string

interface AppConfigRepository {                          // SQLite app_config(key,value)
  get(key: string): string | undefined
  set(key: string, value: string): void
  delete(key: string): boolean
}

// per-request precedence: UI (decrypted) → env → undefined.
// If appSecret is empty/undefined, in-app storage is disabled: the UI key is treated as
// unavailable and resolution uses envKey only (env-only deployments keep working).
function resolveApiKey(deps: { config: AppConfigRepository; appSecret?: string; envKey?: string }): string | undefined
```

## Wiring (server adapter)

`server/utils/container.ts` constructs singletons (repo incl. migration, audio store, the
`taglib-wasm` tagger initialised once, app-config repo) and a **per-request**
`OpenAiTtsProvider` built from `resolveApiKey`.
Routes stay thin: parse/validate input → call a core use-case → map `DomainError.code` →
HTTP via `server/utils/errors.ts`.

## Testing contract (ports enable no-network, no-binary default suite)

- `generateSpeech`, `tagAudio`, library use-cases tested with **fake** `TtsProvider` /
  `AudioTagger` injected at the port.
- `slugify`, `allocateFilename`, `datedDir`, `parseUploadText`, query builder,
  `encrypt/decrypt`, `resolveApiKey` are pure unit tests.
- `OpenAiTtsProvider` and `TagLibAudioTagger` have small, **separately-gated** adapter tests
  (no live OpenAI call in the default run; the WASM tagger runs in-process, so no system
  binary is required for CI green).
