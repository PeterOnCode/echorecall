import { parseText } from './parse-text'

/** Legacy immediate-append summary retained for existing line-import callers. */
export interface ParsedUpload {
  /** One entry per valid, trimmed, non-blank line, in file order. */
  items: { text: string }[]
  added: number
  skippedBlank: number
  rejectedTooLong: number
}

/**
 * Compatibility wrapper over the unified text preview parser. New import adapters
 * should call `parseBatch({ format: 'text' })`; this shape remains for older queue
 * callers that expect an immediate valid-line summary.
 */
export function parseUploadText(content: string): ParsedUpload {
  const result = parseText(content, {
    filename: 'upload.txt',
    base: { voiceId: 'alloy', model: 'tts-1', format: 'wav', metadata: {} },
  })
  if (!result.ok) return { items: [], added: 0, skippedBlank: 0, rejectedTooLong: 0 }
  const items = result.preview.candidates.flatMap((candidate) =>
    candidate.valid ? [{ text: candidate.input.text }] : [],
  )
  return {
    items,
    added: result.preview.counts.valid,
    skippedBlank: result.preview.counts.blank,
    rejectedTooLong: result.preview.counts.rejected,
  }
}
