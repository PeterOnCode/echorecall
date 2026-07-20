import { describe, expect, it } from 'vitest'
import type { BatchBaseInput, BatchParseResult } from '../../src/core/batch/contract'
import { parseBatch } from '../../src/core/batch/parse-batch'
import { parseUploadText } from '../../src/core/batch/parse-upload'
import { MAX_INPUT_LENGTH } from '../../src/core/tts/generate'

const base: BatchBaseInput = {
  voiceId: 'alloy',
  model: 'tts-1',
  format: 'wav',
  instructions: 'Read clearly',
  metadata: { artist: 'Form artist' },
}

function parseText(content: string): BatchParseResult {
  return parseBatch({ content, filename: 'lines.txt', format: 'text', base })
}

describe('plain-text batch preview (008 · US3)', () => {
  it.each([
    ['LF', '  First line  \nSecond line\nFirst line'],
    ['CRLF', '  First line  \r\nSecond line\r\nFirst line'],
  ])('trims %s lines while preserving original one-based locations, duplicates, and order', (_label, content) => {
    const result = parseText(content)
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(`Expected preview, received ${result.error.code}`)

    expect(result.preview.candidates.map((candidate) => ({
      location: candidate.location,
      text: candidate.valid ? candidate.input.text : null,
    }))).toEqual([
      { location: { kind: 'line', number: 1 }, text: 'First line' },
      { location: { kind: 'line', number: 2 }, text: 'Second line' },
      { location: { kind: 'line', number: 3 }, text: 'First line' },
    ])
    expect(result.preview).toMatchObject({
      filename: 'lines.txt',
      format: 'text',
      counts: { valid: 3, rejected: 0, blank: 0 },
      canConfirm: true,
    })
    expect(result.preview.candidates[0]).toMatchObject({
      valid: true,
      input: { ...base, text: 'First line' },
    })
  })

  it('counts internal blanks but ignores one conventional terminal newline', () => {
    const result = parseText('one\n\n   \n\ttwo\n')
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(`Expected preview, received ${result.error.code}`)

    expect(result.preview.candidates.map((candidate) => candidate.location)).toEqual([
      { kind: 'line', number: 1 },
      { kind: 'line', number: 4 },
    ])
    expect(result.preview.counts).toEqual({ valid: 2, rejected: 0, blank: 2 })
  })

  it('keeps an oversized nonblank line visible as an invalid candidate', () => {
    const long = 'a'.repeat(MAX_INPUT_LENGTH + 1)
    const exact = 'b'.repeat(MAX_INPUT_LENGTH)
    const result = parseText(`keep\n${long}\n${exact}`)
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(`Expected preview, received ${result.error.code}`)

    expect(result.preview.counts).toEqual({ valid: 2, rejected: 1, blank: 0 })
    expect(result.preview.canConfirm).toBe(true)
    expect(result.preview.candidates[1]).toMatchObject({
      valid: false,
      location: { kind: 'line', number: 2 },
      issues: [{ code: 'textTooLong', path: 'lines[2]' }],
    })
    expect(result.preview.candidates[2]).toMatchObject({ valid: true, input: { text: exact } })
  })

  it.each(['', '   ', '  \n\t\r\n'])('preserves the zero-count whitespace-only compatibility result', (content) => {
    const result = parseText(content)
    expect(result).toMatchObject({
      ok: true,
      preview: {
        candidates: [],
        counts: { valid: 0, rejected: 0, blank: 0 },
        canConfirm: false,
      },
    })
  })
})

describe('parseUploadText compatibility export (008 · US3)', () => {
  it('retains the legacy append summary for existing callers during migration', () => {
    const long = 'a'.repeat(MAX_INPUT_LENGTH + 1)
    expect(parseUploadText(` one \n\n${long}\ntwo\n`)).toEqual({
      items: [{ text: 'one' }, { text: 'two' }],
      added: 2,
      skippedBlank: 1,
      rejectedTooLong: 1,
    })
  })
})
