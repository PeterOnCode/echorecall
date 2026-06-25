import type { Readable } from 'node:stream'
import { ZipArchive } from 'archiver'
import type { AudioProperties, Format, Generation, LibraryQuery, Metadata, Model } from '../shared/types'
import type { AudioPropertiesReader } from './audio-properties'
import { newId } from '../shared/ids'
import { DomainError, InvalidFilenameError, NotFoundError } from '../shared/errors'
import { formatInfo } from '../tts/provider'
import { slugify } from '../naming/slug'
import { allocateFilename, datedDir } from '../naming/filename'
import { resolveArchiveEntries } from '../batch/archive'
import { tagAudio } from '../tagging/tag-audio'
import type { AudioTagger } from '../tagging/tagger'
import type { BulkCleanFilter, GenerationRepository, LibraryListResult } from './repository'
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
 * A saved generation plus the transient list of tag fields/paths skipped for its
 * format (FR-021). `skippedTags` is `[]` when everything was embedded and `['*']`
 * for untaggable formats; it is surfaced to the client but never persisted.
 */
export interface SaveResult extends Generation {
  skippedTags: string[]
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
    /**
     * Optional metadata tagger. When present, audio is tagged before it is
     * written (a tagging failure fails only this item — nothing is saved). When
     * absent (e.g. plain unit tests), audio is stored untagged.
     */
    private readonly tagger?: AudioTagger,
    /**
     * Optional read-only audio-properties reader (006 · R-AUDIOPROPS). When
     * present, {@link audioPropertiesFor} decodes codec/bitrate/sampleRate/duration
     * from the stored file on demand; absent (plain tests) → empty properties.
     */
    private readonly audioProps?: AudioPropertiesReader,
  ) {}

  /**
   * Memoized audio properties keyed by generation id. A recording's audio STREAM is
   * immutable (retagging rewrites only metadata frames), so a decoded result stays
   * valid for the life of the process — sparing a disk read + WASM decode for every
   * row of every list request (R-AUDIOPROPS). Only successful reads are cached, so a
   * temporarily missing/unreadable file is retried on a later request.
   */
  private readonly audioPropsCache = new Map<string, AudioProperties>()

  /**
   * 006 · R-AUDIOPROPS — read-only audio properties for a row, computed on read
   * from its stored file. Returns an empty object when no reader is configured or
   * the file is missing/unreadable (never throws — a single bad file must not break
   * listing). Nothing is persisted.
   */
  async audioPropertiesFor(generation: Generation): Promise<AudioProperties> {
    if (!this.audioProps) return {}
    const cached = this.audioPropsCache.get(generation.id)
    if (cached) return cached
    try {
      if (!(await this.audio.existsAt(generation.path))) return {}
      const props = await this.audioProps(await this.audio.readAt(generation.path))
      this.audioPropsCache.set(generation.id, props)
      return props
    } catch {
      return {}
    }
  }

  /**
   * Persist a successful generation. The (already-tagged in US2) audio is written
   * to a dated, collision-safe, title-slug path first, then the metadata row is
   * inserted referencing that `path`; if the insert fails, the orphan audio file
   * is removed so a saved entry always has a readable audio file.
   *
   * The filename is the title slug under `audio/YYYY/MM/DD/`, with a numeric
   * suffix on same-day collisions and a UUID fallback when the title yields no
   * usable slug (FR-025/029).
   *
   * When a tagger is configured the audio is tagged BEFORE it is written, so a
   * tagging failure aborts this item with nothing persisted (FR-006). The
   * returned {@link SaveResult} carries the per-format `skippedTags` notice.
   */
  async save(input: SaveInput, bytes: Buffer): Promise<SaveResult> {
    const id = this.idFn()
    const createdAt = this.clock()
    const format: Format = input.format ?? 'mp3'
    const metadata: Metadata = input.metadata ?? {}

    // Tag first: if embedding fails it throws before anything is written/inserted.
    let toWrite = bytes
    let skippedTags: string[] = []
    if (this.tagger) {
      const tagged = await tagAudio(this.tagger, format, bytes, metadata)
      toWrite = tagged.bytes
      skippedTags = tagged.skipped
    }

    const ext = formatInfo(format)?.ext ?? format
    const dir = `audio/${datedDir(createdAt)}`
    const slug = slugify(metadata.title ?? '') || id
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
      metadata,
    }

    await this.audio.saveAt(path, toWrite)
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
    return { ...generation, skippedTags }
  }

  /**
   * Composable server-side library query (FR-034–036): search + filter + sort +
   * pagination, returning the requested page plus the full match `total`. An
   * empty query lists everything newest-first.
   */
  list(query: LibraryQuery = {}): LibraryListResult {
    return this.repo.list(query)
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
    // Swallow the finalize promise so a failure can't surface as an unhandled
    // rejection — any real error still reaches the consumer via the stream's
    // 'error' event.
    zip.finalize().catch(() => {})
    return zip
  }

  /**
   * Rename a saved item's file from a new human name (FR-031), without
   * re-synthesis. The name is run through the same {@link slugify} rules as
   * generation, kept in its original dated folder, and disambiguated with a
   * numeric suffix on collision (never overwriting another file). The extension
   * is immutable (taken from the current file). An empty/un-sluggable name is
   * rejected and the original file/name are left untouched. Renaming to the same
   * effective name is a no-op.
   */
  async rename(id: string, newName: string): Promise<Generation> {
    const generation = this.repo.get(id)
    if (!generation) throw new NotFoundError(id)

    const slug = slugify(newName)
    if (!slug) throw new InvalidFilenameError()

    const oldPath = generation.path
    const slash = oldPath.lastIndexOf('/')
    const dir = slash >= 0 ? oldPath.slice(0, slash) : ''
    const oldName = slash >= 0 ? oldPath.slice(slash + 1) : oldPath
    const dot = oldName.lastIndexOf('.')
    const ext = dot >= 0 ? oldName.slice(dot + 1) : (formatInfo(generation.format)?.ext ?? generation.format)

    const join = (name: string) => (dir ? `${dir}/${name}` : name)
    // The current file occupies its own name; exclude it from the collision check
    // so renaming to the same slug stays a no-op instead of gaining a `_2` suffix.
    const filename = allocateFilename(
      slug,
      ext,
      (name) => join(name) !== oldPath && this.audio.existsAtSync(join(name)),
    )
    const newPath = join(filename)
    if (newPath === oldPath) return generation

    await this.audio.rename(oldPath, newPath)
    try {
      this.repo.update(id, { path: newPath })
    } catch (err) {
      // Roll the file back so the row and the file never disagree.
      try {
        await this.audio.rename(newPath, oldPath)
      } catch {
        // intentionally ignored — `err` below is the meaningful failure
      }
      throw err
    }
    return this.get(id)
  }

  /**
   * Replace a saved item's embedded metadata (FR-030) without re-synthesis: the
   * stored audio is re-tagged in memory and written back, then the persisted tag
   * set is replaced as a whole (clearing a field removes it). A tagging failure
   * throws before anything is written, so the original file and row are left
   * untouched. Untaggable containers (AAC/PCM) skip the rewrite but still persist
   * the editable tag set. Editing the title here never renames the file.
   */
  async updateMetadata(id: string, metadata: Metadata): Promise<Generation> {
    const generation = this.repo.get(id)
    if (!generation) throw new NotFoundError(id)

    if (this.tagger) {
      const current = await this.audio.readAt(generation.path)
      // Tag first: a failure throws here, before the write — original file intact.
      const { bytes } = await tagAudio(this.tagger, generation.format, current, metadata)
      await this.audio.saveAt(generation.path, bytes)
    }

    this.repo.update(id, { metadata })
    return this.get(id)
  }

  /** Permanently delete an entry and its audio. */
  async delete(id: string): Promise<void> {
    // Resolve the path before deleting the row so we know which file to remove.
    const generation = this.repo.get(id)
    const existed = this.repo.delete(id)
    if (!existed) throw new NotFoundError(id)
    if (generation) await this.audio.deleteAt(generation.path)
  }

  /**
   * Bulk-clean the library by date and/or voice (FR-037): remove every matching
   * row and its stored audio, returning how many were deleted. At least one
   * filter is required — an empty filter is rejected so this can never wipe the
   * whole library (the UI also confirms before calling). File deletion is
   * best-effort per row: a missing/locked file never aborts cleaning the rest.
   */
  async bulkClean(filter: BulkCleanFilter): Promise<{ deleted: number }> {
    if (!filter.from && !filter.to && !filter.voiceId) {
      throw new DomainError(
        'EMPTY_INPUT',
        'At least one filter (date range or voice) is required to clean the library.',
      )
    }
    const removed = this.repo.bulkDelete(filter)
    for (const generation of removed) {
      try {
        await this.audio.deleteAt(generation.path)
      } catch {
        // intentionally ignored — the row is already gone; an orphan file must
        // not stop us cleaning the remaining matches.
      }
    }
    return { deleted: removed.length }
  }
}
