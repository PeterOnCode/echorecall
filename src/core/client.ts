// Client-safe subset of the core's public API. Everything re-exported here is
// browser/SSR-safe: it transitively imports no Node built-ins, better-sqlite3,
// openai, or filesystem code. Browser-side adapters (Vue components/composables)
// import from '#core/client'; server code imports the full API from '#core'.
export * from './shared/types'
export * from './shared/errors'

export {
  VOICES,
  MODELS,
  FORMATS,
  INSTRUCTIONS_MODEL,
  MAX_UPLOAD_BYTES,
  isKnownVoice,
  isKnownModel,
  isKnownFormat,
  formatInfo,
} from './tts/provider'
export type { TtsProvider } from './tts/provider'
export { MAX_INPUT_LENGTH } from './tts/generate'

// Naming rules (slug) — shared so the client preview matches the server result.
export { slugify } from './naming/slug'

// .txt batch parsing — pure, reused client-side so the upload is never persisted.
export { parseUploadText } from './batch/parse-upload'
export type { ParsedUpload } from './batch/parse-upload'
