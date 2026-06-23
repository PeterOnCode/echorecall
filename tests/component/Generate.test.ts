import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { MAX_INPUT_LENGTH, MAX_UPLOAD_BYTES } from '#core/client'
import GeneratePage from '~/pages/index.vue'

// Component coverage for the 005 Generate workspace (US1 / FR-001..008): the
// surface is a resizable two-pane dashboard — the queue list on the left, the
// per-item metadata editor on the right. Selecting a row loads it into the detail
// pane; with nothing selected the detail pane shows its empty state. The interim
// upload + text-add path (kept until US2/US4) still builds the queue, and a single
// Generate produces audio per item with isolated per-item failures. The TTS
// endpoints are mocked at the HTTP boundary (no provider/network), so this drives
// the real queue + generate composables and the redesigned Generate page UI.

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

async function selectRow(wrapper: Awaited<ReturnType<typeof mountPage>>, index: number) {
  await wrapper.findAll('[data-test="queue-row"]')[index]!.trigger('click')
  await flushPromises()
}

describe('Generate page (two-pane workspace)', () => {
  it('appends a queue row when typing text and clicking Add', async () => {
    const wrapper = await mountPage()
    expect(wrapper.findAll('[data-test="queue-row"]')).toHaveLength(0)

    await addTyped(wrapper, 'Hello world')

    const rows = wrapper.findAll('[data-test="queue-row"]')
    expect(rows).toHaveLength(1)
    expect(rows[0]!.text()).toContain('Hello world')
  })

  it('shows the detail empty state until a row is selected', async () => {
    const wrapper = await mountPage()
    // Nothing selected on load → empty placeholder, no editor.
    expect(wrapper.find('[data-test="dashboard-detail-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="queue-item-editor"]').exists()).toBe(false)

    await addTyped(wrapper, 'still nothing selected')
    expect(wrapper.find('[data-test="dashboard-detail-empty"]').exists()).toBe(true)
  })

  it('loads the selected row into the detail-pane editor and swaps on reselection', async () => {
    const wrapper = await mountPage()
    await addTyped(wrapper, 'first item')
    await addTyped(wrapper, 'second item')

    await selectRow(wrapper, 0)
    let editor = wrapper.find('[data-test="queue-item-editor"]')
    expect(editor.exists()).toBe(true)
    expect((editor.find('[data-test="edit-text"]').element as HTMLTextAreaElement).value).toBe('first item')

    await selectRow(wrapper, 1)
    editor = wrapper.find('[data-test="queue-item-editor"]')
    expect((editor.find('[data-test="edit-text"]').element as HTMLTextAreaElement).value).toBe('second item')
    // Editing in the detail pane no longer needs the table.
    expect(wrapper.find('[data-test="dashboard-detail-empty"]').exists()).toBe(false)
  })

  it('appends one row per valid uploaded line after existing rows and shows the summary', async () => {
    const wrapper = await mountPage()
    await addTyped(wrapper, 'typed first')

    const content = `one\n\n${'x'.repeat(MAX_INPUT_LENGTH + 1)}\ntwo\n`
    await setFile(wrapper, new File([content], 'batch.txt', { type: 'text/plain' }))
    await flushPromises()

    const rows = wrapper.findAll('[data-test="queue-row"]')
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

    expect(wrapper.findAll('[data-test="queue-row"]')).toHaveLength(0)
    expect(wrapper.find('[data-test="upload-error"]').exists()).toBe(true)
  })

  it('clamps the form speed to its bounds (0.25–4)', async () => {
    const wrapper = await mountPage()
    const speed = wrapper.find('[data-test="speed"]')
    const el = speed.element as HTMLInputElement

    await speed.setValue('5')
    await speed.trigger('change')
    await speed.trigger('blur')
    await flushPromises()
    expect(el.value).toBe('4')

    await speed.setValue('0.1')
    await speed.trigger('change')
    await speed.trigger('blur')
    await flushPromises()
    expect(el.value).toBe('0.25')
  })

  it('removes a successfully generated item and keeps a failed one for retry', async () => {
    const wrapper = await mountPage()
    await addTyped(wrapper, 'alpha')
    await addTyped(wrapper, 'boom')

    // Generate now lives in the centralized toolbar (US2).
    await wrapper.find('[data-test="toolbar-generate"]').trigger('click')

    await vi.waitFor(() => {
      // The successful row leaves the queue (FR-005b); only the failed row remains.
      const rows = wrapper.findAll('[data-test="queue-row"]')
      expect(rows).toHaveLength(1)
      expect(rows[0]!.text()).toContain('boom')
      expect(wrapper.find('[data-test="item-status"]').text()).toMatch(/fail/i)
    })
    await flushPromises()

    // The run's success is still downloadable as a batch even though it left the queue (FR-022).
    expect(wrapper.find('[data-test="download-all"]').exists()).toBe(true)
  })

  it('applies the form metadata to a row added before the metadata was filled', async () => {
    const wrapper = await mountPage()
    // Row first, metadata after — the order that previously left the row untagged.
    await addTyped(wrapper, 'metadata-after')
    // Nothing selected → the single visible meta-title is the shared form editor.
    await wrapper.find('[data-test="meta-title"]').setValue('Shared Title')

    postedBodies.length = 0
    await wrapper.find('[data-test="toolbar-generate"]').trigger('click')

    await vi.waitFor(() => {
      const sent = postedBodies.find((b) => b.text === 'metadata-after')
      expect(sent?.metadata?.title).toBe('Shared Title')
    })
  })

  it('preserves a per-row metadata edit through generation, untouched by the shared form metadata', async () => {
    const wrapper = await mountPage()
    await addTyped(wrapper, 'per-row')
    await addTyped(wrapper, 'shared')

    // Shared form metadata (no row selected) is meant for untouched rows only.
    await wrapper.find('[data-test="meta-title"]').setValue('Shared Title')

    // Select the first row and give it its own title in the detail-pane editor.
    await selectRow(wrapper, 0)
    await wrapper.find('[data-test="queue-item-editor"] [data-test="meta-title"]').setValue('Per-row Title')

    postedBodies.length = 0
    await wrapper.find('[data-test="toolbar-generate"]').trigger('click')

    await vi.waitFor(() => {
      // The edited row keeps its own title; the untouched row gets the shared one.
      expect(postedBodies.find((b) => b.text === 'per-row')?.metadata?.title).toBe('Per-row Title')
      expect(postedBodies.find((b) => b.text === 'shared')?.metadata?.title).toBe('Shared Title')
    })
  })
})
