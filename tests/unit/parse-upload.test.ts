import { describe, it, expect } from 'vitest'
import { parseUploadText } from '../../src/core/batch/parse-upload'
import { MAX_INPUT_LENGTH } from '../../src/core/tts/generate'

// parseUploadText turns the raw text of an uploaded `.txt` into one queue item
// per valid line (FR-001..005). It is pure so the upload is parsed client-side
// and never persisted. Blank lines are skipped; lines over the input cap are
// rejected; the returned counts drive the "added / skipped / rejected" summary.

describe('parseUploadText', () => {
  it('yields one item per trimmed non-blank line, in file order', () => {
    const result = parseUploadText('  First line  \nSecond line\nThird')
    expect(result.items).toEqual([
      { text: 'First line' },
      { text: 'Second line' },
      { text: 'Third' },
    ])
    expect(result.added).toBe(3)
    expect(result.skippedBlank).toBe(0)
    expect(result.rejectedTooLong).toBe(0)
  })

  it('skips blank and whitespace-only lines and counts them (trailing newline ignored)', () => {
    const result = parseUploadText('one\n\n   \n\ttwo\n')
    expect(result.items.map((i) => i.text)).toEqual(['one', 'two'])
    expect(result.added).toBe(2)
    // The two interior blank lines are counted; the conventional trailing newline is not.
    expect(result.skippedBlank).toBe(2)
    expect(result.rejectedTooLong).toBe(0)
  })

  it('rejects lines longer than the input cap and counts them', () => {
    const long = 'a'.repeat(MAX_INPUT_LENGTH + 1)
    const exact = 'b'.repeat(MAX_INPUT_LENGTH)
    const result = parseUploadText(`keep\n${long}\n${exact}`)
    expect(result.items.map((i) => i.text)).toEqual(['keep', exact])
    expect(result.added).toBe(2)
    expect(result.skippedBlank).toBe(0)
    expect(result.rejectedTooLong).toBe(1)
  })

  it('handles CRLF line endings and an empty document', () => {
    expect(parseUploadText('a\r\nb\r\n').items.map((i) => i.text)).toEqual(['a', 'b'])
    const empty = parseUploadText('')
    expect(empty.items).toEqual([])
    expect(empty).toMatchObject({ added: 0, skippedBlank: 0, rejectedTooLong: 0 })
  })
})
