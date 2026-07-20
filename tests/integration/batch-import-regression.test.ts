import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref, watch } from 'vue'
import type { BatchBaseInput } from '../../src/core/batch/contract'
import { parseBatch } from '../../src/core/batch/parse-batch'
import { useQueue } from '../../app/composables/useQueue'
import { useQueueFile } from '../../app/composables/useQueueFile'

const base: BatchBaseInput = {
  voiceId: 'alloy',
  model: 'tts-1',
  format: 'wav',
  metadata: {},
}

function fileWith(content: string): File {
  return { text: async () => content } as File
}

beforeEach(() => {
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('watch', watch)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('batch JSON and saved-queue JSON remain separate (008 · US3)', () => {
  it('appends a confirmed echorecall.batch JSON preview to the current queue', () => {
    const queue = useQueue()
    queue.addItem('existing row')
    const result = parseBatch({
      filename: 'append.json',
      format: 'json',
      base,
      content: JSON.stringify({
        schema: 'echorecall.batch',
        version: 1,
        items: [{ text: 'first imported row' }, { text: 'second imported row' }],
      }),
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(`Expected preview, received ${result.error.code}`)
    const inputs = result.preview.candidates.flatMap((candidate) => candidate.valid ? [candidate.input] : [])
    queue.appendImported(inputs, result.preview.filename, { metadataMode: 'structured' })

    expect(queue.items.value.map((item) => item.text)).toEqual([
      'existing row',
      'first imported row',
      'second imported row',
    ])
    expect(queue.items.value.slice(1).every((item) => item.sourceName === 'append.json')).toBe(true)
  })

  it('keeps the current queue until confirmation, then replaces it for echorecall.queue JSON', async () => {
    const queue = useQueue()
    queue.addItem('row awaiting replacement confirmation')
    const result = await useQueueFile().importQueue(fileWith(JSON.stringify({
      schema: 'echorecall.queue',
      version: 1,
      items: [{
        text: 'loaded row',
        voiceId: 'alloy',
        model: 'tts-1',
        format: 'wav',
        metadata: {},
        source: 'text',
      }],
    })))

    expect(result.ok).toBe(true)
    expect(queue.items.value.map((item) => item.text)).toEqual(['row awaiting replacement confirmation'])
    if (!result.ok) throw new Error(`Expected saved queue, received ${result.reason}`)

    // This is the existing page confirmation callback's replacement operation.
    queue.loadDocument(result.doc)
    expect(queue.items.value.map((item) => item.text)).toEqual(['loaded row'])
  })

  it('does not reinterpret one JSON schema as the other workflow', async () => {
    const batchDocument = JSON.stringify({ schema: 'echorecall.batch', version: 1, items: [] })
    const queueDocument = JSON.stringify({ schema: 'echorecall.queue', version: 1, items: [] })

    expect(parseBatch({ content: queueDocument, filename: 'queue.json', format: 'json', base }))
      .toMatchObject({ ok: false, error: { code: 'schema' } })
    await expect(useQueueFile().importQueue(fileWith(batchDocument)))
      .resolves.toEqual({ ok: false, reason: 'schema' })
  })
})
