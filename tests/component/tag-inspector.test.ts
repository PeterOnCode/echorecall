import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import TagInspector from '~/components/library/TagInspector.vue'
import type { LibraryItem } from '~/composables/useLibrary'
import type { TagDraft } from '~/composables/useTagDrafts'
import type { InspectorFieldPref } from '~/composables/useViewPreferences'

// 006 · US1 (FR-005/FR-006/FR-032) — the tag-editor inspector. US1 scope: a FIXED
// "Tag Editor (ID3v2.4)" title, a Prev/Next toolbar (disabled at the global bounds,
// emits to the page), the recording's field values loaded from the staged draft, and
// an empty state when nothing is selected. Editing + Save + Play + the fields dialog
// behaviour is exercised in tag-inspector-edit.test.ts (US5).

const ALL_FIELD_IDS: InspectorFieldPref['id'][] = [
  'text',
  'title',
  'artist',
  'album',
  'comment',
  'date',
  'track',
  'genre',
  'encodedBy',
  'language',
  'albumArtist',
  'composer',
  'bpm',
  'rating',
]

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

function draftFrom(it: LibraryItem): TagDraft {
  const dot = it.filename.lastIndexOf('.')
  return {
    filenameBase: dot > 0 ? it.filename.slice(0, dot) : it.filename,
    metadata: JSON.parse(JSON.stringify(it.metadata ?? {})),
  }
}

function mountInspector(props: Record<string, unknown> = {}) {
  const it = 'item' in props ? (props.item as LibraryItem | null) : item()
  return mountSuspended(TagInspector, {
    props: {
      item: it,
      draft: it ? draftFrom(it) : null,
      dirty: false,
      hasPrev: false,
      hasNext: false,
      fields: ALL_FIELD_IDS.map((id) => ({ id, visible: true })),
      ...props,
    },
  })
}

describe('TagInspector (US1)', () => {
  it('shows the fixed "Tag Editor (ID3v2.4)" title (FR-032)', async () => {
    const wrapper = await mountInspector()
    expect(wrapper.find('[data-test="inspector-title"]').text()).toBe('Tag Editor (ID3v2.4)')
  })

  it('loads the selected recording field values', async () => {
    const wrapper = await mountInspector()
    expect((wrapper.find('[data-test="field-name"]').element as HTMLInputElement).value).toContain('hello')
    expect((wrapper.find('[data-test="field-title"]').element as HTMLInputElement).value).toContain('Hello')
    expect((wrapper.find('[data-test="field-artist"]').element as HTMLInputElement).value).toContain('Me')
    expect((wrapper.find('[data-test="field-album"]').element as HTMLInputElement).value).toContain('Demo')
    expect((wrapper.find('[data-test="field-genre"]').element as HTMLInputElement).value).toContain('Speech')
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
