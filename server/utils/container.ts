import { join } from 'node:path'
import {
  FileAudioStore,
  LibraryService,
  OpenAiTtsProvider,
  SqliteGenerationRepository,
  type TtsProvider,
} from '#core'

let libraryService: LibraryService | undefined
let ttsProvider: TtsProvider | undefined

function dataDir(): string {
  const config = useRuntimeConfig()
  return (config.dataDir as string) || join(process.cwd(), 'data')
}

/** Lazily-constructed singleton library service (SQLite + filesystem). */
export function getLibraryService(): LibraryService {
  if (!libraryService) {
    const dir = dataDir()
    const repo = new SqliteGenerationRepository(join(dir, 'echorecall.db'))
    const audio = new FileAudioStore(join(dir, 'audio'))
    libraryService = new LibraryService(repo, audio)
  }
  return libraryService
}

/** Lazily-constructed singleton TTS provider (OpenAI). */
export function getTtsProvider(): TtsProvider {
  if (!ttsProvider) {
    const config = useRuntimeConfig()
    ttsProvider = new OpenAiTtsProvider({ apiKey: config.openaiApiKey as string })
  }
  return ttsProvider
}
