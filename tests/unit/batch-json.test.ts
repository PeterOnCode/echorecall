import { describe, expect, it } from 'vitest'
import type { BatchBaseInput, BatchParseResult } from '../../src/core/batch/contract'
import { parseBatch } from '../../src/core/batch/parse-batch'

const base: BatchBaseInput = {
  voiceId: 'alloy',
  model: 'tts-1',
  format: 'wav',
  instructions: 'Base instructions',
  metadata: {
    artist: 'Base artist',
    album: 'Base album',
    languages: ['eng'],
  },
}

function parseJson(content: string): BatchParseResult {
  return parseBatch({ content, filename: 'batch.json', format: 'json', base })
}

function expectBlockingCode(result: BatchParseResult, code: string): void {
  expect(result).toMatchObject({ ok: false, error: { code } })
}

describe('JSON batch import – strict parsing and equivalence (008 · US3)', () => {
  it('normalizes equivalent YAML and JSON documents identically and preserves item order', () => {
    const yaml = parseBatch({
      filename: 'batch.yaml',
      format: 'yaml',
      base,
      content: `
schema: echorecall.batch
version: 1
defaults:
  voiceId: nova
  metadata:
    album: Imported album
    languages: [hun]
items:
  - text: |-
      First line
      Second line
  - text: Duplicate
  - text: Duplicate
    instructions: null
    metadata:
      artist: null
`,
    })
    const json = parseJson(JSON.stringify({
      schema: 'echorecall.batch',
      version: 1,
      defaults: {
        voiceId: 'nova',
        metadata: { album: 'Imported album', languages: ['hun'] },
      },
      items: [
        { text: 'First line\nSecond line' },
        { text: 'Duplicate' },
        { text: 'Duplicate', instructions: null, metadata: { artist: null } },
      ],
    }))

    expect(yaml.ok).toBe(true)
    expect(json.ok).toBe(true)
    if (!yaml.ok || !json.ok) throw new Error('Expected equivalent previews')

    expect(json.preview).toMatchObject({
      filename: 'batch.json',
      format: 'json',
      counts: { valid: 3, rejected: 0, blank: 0 },
      canConfirm: true,
    })
    expect(json.preview.candidates.map((candidate) => candidate.location)).toEqual([
      { kind: 'item', number: 1 },
      { kind: 'item', number: 2 },
      { kind: 'item', number: 3 },
    ])
    expect(json.preview.candidates).toEqual(yaml.preview.candidates)
  })

  it.each([
    ['comments', '{"schema":"echorecall.batch",/* no comments */"version":1,"items":[]}'],
    ['a trailing comma', '{"schema":"echorecall.batch","version":1,"items":[],}'],
    ['single-quoted strings', "{'schema':'echorecall.batch','version':1,'items':[]}"],
    ['unquoted properties', '{schema:"echorecall.batch",version:1,items:[]}'],
    ['non-JSON numeric values', '{"schema":"echorecall.batch","version":1,"items":[],"extra":NaN}'],
  ])('rejects %s even when YAML syntax could accept it', (_label, content) => {
    expectBlockingCode(parseJson(content), 'malformed')
  })

  it.each([
    [
      'a repeated literal property',
      '{"schema":"echorecall.batch","version":1,"version":1,"items":[]}',
    ],
    [
      'a repeated nested property',
      '{"schema":"echorecall.batch","version":1,"items":[{"text":"one","text":"two"}]}',
    ],
    [
      'decoded escaped-equivalent properties',
      '{"schema":"echorecall.batch","version":1,"items":[{"text":"one","t\\u0065xt":"two"}]}',
    ],
  ])('blocks %s instead of applying first- or last-property wins', (_label, content) => {
    expectBlockingCode(parseJson(content), 'duplicateProperty')
  })

  it.each([
    ['missing schema', '{"version":1,"items":[]}', 'schema'],
    ['wrong schema', '{"schema":"echorecall.queue","version":1,"items":[]}', 'schema'],
    ['missing version', '{"schema":"echorecall.batch","items":[]}', 'version'],
    ['unsupported version', '{"schema":"echorecall.batch","version":2,"items":[]}', 'version'],
  ])('blocks a document with %s', (_label, content, code) => {
    expectBlockingCode(parseJson(content), code)
  })

  it('returns a typed malformed error for truncated JSON', () => {
    const result = parseJson('{"schema":"echorecall.batch","version":1,"items":[')
    expect(result).toMatchObject({ ok: false, error: { scope: 'document', code: 'malformed' } })
  })
})
