import { describe, it, expect, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { defineEventHandler, readBody } from 'h3'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import GeneratePage from '~/pages/index.vue'

// Component coverage for US10 (FR-048): the Generate form pre-fills non-title
// metadata from deployment defaults (GET /api/settings/defaults), Title stays
// blank, the defaults flow onto new queue rows (rows clone the shared form
// metadata), and the user can still override or clear any field before generating.
// Endpoints are mocked at the HTTP boundary; this drives the real queue + page.

registerEndpoint('/api/voices', () => ({ voices: [{ id: 'alloy', label: 'Alloy' }] }))

registerEndpoint('/api/settings/defaults', () => ({
  defaultTags: {
    artist: 'EchoRecall',
    album: 'Daily Briefing',
    genre: 'Speech',
    comment: 'Auto-generated',
    languages: ['eng', 'hun'],
  },
}))

const postedBodies: { text?: string; metadata?: Record<string, unknown> }[] = []
registerEndpoint('/api/generations', {
  method: 'POST',
  handler: defineEventHandler(async (event) => {
    const body = await readBody<{ text?: string; metadata?: Record<string, unknown> }>(event)
    postedBodies.push(body)
    const id = `id-${body?.text ?? 'x'}`
    return {
      id,
      text: body?.text,
      voiceId: 'alloy',
      format: 'mp3',
      createdAt: '2026-06-20T00:00:00.000Z',
      filename: `${id}.mp3`,
      metadata: {},
      audioUrl: `/api/generations/${id}/audio`,
    }
  }),
})

async function mountPage() {
  const wrapper = await mountSuspended(GeneratePage)
  await flushPromises() // resolve onMounted loadVoices() + the defaults fetch
  return wrapper
}

function inputValue(wrapper: Awaited<ReturnType<typeof mountPage>>, test: string): string {
  return (wrapper.find(`[data-test="${test}"]`).element as HTMLInputElement | HTMLTextAreaElement).value
}

describe('Generate form — default tag values (US10)', () => {
  it('pre-fills non-title fields from deployment defaults, leaving Title blank', async () => {
    const wrapper = await mountPage()
    // The defaults arrive from an async fetch on mount; wait for them to settle.
    await vi.waitFor(() => expect(inputValue(wrapper, 'meta-artist')).toBe('EchoRecall'))

    expect(inputValue(wrapper, 'meta-album')).toBe('Daily Briefing')
    expect(inputValue(wrapper, 'meta-genre')).toBe('Speech')
    expect(inputValue(wrapper, 'meta-comment')).toBe('Auto-generated')

    const chips = wrapper.findAll('[data-test="meta-language-chip"]').map((c) => c.text())
    expect(chips.join(' ')).toContain('eng')
    expect(chips.join(' ')).toContain('hun')

    // Title is never defaulted (FR-048).
    expect(inputValue(wrapper, 'meta-title')).toBe('')
  })

  it('carries the defaults onto a new row, and honors per-field override/clear at generate', async () => {
    const wrapper = await mountPage()
    // Let the defaults settle on the form before the user edits (as on real mount).
    await vi.waitFor(() => expect(inputValue(wrapper, 'meta-artist')).toBe('EchoRecall'))

    // Override one default and clear another before adding the row.
    await wrapper.find('[data-test="meta-artist"]').setValue('Custom Artist')
    await wrapper.find('[data-test="meta-genre"]').setValue('')

    await wrapper.find('[data-test="add-text"]').setValue('hello')
    await wrapper.find('[data-test="add-item"]').trigger('click')

    postedBodies.length = 0
    await wrapper.find('[data-test="generate-all"]').trigger('click')

    await vi.waitFor(() => {
      const sent = postedBodies.find((b) => b.text === 'hello')
      expect(sent).toBeTruthy()
      expect(sent?.metadata?.artist).toBe('Custom Artist') // user override wins
      expect(sent?.metadata?.genre).toBeUndefined() // cleared default stays cleared
      expect(sent?.metadata?.album).toBe('Daily Briefing') // untouched default preserved
      expect(sent?.metadata?.languages).toEqual(['eng', 'hun'])
      expect(sent?.metadata?.title).toBeUndefined() // never defaulted
    })
  })
})
