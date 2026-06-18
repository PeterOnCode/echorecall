import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { MAX_INPUT_LENGTH, MAX_UPLOAD_BYTES } from '#core/client'
import GeneratePage from '~/pages/index.vue'

// Component coverage for the US1 batch studio (FR-001..008): build a generation
// list by typing and/or uploading a `.txt`, then a single Generate produces audio
// per item with isolated per-item failures. The TTS endpoints are mocked at the
// HTTP boundary (no provider/network), so this drives the real queue + generate
// composables and the Generate page UI.

registerEndpoint('/api/voices', () => ({
  voices: [
    { id: 'alloy', label: 'Alloy' },
    { id: 'echo', label: 'Echo' },
  ],
}))

// Captures each POST body so tests can assert what the queue actually sent
// (e.g. the form metadata applied to the batch).
const postedBodies: { text?: string; metadata?: Record<string, unknown> }[] = []

// One item is made to fail (text === 'boom') so we can prove failure isolation.
registerEndpoint('/api/generations', {
  method: 'POST',
  handler: defineEventHandler(async (event) => {
    const body = await readBody<{ text?: string; metadata?: Record<string, unknown> }>(event)
    postedBodies.push(body)
    if (body?.text === 'boom') {
      setResponseStatus(event, 502)
      return { error: { code: 'PROVIDER_UNAVAILABLE', message: 'boom failed' } }
    }
    const id = `id-${body?.text ?? 'x'}`
    return {
      id,
      text: body?.text,
      voiceId: 'alloy',
      format: 'mp3',
      createdAt: '2026-06-17T10:00:00.000Z',
      filename: `${id}.mp3`,
      metadata: {},
      audioUrl: `/api/generations/${id}/audio`,
    }
  }),
})

async function mountPage() {
  const wrapper = await mountSuspended(GeneratePage)
  await flushPromises() // resolve onMounted loadVoices()
  return wrapper
}

async function addTyped(wrapper: Awaited<ReturnType<typeof mountPage>>, text: string) {
  await wrapper.find('[data-test="add-text"]').setValue(text)
  await wrapper.find('[data-test="add-item"]').trigger('click')
}

function setFile(wrapper: Awaited<ReturnType<typeof mountPage>>, file: File) {
  const input = wrapper.find('[data-test="upload-input"]')
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
  return input.trigger('change')
}

describe('Generate page (batch studio)', () => {
  it('appends a queue row when typing text and clicking Add', async () => {
    const wrapper = await mountPage()
    expect(wrapper.findAll('[data-test="queue-item"]')).toHaveLength(0)

    await addTyped(wrapper, 'Hello world')

    const rows = wrapper.findAll('[data-test="queue-item"]')
    expect(rows).toHaveLength(1)
    expect(rows[0]!.text()).toContain('Hello world')
  })

  it('appends one row per valid uploaded line after existing rows and shows the summary', async () => {
    const wrapper = await mountPage()
    await addTyped(wrapper, 'typed first')

    const content = `one\n\n${'x'.repeat(MAX_INPUT_LENGTH + 1)}\ntwo\n`
    await setFile(wrapper, new File([content], 'batch.txt', { type: 'text/plain' }))
    await flushPromises()

    const rows = wrapper.findAll('[data-test="queue-item"]')
    // existing typed row + two valid uploaded lines, appended in order
    expect(rows).toHaveLength(3)
    expect(rows[0]!.text()).toContain('typed first')
    expect(rows[1]!.text()).toContain('one')
    expect(rows[2]!.text()).toContain('two')

    expect(wrapper.find('[data-test="summary-added"]').text()).toBe('2')
    expect(wrapper.find('[data-test="summary-blank"]').text()).toBe('1')
    expect(wrapper.find('[data-test="summary-rejected"]').text()).toBe('1')
  })

  it('rejects an over-large upload without adding rows', async () => {
    const wrapper = await mountPage()
    const tooBig = new File([new Uint8Array(MAX_UPLOAD_BYTES + 1)], 'big.txt', {
      type: 'text/plain',
    })
    await setFile(wrapper, tooBig)
    await flushPromises()

    expect(wrapper.findAll('[data-test="queue-item"]')).toHaveLength(0)
    expect(wrapper.find('[data-test="upload-error"]').exists()).toBe(true)
  })

  it('generates every item with one call per row, isolating a single failure', async () => {
    const wrapper = await mountPage()
    await addTyped(wrapper, 'alpha')
    await addTyped(wrapper, 'boom')

    await wrapper.find('[data-test="generate-all"]').trigger('click')

    await vi.waitFor(() => {
      const statuses = wrapper.findAll('[data-test="item-status"]').map((s) => s.text())
      expect(statuses[0]).toMatch(/done/i)
      expect(statuses[1]).toMatch(/fail/i)
    })
  })

  it('applies the form metadata to a row added before the metadata was filled', async () => {
    const wrapper = await mountPage()
    // Row first, metadata after — the order that previously left the row untagged.
    await addTyped(wrapper, 'metadata-after')
    await wrapper.find('[data-test="meta-title"]').setValue('Shared Title')

    postedBodies.length = 0
    await wrapper.find('[data-test="generate-all"]').trigger('click')

    await vi.waitFor(() => {
      const sent = postedBodies.find((b) => b.text === 'metadata-after')
      expect(sent?.metadata?.title).toBe('Shared Title')
    })
  })
})
