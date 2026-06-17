// Full public API of the framework-agnostic core. Server adapters (Nitro/CLI)
// import from here; browser-side adapters import the safe subset from './client'
// (alias '#core/client') so server-only deps never reach the client bundle.
export * from './client'

// Domain orchestration: browser-safe at runtime, but needs a server-provided
// TtsProvider, so it lives in the server entry only.
export { generateSpeech } from './tts/generate'

// Server-only adapters — these pull in Node built-ins, better-sqlite3, openai,
// and the filesystem, so they must never be imported from '#core/client'.
export { newId } from './shared/ids'
export { OpenAiTtsProvider } from './tts/openai-provider'
export type { OpenAiTtsConfig } from './tts/openai-provider'

export type { GenerationRepository, NewGenerationRecord } from './library/repository'
export { SqliteGenerationRepository } from './library/sqlite-repository'
export { FileAudioStore } from './library/audio-store'
export { LibraryService } from './library/library-service'

// Naming (filesystem-safe slug + dated, collision-safe filename allocation).
export { MAX_SLUG_LENGTH } from './naming/slug'
export { datedDir, allocateFilename } from './naming/filename'
