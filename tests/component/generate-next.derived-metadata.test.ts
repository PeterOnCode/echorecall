import { describe, it, expect, beforeEach } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { defineEventHandler, readBody } from 'h3'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import GenerateNextPage from '~/pages/generate-next.vue'

// 007 · Title + Track are not user-editable on Generate — they are derived at generation time
// and sent to the API. This drives the REAL page: add rows, click Generate, and assert each
// captured POST body carries the derived Title (first 60 chars of the text, ellipsised when
// longer) and Track (the row's 1-based queue position).

registerEndpoint('/api/voices', () => ({ voices: [{ id: 'alloy', label: 'Alloy' }] }))
registerEndpoint('/api/settings/defaults', () => ({ defaultTags: {} }))
registerEndpoint('/api/settings/generation-defaults', () => ({ generationDefaults: {} }))

const postedBodies: { text?: string; metadata?: Record<string, unknown> }[] = []
registerEndpoint('/api/generations', {
  method: 'POST',
  handler: defineEventHandler(async (event) => {
    const body = await readBody<{ text?: string; metadata?: Record<string, unknown> }>(event)
    postedBodies.push(body)
    const id = `id-${postedBodies.length}`
    return { id, audioUrl: `/api/generations/${id}/audio` }
  }),
})

async function drainMount() {
  for (let i = 0; i < 6; i++) await flushPromises()
}

async function addTyped(wrapper: Awaited<ReturnType<typeof mountSuspended>>, text: string) {
  await wrapper.find('[data-test="add-text-input"]').setValue(text)
  await wrapper.find('[data-test="add-text-submit"]').trigger('click')
  await flushPromises()
}

beforeEach(() => {
  postedBodies.length = 0
  localStorage.clear()
})

describe('generate-next derived Title + Track reach the API (007)', () => {
  it('sends the first-60-char title and the 1-based queue position as track', async () => {
    const wrapper = await mountSuspended(GenerateNextPage)
    await drainMount()

    const short = 'Short narration'
    const long = 'x'.repeat(61)
    await addTyped(wrapper, short)
    await addTyped(wrapper, long)

    await wrapper.find('[data-test="action-generate"]').trigger('click')
    for (let i = 0; i < 8; i++) await flushPromises()

    expect(postedBodies).toHaveLength(2)
    const first = postedBodies.find((b) => b.text === short)!
    const second = postedBodies.find((b) => b.text === long)!

    // Title: short text used as-is; long text truncated to 60 chars + ellipsis.
    expect(first.metadata?.title).toBe(short)
    expect(second.metadata?.title).toBe(`${'x'.repeat(60)}…`)

    // Track: 1-based position in the queue (first row → 1, second row → 2).
    expect(first.metadata?.track).toBe('1')
    expect(second.metadata?.track).toBe('2')

    wrapper.unmount()
  })
})
