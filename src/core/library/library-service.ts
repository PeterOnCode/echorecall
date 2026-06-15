import type { Generation } from '../shared/types'
import { newId } from '../shared/ids'
import { NotFoundError } from '../shared/errors'
import type { GenerationRepository } from './repository'
import type { FileAudioStore } from './audio-store'

/**
 * Composes the metadata repository and the audio store into the library
 * use-cases (save / list / get / read audio / delete).
 */
export class LibraryService {
  constructor(
    private readonly repo: GenerationRepository,
    private readonly audio: FileAudioStore,
    private readonly clock: () => Date = () => new Date(),
    private readonly idFn: () => string = newId,
  ) {}

  /**
   * Persist a successful generation. Writes the audio file first, then the
   * metadata row; if the row insert fails, the orphan audio file is removed so
   * a saved entry always has a readable audio file.
   */
  async save(input: { text: string; voiceId: string }, mp3: Buffer): Promise<Generation> {
    const id = this.idFn()
    const createdAt = this.clock().toISOString()
    await this.audio.save(id, mp3)
    try {
      this.repo.insert({ id, text: input.text, voiceId: input.voiceId, createdAt })
    } catch (err) {
      await this.audio.delete(id)
      throw err
    }
    return { id, text: input.text, voiceId: input.voiceId, createdAt }
  }

  list(): Generation[] {
    return this.repo.list()
  }

  get(id: string): Generation {
    const generation = this.repo.get(id)
    if (!generation) throw new NotFoundError(id)
    return generation
  }

  /** Read stored audio for replay/download; never contacts the provider. */
  async readAudio(id: string): Promise<Buffer> {
    const generation = this.repo.get(id)
    if (!generation || !(await this.audio.exists(id))) throw new NotFoundError(id)
    return this.audio.read(id)
  }

  /** Permanently delete an entry and its audio. */
  async delete(id: string): Promise<void> {
    const existed = this.repo.delete(id)
    if (!existed) throw new NotFoundError(id)
    await this.audio.delete(id)
  }
}
