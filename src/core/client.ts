// Client-safe subset of the core's public API. Everything re-exported here is
// browser/SSR-safe: it transitively imports no Node built-ins, better-sqlite3,
// openai, or filesystem code. Browser-side adapters (Vue components/composables)
// import from '#core/client'; server code imports the full API from '#core'.
export * from './shared/types'
export * from './shared/errors'

export { VOICES, isKnownVoice } from './tts/provider'
export type { TtsProvider } from './tts/provider'
export { MAX_INPUT_LENGTH } from './tts/generate'
