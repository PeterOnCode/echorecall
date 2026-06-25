import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import TagInspector from '~/components/library/TagInspector.vue'
import type { LibraryItem } from '~/composables/useLibrary'

// 006 · US1 (FR-005/FR-006/FR-032) — the tag-editor inspector skeleton (forks
// AudioTagsPanel). US1 scope: a FIXED "Tag Editor (ID3v2.4)" title, a Prev/Next
// toolbar (disabled at the global bounds, emits to the page), a read-only display of
// the recording's field values, and an empty state when nothing is selected. Editing
// + Save + Play + the fields dialog arrive in US5.

function item(over: Partial<LibraryItem> = {}): LibraryItem {
  return {
    id: 'gen-1',
    text: 'Hello world',
    voiceId: 'alloy',
    model: 'gpt-4o-mini-tts',
    format: 'mp3',
    speed: 1,
    createdAt: '2026-06-18T08:00:00.000Z',
    filename: 'hello.mp3',
    audioUrl: '/api/generations/gen-1/audio',
    metadata: { title: 'Hello', artist: 'Me', album: 'Demo', genre: 'Speech' },
    ...over,
  }
}

function mountInspector(props: Record<string, unknown> = {}) {
  return mountSuspended(TagInspector, {
    props: { item: item(), hasPrev: false, hasNext: false, ...props },
  })
}

describe('TagInspector (US1)', () => {
  it('shows the fixed "Tag Editor (ID3v2.4)" title (FR-032)', async () => {
    const wrapper = await mountInspector()
    expect(wrapper.find('[data-test="inspector-title"]').text()).toBe('Tag Editor (ID3v2.4)')
  })

  it('loads the selected recording field values', async () => {
    const wrapper = await mountInspector()
    expect(wrapper.find('[data-test="field-name"]').text()).toContain('hello')
    expect(wrapper.find('[data-test="field-title"]').text()).toContain('Hello')
    expect(wrapper.find('[data-test="field-artist"]').text()).toContain('Me')
    expect(wrapper.find('[data-test="field-album"]').text()).toContain('Demo')
    expect(wrapper.find('[data-test="field-genre"]').text()).toContain('Speech')
  })

  it('shows the empty state when nothing is selected (FR-005)', async () => {
    const wrapper = await mountInspector({ item: null })
    expect(wrapper.find('[data-test="tags-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="field-title"]').exists()).toBe(false)
  })

  it('emits prev/next and disables them at the global bounds (R-NAV)', async () => {
    const wrapper = await mountInspector({ hasPrev: false, hasNext: true })
    expect(wrapper.find('[data-test="tags-prev"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-test="tags-next"]').attributes('disabled')).toBeUndefined()

    await wrapper.find('[data-test="tags-next"]').trigger('click')
    expect(wrapper.emitted('next')).toBeTruthy()

    await wrapper.setProps({ hasPrev: true, hasNext: false })
    expect(wrapper.find('[data-test="tags-next"]').attributes('disabled')).toBeDefined()
    await wrapper.find('[data-test="tags-prev"]').trigger('click')
    expect(wrapper.emitted('prev')).toBeTruthy()
  })

  it('exposes the inspector region + nav to assistive tech', async () => {
    const wrapper = await mountInspector({ hasPrev: true, hasNext: true })
    for (const id of ['tags-prev', 'tags-next']) {
      const btn = wrapper.find(`[data-test="${id}"]`).element as HTMLElement
      expect(btn.tagName, id).toBe('BUTTON')
      expect((btn.getAttribute('aria-label') ?? '').length, id).toBeGreaterThan(0)
    }
  })
})
