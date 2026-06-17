import type { Readable } from 'node:stream'
import { ZipArchive } from 'archiver'
import type { Format, Generation, Metadata, Model } from '../shared/types'
import { newId } from '../shared/ids'
import { NotFoundError } from '../shared/errors'
import { formatInfo } from '../tts/provider'
import { slugify } from '../naming/slug'
import { allocateFilename, datedDir } from '../naming/filename'
import { resolveArchiveEntries } from '../batch/archive'
import type { GenerationRepository } from './repository'
import type { FileAudioStore } from './audio-store'

/** Input for persisting a successful generation. */
export interface SaveInput {
  text: string
  voiceId: string
  model?: Model | null
  format?: Format
  speed?: number | null
  metadata?: Metadata
}

/**
 * Composes the metadata repository and the path-based audio store into the
 * library use-cases (save / list / get / read audio / delete / archive). Audio is
 * resolved by the stored `path`, so legacy `audio/<id>.mp3` files and new dated
 * files both work.
 */
export class LibraryService {
  constructor(
    private readonly repo: GenerationRepository,
    private readonly audio: FileAudioStore,
    private readonly clock: () => Date = () => new Date(),
    private readonly idFn: () => string = newId,
  ) {}

  /**
   * Persist a successful generation. The (already-tagged in US2) audio is written
   * to a dated, collision-safe, title-slug path first, then the metadata row is
   * inserted referencing that `path`; if the insert fails, the orphan audio file
   * is removed so a saved entry always has a readable audio file.
   *
   * The filename is the title slug under `audio/YYYY/MM/DD/`, with a numeric
   * suffix on same-day collisions and a UUID fallback when the title yields no
   * usable slug (FR-025/029).
   */
  async save(input: SaveInput, bytes: Buffer): Promise<Generation> {
    const id = this.idFn()
    const createdAt = this.clock()
    const format: Format = input.format ?? 'mp3'
    const ext = formatInfo(format)?.ext ?? format
    const dir = `audio/${datedDir(createdAt)}`
    const slug = slugify(input.metadata?.title ?? '') || id
    const filename = allocateFilename(slug, ext, (name) =>
      this.audio.existsAtSync(`${dir}/${name}`),
    )
    const path = `${dir}/${filename}`

    const generation: Generation = {
      id,
      text: input.text,
      voiceId: input.voiceId,
      model: input.model ?? null,
      format,
      speed: input.speed ?? null,
      createdAt: createdAt.toISOString(),
      path,
      metadata: input.metadata ?? {},
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

  /**
   * Bundle the given generations into a single `.zip` stream (FR-008). Entries are
   * named by each item's filename, with duplicate basenames disambiguated. Unknown
   * ids are skipped; if none resolve, NotFound is thrown (the caller maps to 404).
   */
  async archive(ids: string[]): Promise<Readable> {
    const generations = ids
      .map((id) => this.repo.get(id))
      .filter((g): g is Generation => g !== undefined)
    if (generations.length === 0) throw new NotFoundError(ids.join(', ') || '(none)')

    const byId = new Map(generations.map((g) => [g.id, g]))
    const zip = new ZipArchive({ zlib: { level: 9 } })
    for (const entry of resolveArchiveEntries(generations)) {
      const bytes = await this.audio.readAt(byId.get(entry.id)!.path)
      zip.append(bytes, { name: entry.name })
    }
    // Finalize without awaiting: the caller (route / test) drains the stream.
    void zip.finalize()
    return zip
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
