import { TagLib } from 'taglib-wasm'
import type { AudioFile, PropertyMap } from 'taglib-wasm'
import type { Format, Metadata } from '../shared/types'
import { formatInfo } from '../tts/provider'
import { TaggingFailedError } from '../shared/errors'
import type { AudioTagger, TagResult } from './tagger'
import { skippedFields } from './tagger'

/**
 * {@link AudioTagger} backed by **taglib-wasm** (TagLib compiled to WebAssembly —
 * pure WASM, zero native deps, no system binary; research §1). The WASM module is
 * loaded once via {@link TagLibAudioTagger.create} and reused for every call.
 *
 * Embedding is fully in-memory: `open(bytes)` → map {@link Metadata} to a
 * PropertyMap → `save()` → `getFileBuffer()` → `dispose()`. TagLib writes
 * ID3v2.4.0 for MP3/WAV (incl. multi-value `TLAN` and custom `TXXX`) and Vorbis
 * comments for FLAC/Opus automatically. AAC/PCM are untaggable and pass through.
 *
 * Custom text/URL entries are written through the PropertyMap keyed by their
 * description (research §1's accepted "TXXX fallback"). TagLib owns the
 * key→frame mapping, so a description that collides with one of its reserved
 * property keys may be normalised or dropped at the file-tag level; the library
 * row keeps the full, re-editable value regardless (FR-030/033).
 */
export class TagLibAudioTagger implements AudioTagger {
  private constructor(private readonly taglib: TagLib) {}

  /** Load and initialise the WASM module once, returning a ready tagger. */
  static async create(): Promise<TagLibAudioTagger> {
    return new TagLibAudioTagger(await TagLib.initialize())
  }

  async tag(format: Format, audio: Buffer, metadata: Metadata): Promise<TagResult> {
    const skipped = skippedFields(format, metadata)
    // Untaggable containers are never opened — return the bytes verbatim so the
    // generation still completes (US2 scenario 4).
    if (formatInfo(format)?.taggable === 'none') {
      return { bytes: audio, skipped }
    }

    let file: AudioFile | undefined
    try {
      file = await this.taglib.open(new Uint8Array(audio))
      file.setProperties(buildPropertyMap(format, metadata))
      if (!file.save()) throw new TaggingFailedError()
      // Copy out of the WASM heap before dispose() frees it.
      return { bytes: Buffer.from(file.getFileBuffer()), skipped }
    } catch (err) {
      if (err instanceof TaggingFailedError) throw err
      throw new TaggingFailedError(err instanceof Error ? err.message : undefined)
    } finally {
      file?.dispose()
    }
  }
}

/**
 * Map our {@link Metadata} to a TagLib PropertyMap. Standard fields use TagLib's
 * canonical uppercase keys (it normalises them per format on save); `languages`
 * is multi-value (`TLAN`); custom text entries become `TXXX` frames keyed by
 * description; custom URLs are emitted only for ID3 formats (Vorbis omits them —
 * already reflected in `skipped`). Empty values are not written, so clearing a
 * field removes it (FR-023).
 */
function buildPropertyMap(format: Format, metadata: Metadata): PropertyMap {
  const props: Record<string, string[]> = {}
  const set = (key: string, value?: string) => {
    if (value != null && value !== '') props[key] = [value]
  }

  set('TITLE', metadata.title)
  set('ARTIST', metadata.artist)
  set('ALBUM', metadata.album)
  set('GENRE', metadata.genre)
  set('COMMENT', metadata.comment)
  set('DATE', metadata.recordedAt)
  set('TRACKNUMBER', metadata.track)

  if (metadata.languages?.length) {
    props.LANGUAGE = metadata.languages.filter((l) => l !== '')
  }

  for (const entry of metadata.customText ?? []) {
    addCustom(props, entry.description, entry.value)
  }
  // Custom URLs are ID3-only; Vorbis omits them (and reports them as skipped).
  if (formatInfo(format)?.taggable === 'id3') {
    for (const entry of metadata.customUrl ?? []) {
      addCustom(props, entry.description, entry.url)
    }
  }

  return props
}

/**
 * Append a description-keyed custom value, merging repeats under one key. The key
 * is upper-cased because TagLib's PropertyMap silently drops unknown lower-case
 * keys and only persists upper-case ones as `TXXX` frames (verified against
 * taglib-wasm 1.3.1 / TagLib 2.3.0). The original-case description is retained in
 * the library row for re-editing.
 */
function addCustom(props: Record<string, string[]>, description: string, value: string): void {
  const key = description.trim().toUpperCase()
  if (key === '' || value === '') return
  const existing = props[key]
  if (existing) existing.push(value)
  else props[key] = [value]
}
