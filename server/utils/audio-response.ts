// Response helpers for streaming a stored MP3 (GET /api/generations/:id/audio).
// Kept here, off the h3 handler, so the download decision and the attachment
// filename are unit-testable in plain Node.

export const AUDIO_CONTENT_TYPE = 'audio/mpeg'

/**
 * Whether the request asked to download (save) the clip rather than stream it
 * inline. Driven by `?download=1`; any present, non-falsy value counts, while an
 * absent/empty/`0`/`false` value streams inline.
 */
export function isDownloadRequested(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '' && value !== '0' && value !== 'false'
}

/** `Content-Disposition` value that makes the browser save the clip as <id>.mp3. */
export function attachmentDisposition(id: string): string {
  return `attachment; filename="${id}.mp3"`
}
