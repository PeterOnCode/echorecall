import type { Format, FormatInfo, Metadata } from '../shared/types'
import { formatInfo } from '../tts/provider'

/**
 * The result of embedding metadata into audio bytes: the (possibly unchanged)
 * bytes plus the list of fields/paths that could not be written for the format.
 * `skipped` drives the "skipped with a notice" UX (FR-021) — `['*']` means the
 * whole tag set was skipped (an untaggable container).
 */
export interface TagResult {
  bytes: Buffer
  skipped: string[]
}

/**
 * Port: embeds a {@link Metadata} set into audio bytes for a given format.
 * Implemented by {@link import('./taglib-tagger').TagLibAudioTagger} (taglib-wasm)
 * and faked at this boundary in tests so the core stays network-/binary-free.
 *
 * Untaggable formats (AAC/PCM) MUST return the input bytes unchanged with
 * `skipped=['*']`; Vorbis formats (FLAC/Opus) drop ID3-only fields (customUrl).
 */
export interface AudioTagger {
  tag(format: Format, audio: Buffer, metadata: Metadata): Promise<TagResult>
}

/**
 * Per tagging-path applicability map: which {@link Metadata} fields can never be
 * embedded for each tag path. `id3` (MP3/WAV) carries the full set; `vorbis`
 * (FLAC/Opus) cannot carry custom URLs (WXXX is ID3-only, spec); `none`
 * (AAC/PCM) carries nothing.
 */
export const UNSUPPORTED_FIELDS: Record<FormatInfo['taggable'], readonly string[]> = {
  id3: [],
  vorbis: ['customUrl'],
  none: ['*'],
}

/**
 * Compute the fields/paths skipped for `format` given the metadata actually
 * present. Untaggable formats always report `['*']`; for Vorbis, `customUrl` is
 * reported only when the user supplied at least one custom URL entry. This is a
 * pure function so the use-case (not the concrete tagger) is the single source of
 * the skipped set.
 */
export function skippedFields(format: Format, metadata: Metadata): string[] {
  const taggable = formatInfo(format)?.taggable ?? 'none'
  if (taggable === 'none') return ['*']
  return UNSUPPORTED_FIELDS[taggable].filter((field) => isPresent(field, metadata))
}

/** Whether a named metadata field carries a value worth reporting as skipped. */
function isPresent(field: string, metadata: Metadata): boolean {
  if (field === '*') return true
  const value = (metadata as Record<string, unknown>)[field]
  return Array.isArray(value) ? value.length > 0 : value != null && value !== ''
}

/** Every Metadata field a tagger can embed on at least one tagging path. */
const EMBEDDABLE_FIELDS = [
  'title',
  'artist',
  'album',
  'genre',
  'comment',
  'recordedAt',
  'track',
  'languages',
  'customText',
  'customUrl',
] as const

/**
 * Whether `metadata` has at least one field that would actually be embedded for
 * `format`. False for an untaggable container, an empty set, or a set whose only
 * present fields are unsupported by the format (e.g. just `customUrl` on Vorbis).
 * Lets {@link import('./tag-audio').tagAudio} skip opening the tagger entirely and
 * return the original bytes — so a no-metadata generation is neither rewritten nor
 * exposed to a spurious tagging failure.
 */
export function hasEmbeddableTags(format: Format, metadata: Metadata): boolean {
  const taggable = formatInfo(format)?.taggable ?? 'none'
  if (taggable === 'none') return false
  const unsupported = UNSUPPORTED_FIELDS[taggable]
  return EMBEDDABLE_FIELDS.some((field) => !unsupported.includes(field) && isPresent(field, metadata))
}
