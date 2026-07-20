import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import type { BatchBaseInput } from '../../src/core/batch/contract'
import { parseBatch } from '../../src/core/batch/parse-batch'

const base: BatchBaseInput = {
  voiceId: 'alloy',
  model: 'tts-1',
  format: 'wav',
  metadata: {},
}

describe('batch author documentation contract (008 · US4)', () => {
  it('defines every canonical field and authoring rule', async () => {
    const guide = await readFile(new URL('../../docs/batch-import.md', import.meta.url), 'utf8')

    for (const heading of [
      'Document shape',
      'Defaults and item fields',
      'Resolution and inheritance',
      'Metadata fields',
      'Validation and errors',
      'Track behavior',
      'Equivalent JSON',
    ]) {
      expect(guide).toMatch(new RegExp(`^## ${heading}`, 'm'))
    }

    for (const field of [
      'schema', 'version', 'defaults', 'items',
      'text', 'voiceId', 'model', 'format', 'instructions', 'metadata',
      'title', 'artist', 'album', 'genre', 'comment', 'recordedAt', 'track',
      'languages', 'customText', 'customUrl', 'notes', 'encodedBy',
      'albumArtist', 'composer', 'bpm', 'rating',
    ]) {
      expect(guide, `missing field ${field}`).toContain(`\`${field}\``)
    }

    expect(guide).toMatch(/current Generate[\s\S]*defaults[\s\S]*item overrides/i)
    expect(guide).toMatch(/missing[\s\S]*inherit/i)
    expect(guide).toMatch(/null[\s\S]*clear/i)
    expect(guide).toMatch(/array[\s\S]*replace/i)
    expect(guide).toMatch(/unknown field/i)
    expect(guide).toMatch(/4,096/)
    expect(guide).toMatch(/5 MiB/)
    expect(guide).toMatch(/duplicate YAML keys/i)
    expect(guide).toMatch(/custom tags/i)
    expect(guide).toMatch(/anchors/i)
    expect(guide).toMatch(/aliases/i)
    expect(guide).toMatch(/duplicate JSON propert/i)
    expect(guide).toMatch(/invalid item[\s\S]*valid siblings/i)
    expect(guide).toMatch(/Track[\s\S]*re-derived[\s\S]*queue order/i)
  })

  it('contains a strict, importable equivalent JSON example', async () => {
    const guide = await readFile(new URL('../../docs/batch-import.md', import.meta.url), 'utf8')
    const jsonBlock = guide.match(/## Equivalent JSON[\s\S]*?```json\n([\s\S]*?)\n```/i)?.[1]
    expect(jsonBlock).toBeDefined()
    if (!jsonBlock) throw new Error('Expected an equivalent JSON code block')

    expect(() => JSON.parse(jsonBlock)).not.toThrow()
    const result = parseBatch({
      content: jsonBlock,
      filename: 'documented-example.json',
      format: 'json',
      base,
    })
    expect(result).toMatchObject({
      ok: true,
      preview: { counts: { valid: 2, rejected: 0 }, canConfirm: true },
    })
  })
})
