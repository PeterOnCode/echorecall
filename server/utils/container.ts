import { join } from 'node:path'
import {
  FileAudioStore,
  LibraryService,
  OpenAiTtsProvider,
  SqliteGenerationRepository,
  type TtsProvider,
} from '#core'

let libraryService: LibraryService | undefined

function dataDir(): string {
  const config = useRuntimeConfig()
  return (config.dataDir as string) || join(process.cwd(), 'data')
}

/** Lazily-constructed singleton library service (SQLite + filesystem). */
export function getLibraryService(): LibraryService {
  if (!libraryService) {
    const dir = dataDir()
    const repo = new SqliteGenerationRepository(join(dir, 'echorecall.db'))
    // Audio store is rooted at the data dir; stored paths are relative
    // (`audio/YYYY/MM/DD/<slug>.<ext>` for new files, `audio/<id>.mp3` legacy).
    // US2 will inject an AudioTagger and US8 a per-request provider here.
    const audio = new FileAudioStore(dir)
    libraryService = new LibraryService(repo, audio)
  }
  return libraryService
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
