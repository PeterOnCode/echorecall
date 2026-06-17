import type { Generation } from '../shared/types'
import { newId } from '../shared/ids'
import { NotFoundError } from '../shared/errors'
import type { GenerationRepository } from './repository'
import type { FileAudioStore } from './audio-store'

/**
 * Composes the metadata repository and the path-based audio store into the
 * library use-cases (save / list / get / read audio / delete). Audio is resolved
 * by the stored `path`, so legacy `audio/<id>.mp3` files and new dated files both
 * work.
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
   * metadata row; if the row insert fails, the orphan audio file is removed so a
   * saved entry always has a readable audio file.
   *
   * 002 foundational scope: flat `audio/<id>.mp3` path, mp3, no tags. US1/US4
   * upgrade this to dated, title-slug paths and US2 adds tagging + metadata.
   */
  async save(input: { text: string; voiceId: string }, bytes: Buffer): Promise<Generation> {
    const id = this.idFn()
    const createdAt = this.clock().toISOString()
    const path = `audio/${id}.mp3`
    const generation: Generation = {
      id,
      text: input.text,
      voiceId: input.voiceId,
      model: null,
      format: 'mp3',
      speed: null,
      createdAt,
      path,
      metadata: {},
    }
    await this.audio.saveAt(path, bytes)
    try {
      this.repo.insert(generation)
    } catch (err) {
      // Best-effort cleanup of the orphan audio; never let a cleanup failure mask
      // the original metadata-insert error.
      try {
        await this.audio.deleteAt(path)
      } catch {
        // intentionally ignored — `err` below is the meaningful failure
      }
      throw err
    }
    return generation
  }

  list(): Generation[] {
    return this.repo.list()
  }

  get(id: string): Generation {
    const generation = this.repo.get(id)
    if (!generation) throw new NotFoundError(id)
    return generation
  }

  /** Read stored audio for replay/download by its stored path; never contacts the provider. */
  async readAudio(id: string): Promise<Buffer> {
    const generation = this.repo.get(id)
    if (!generation || !(await this.audio.existsAt(generation.path))) throw new NotFoundError(id)
    return this.audio.readAt(generation.path)
  }

  /** Permanently delete an entry and its audio. */
  async delete(id: string): Promise<void> {
    // Resolve the path before deleting the row so we know which file to remove.
    const generation = this.repo.get(id)
    const existed = this.repo.delete(id)
    if (!existed) throw new NotFoundError(id)
    if (generation) await this.audio.deleteAt(generation.path)
  }
}
