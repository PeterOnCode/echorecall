import { join } from 'node:path'
import {
  FileAudioStore,
  LibraryService,
  OpenAiTtsProvider,
  SqliteGenerationRepository,
  TagLibAudioTagger,
  type TtsProvider,
} from '#core'

// Memoise the in-flight construction promise (not just the resolved service) so
// concurrent first requests share a single repo/tagger rather than racing to
// build their own — the taglib-wasm module is loaded exactly once.
let libraryServicePromise: Promise<LibraryService> | undefined

function dataDir(): string {
  const config = useRuntimeConfig()
  return (config.dataDir as string) || join(process.cwd(), 'data')
}

/**
 * Lazily-constructed singleton library service (SQLite + filesystem + tagger).
 * Async because the taglib-wasm `AudioTagger` initialises its WASM module once;
 * it is injected so `save()` embeds metadata before writing. US8 will layer a
 * per-request provider into this wiring.
 */
export function getLibraryService(): Promise<LibraryService> {
  if (!libraryServicePromise) {
    libraryServicePromise = (async () => {
      const dir = dataDir()
      const repo = new SqliteGenerationRepository(join(dir, 'echorecall.db'))
      // Audio store is rooted at the data dir; stored paths are relative
      // (`audio/YYYY/MM/DD/<slug>.<ext>` for new files, `audio/<id>.mp3` legacy).
      const audio = new FileAudioStore(dir)
      const tagger = await TagLibAudioTagger.create()
      return new LibraryService(repo, audio, undefined, undefined, tagger)
    })()
  }
  return libraryServicePromise
}

/**
 * Resolve a TTS provider per request from the active OpenAI key. US1 sources the
 * key from the environment; US8 layers in the encrypted in-app key (UI→env
 * precedence) and a NO_API_KEY failure when neither is set.
 */
export function getTtsProvider(): TtsProvider {
  const config = useRuntimeConfig()
  return new OpenAiTtsProvider({ apiKey: config.openaiApiKey as string })
}
