import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { defineEventHandler, readBody, getMethod } from 'h3'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import DefaultTagsSettings from '~/components/settings/DefaultTagsSettings.vue'

// Component coverage for the Settings default-tags section (003 / US1+US2): it loads the
// saved values on mount, Save PUTs the entered fields, and Clear DELETEs them. There is
// no Title field (Title is never defaulted). The endpoint is mocked at the HTTP boundary
// (one handler branching on method); this drives the real component + useDefaultTags.

let saved: Record<string, unknown> = {}
const putBodies: Record<string, unknown>[] = []
let deleteCalls = 0
// When set, the GET handler blocks on this until released — lets us reproduce the
// window where the form is interactive before the saved defaults have loaded.
let loadGate: Promise<void> | null = null

registerEndpoint(
  '/api/settings/defaults',
  defineEventHandler(async (event) => {
    const method = getMethod(event)
    if (method === 'PUT') {
      const body = await readBody<Record<string, unknown>>(event)
      putBodies.push(body)
      const languages = String(body.languages ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      saved = {
        ...(body.artist ? { artist: String(body.artist).trim() } : {}),
        ...(languages.length ? { languages } : {}),
      }
      return { defaultTags: saved }
    }
    if (method === 'DELETE') {
      deleteCalls++
      saved = {}
      return { defaultTags: {} }
    }
    if (loadGate) await loadGate
    return { defaultTags: saved }
  }),
)

beforeEach(() => {
  saved = {}
  putBodies.length = 0
  deleteCalls = 0
  loadGate = null
})

function val(wrapper: Awaited<ReturnType<typeof mountSuspended>>, test: string): string {
  return (wrapper.find(`[data-test="${test}"]`).element as HTMLInputElement).value
}

describe('Settings — default tag values (003)', () => {
  it('renders the five fields, has no Title field, and shows the empty state initially', async () => {
    const wrapper = await mountSuspended(DefaultTagsSettings)
    await flushPromises()

    expect(wrapper.find('[data-test="default-artist"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="default-album"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="default-genre"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="default-comment"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="default-languages"]').exists()).toBe(true)
    // Title is never defaulted, so there is no Title input here.
    expect(wrapper.find('[data-test="default-title"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="default-status"]').exists()).toBe(true)
  })

  it('pre-fills the form from saved values on mount (languages joined for display)', async () => {
    saved = { artist: 'Jane Doe', languages: ['eng', 'hun'] }
    const wrapper = await mountSuspended(DefaultTagsSettings)
    await flushPromises()

    expect(val(wrapper, 'default-artist')).toBe('Jane Doe')
    expect(val(wrapper, 'default-languages')).toBe('eng, hun')
  })

  it('Save PUTs the entered values', async () => {
    const wrapper = await mountSuspended(DefaultTagsSettings)
    await flushPromises()

    await wrapper.find('[data-test="default-artist"]').setValue('Jane Doe')
    await wrapper.find('[data-test="default-languages"]').setValue('eng')
    await wrapper.find('[data-test="default-save"]').trigger('click')
    await flushPromises()

    expect(putBodies).toHaveLength(1)
    expect(putBodies[0]).toMatchObject({ artist: 'Jane Doe', languages: 'eng' })
  })

  it('does not Save while the initial load is still in flight (prevents blank overwrite)', async () => {
    saved = { artist: 'Jane', album: 'Briefing' }
    let release!: () => void
    loadGate = new Promise<void>((resolve) => {
      release = resolve
    })

    const wrapper = await mountSuspended(DefaultTagsSettings)
    // load() is blocked, so the form is still the all-blank initial state.
    await nextTick()

    // Clicking Save now must not PUT — a full-replace from the blank form would drop
    // the previously-saved Artist/Album.
    await wrapper.find('[data-test="default-save"]').trigger('click')
    await flushPromises()
    expect(putBodies).toHaveLength(0)

    // Once defaults arrive, the form reflects the saved values (settles over a few ticks).
    release()
    await vi.waitFor(() => expect(val(wrapper, 'default-artist')).toBe('Jane'))
  })

  it('Clear DELETEs and resets the fields', async () => {
    saved = { artist: 'Jane Doe' }
    const wrapper = await mountSuspended(DefaultTagsSettings)
    await flushPromises()
    expect(val(wrapper, 'default-artist')).toBe('Jane Doe')

    await wrapper.find('[data-test="default-clear"]').trigger('click')
    await flushPromises()

    expect(deleteCalls).toBe(1)
    expect(val(wrapper, 'default-artist')).toBe('')
  })
})
