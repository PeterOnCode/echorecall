import { describe, it, expect } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { defineEventHandler, getQuery, readBody } from 'h3'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import GenerateNextPage from '~/pages/generate-next.vue'

// 007 · US2 (T015 / FR-008/FR-009/FR-010): the embedded 006 Library workspace on the
// Generate page — filter bar + file table + Tag Editor inspector + status bar over the
// SAME useLibrary data, WITHOUT the waveform player (Library-only, G-EMBED). New
// recordings appear in the embedded table after a generation run.
registerEndpoint('/api/voices', () => ({ voices: [{ id: 'alloy', label: 'Alloy' }] }))
registerEndpoint('/api/settings/defaults', () => ({ defaultTags: {} }))

let listCalls = 0
const created: Record<string, unknown>[] = []
registerEndpoint(
  '/api/generations',
  defineEventHandler(async (event) => {
    if (event.method === 'POST') {
      const body = await readBody<{ text?: string; voiceId?: string; format?: string; metadata?: Record<string, unknown> }>(event)
      const n = created.length + 1
      const rec = {
        id: `g${n}`,
        text: body?.text ?? '',
        voiceId: body?.voiceId ?? 'alloy',
        model: null,
        format: body?.format ?? 'mp3',
        speed: null,
        createdAt: '2026-07-05T00:00:00.000Z',
        filename: `gen-${n}.mp3`,
        audioUrl: `/api/generations/g${n}/audio`,
        metadata: body?.metadata ?? {},
      }
      created.push(rec)
      return { ...rec }
    }
    // GET list
    listCalls++
    const q = getQuery(event)
    return { generations: created.slice(), total: created.length, page: Number(q.page ?? 1), pageSize: Number(q.pageSize ?? 20) }
  }),
)

async function mountPage() {
  const wrapper = await mountSuspended(GenerateNextPage)
  await flushPromises() // resolve onMounted (voices + defaults + embedded library load)
  return wrapper
}

describe('generate-next embedded library workspace (US2)', () => {
  it('renders the 006 workspace without the waveform player', async () => {
    const wrapper = await mountPage()
    expect(wrapper.find('[data-test="gen-embed"]').exists()).toBe(true)
    for (const id of ['library-search', 'library-file-table', 'tag-inspector', 'status-bar']) {
      expect(wrapper.find(`[data-test="${id}"]`).exists(), id).toBe(true)
    }
    expect(wrapper.find('[data-test="waveform-player"]').exists()).toBe(false)
  })

  it('refreshes the embedded library after a generation run (FR-010)', async () => {
    const wrapper = await mountPage()
    const callsBefore = listCalls

    await wrapper.find('[data-test="add-text-input"]').setValue('hello world')
    await wrapper.find('[data-test="add-text-submit"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-test="action-generate"]').trigger('click')
    // Drain the fire-and-forget async chain: POST generate → removeItem → reload GET.
    for (let i = 0; i < 6; i++) await flushPromises()

    expect(listCalls).toBeGreaterThan(callsBefore) // the run triggered a reload
    expect(wrapper.text()).toContain('gen-1.mp3') // the new recording is in the embedded table
  })
})
