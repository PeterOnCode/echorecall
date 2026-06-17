import { MAX_INPUT_LENGTH } from '../tts/generate'

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
  if ((content ?? '').trim().length === 0) {
    return { items: [], added: 0, skippedBlank: 0, rejectedTooLong: 0 }
  }

  const lines = content.split(/\r?\n/)
  // Ignore a single conventional trailing newline so a normal text file is not
  // penalised with a phantom blank line.
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()

  const items: { text: string }[] = []
  let skippedBlank = 0
  let rejectedTooLong = 0
  for (const raw of lines) {
    const text = raw.trim()
    if (text.length === 0) {
      skippedBlank++
    } else if (text.length > MAX_INPUT_LENGTH) {
      rejectedTooLong++
    } else {
      items.push({ text })
    }
  }
  return { items, added: items.length, skippedBlank, rejectedTooLong }
}
