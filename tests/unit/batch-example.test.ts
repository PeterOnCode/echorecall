import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import type { BatchBaseInput } from '../../src/core/batch/contract'
import { parseBatch } from '../../src/core/batch/parse-batch'

const base: BatchBaseInput = {
  voiceId: 'echo',
  model: 'tts-1',
  format: 'wav',
  instructions: 'Base instructions',
  metadata: { comment: 'Base comment', genre: 'Base genre' },
}

describe('downloadable batch example (008 · US4)', () => {
  it('round-trips through the real YAML parser with representative v1 behavior', async () => {
    const filename = 'echorecall-batch-v1.yaml'
    const content = await readFile(
      new URL(`../../public/examples/${filename}`, import.meta.url),
      'utf8',
    )
    const result = parseBatch({ content, filename, format: 'yaml', base })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(`Expected example preview, received ${result.error.code}`)

    expect(result.preview).toMatchObject({
      filename,
      format: 'yaml',
      counts: { valid: 2, rejected: 0, blank: 0 },
      canConfirm: true,
    })
    expect(result.preview.candidates.map((candidate) => candidate.location)).toEqual([
      { kind: 'item', number: 1 },
      { kind: 'item', number: 2 },
    ])

    const [first, second] = result.preview.candidates
    expect(first?.valid).toBe(true)
    expect(second?.valid).toBe(true)
    if (!first?.valid || !second?.valid) throw new Error('Expected two valid example candidates')

    expect(first.input).toEqual({
      text: 'The first queue item can contain\nmultiple lines of text.',
      voiceId: 'nova',
      model: 'gpt-4o-mini-tts',
      format: 'mp3',
      instructions: 'Speak clearly',
      metadata: {
        comment: 'Base comment',
        genre: 'Base genre',
        artist: 'EchoRecall',
        album: 'Example batch',
        languages: ['eng'],
      },
    })
    expect(second.input).toEqual({
      text: 'The second queue item.',
      voiceId: 'alloy',
      model: 'gpt-4o-mini-tts',
      format: 'mp3',
      metadata: {
        comment: 'Base comment',
        genre: 'Base genre',
        album: 'Example batch',
        languages: ['eng'],
        title: 'Custom title',
        track: '2',
      },
    })
  })
})
