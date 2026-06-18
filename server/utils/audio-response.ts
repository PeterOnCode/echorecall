// Response helpers for streaming a stored clip (GET /api/generations/:id/audio).
// Kept here, off the h3 handler, so the download decision, the content type, and
// the attachment filename are unit-testable in plain Node.

import type { Format } from '#core'

export const AUDIO_CONTENT_TYPE = 'audio/mpeg'

const CONTENT_TYPE_BY_FORMAT: Record<Format, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  flac: 'audio/flac',
  opus: 'audio/opus',
  aac: 'audio/aac',
  pcm: 'audio/L16',
}

/** Media type for a stored clip's format; falls back to a generic binary type. */
export function contentTypeFor(format: string): string {
  return CONTENT_TYPE_BY_FORMAT[format as Format] ?? 'application/octet-stream'
}

/**
 * Whether the request asked to download (save) the clip rather than stream it
 * inline. Driven by `?download=1`; any present, non-falsy value counts, while an
 * absent/empty/`0`/`false` value streams inline.
 */
export function isDownloadRequested(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return false
  const flag = String(value).toLowerCase()
  return flag !== '0' && flag !== 'false'
}

/**
 * `Content-Disposition` value that makes the browser save the clip under its real
 * human-readable filename (US4) — the basename of the stored path, e.g.
 * `my-great-clip.flac` or a legacy `<id>.mp3`. Filenames are ASCII by
 * construction (slugs are transliterated; ids are UUIDs), so no RFC 5987 encoding
 * is required and the value is safe to quote directly.
 */
export function attachmentDisposition(filename: string): string {
  return `attachment; filename="${filename}"`
}
