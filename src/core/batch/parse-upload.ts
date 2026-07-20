import { parseText } from './parse-text'

/** Result of parsing an uploaded `.txt` batch into queue items. */
export interface ParsedUpload {
  /** One entry per valid, trimmed, non-blank line, in file order. */
  items: { text: string }[]
  added: number
  skippedBlank: number
  rejectedTooLong: number
}

/**
 * Parse the raw text of an uploaded `.txt` into one queue item per valid line
 * (FR-001..005). Pure and side-effect-free so the upload is parsed in-place and
 * never persisted. Blank/whitespace-only lines are skipped; lines longer than the
 * input cap are rejected; the counts drive the "added / skipped / rejected"
 * summary. A wholly empty (or whitespace-only) document yields zero of each.
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
