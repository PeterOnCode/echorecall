import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import TagInspector from '~/components/library/TagInspector.vue'
import type { LibraryItem } from '~/composables/useLibrary'
import type { TagDraft } from '~/composables/useTagDrafts'
import type { InspectorFieldPref } from '~/composables/useViewPreferences'

// 006 · US5 (FR-018/FR-019/FR-022/FR-032) — the inspector becomes a full tag editor.
// All 15 fields (Name + the 14 toggleable, incl. the 6 R-TAGS extras) are EDITABLE and
// bound to the page's staged draft (useTagDrafts). The toolbar adds Play + Save; a
// settings gear opens the Configure Visible Fields dialog; a dirty indicator reflects
// unsaved edits. Editing mutates the passed draft in place (the page auto-preserves it);
// Save/Play/gear emit to the page. Field order + visibility come from the `fields` prop.

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

// data-test suffix for each of the 15 fields (Name + the 14 toggleable), lowercased.
const ALL_FIELD_TESTS = [
  'field-name',
  'field-text',
  'field-title',
  'field-artist',
  'field-album',
  'field-comment',
  'field-date',
  'field-track',
  'field-genre',
  'field-encodedby',
  'field-language',
  'field-albumartist',
  'field-composer',
  'field-bpm',
  'field-rating',
]

function allFields(): InspectorFieldPref[] {
  return ALL_FIELD_IDS.map((id) => ({ id, visible: true }))
}

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
    metadata: {
      title: 'Hello',
      artist: 'Me',
      album: 'Demo',
      genre: 'Speech',
      comment: 'note',
      recordedAt: '2026-06-18',
      track: '1/10',
      languages: ['eng', 'hun'],
      notes: 'a note',
      encodedBy: 'lame',
      albumArtist: 'Band',
      composer: 'Bach',
      bpm: 120,
      rating: 4,
    },
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

function mountInspector(props: Record<string, unknown> = {}, draft?: TagDraft) {
  const it = (props.item as LibraryItem | null | undefined) ?? item()
  const d = draft ?? (it ? draftFrom(it) : null)
  return mountSuspended(TagInspector, {
    props: {
      item: it,
      draft: d,
      dirty: false,
      hasPrev: false,
      hasNext: false,
      fields: allFields(),
      ...props,
    },
  })
}

describe('TagInspector editing (US5)', () => {
  it('keeps the fixed "Tag Editor (ID3v2.4)" title (FR-032)', async () => {
    const wrapper = await mountInspector()
    expect(wrapper.find('[data-test="inspector-title"]').text()).toBe('Tag Editor (ID3v2.4)')
  })

  it('renders all 15 fields as editable controls (FR-018)', async () => {
    const wrapper = await mountInspector()
    for (const test of ALL_FIELD_TESTS) {
      const el = wrapper.find(`[data-test="${test}"]`)
      expect(el.exists(), test).toBe(true)
      expect(['INPUT', 'TEXTAREA'], test).toContain(el.element.tagName)
    }
  })

  it('seeds the editable controls from the staged draft', async () => {
    const wrapper = await mountInspector()
    expect((wrapper.find('[data-test="field-name"]').element as HTMLInputElement).value).toBe('hello')
    expect((wrapper.find('[data-test="field-title"]').element as HTMLInputElement).value).toBe('Hello')
    expect((wrapper.find('[data-test="field-albumartist"]').element as HTMLInputElement).value).toBe('Band')
    expect((wrapper.find('[data-test="field-bpm"]').element as HTMLInputElement).value).toBe('120')
    expect((wrapper.find('[data-test="field-rating"]').element as HTMLInputElement).value).toBe('4')
  })

  it('edits scalar + extra fields straight into the draft (auto-preserved by the page)', async () => {
    const it = item()
    const draft = draftFrom(it)
    const wrapper = await mountInspector({ item: it }, draft)

    await wrapper.find('[data-test="field-artist"]').setValue('New Artist')
    expect(draft.metadata.artist).toBe('New Artist')

    await wrapper.find('[data-test="field-albumartist"]').setValue('The Band')
    expect(draft.metadata.albumArtist).toBe('The Band')

    await wrapper.find('[data-test="field-name"]').setValue('renamed')
    expect(draft.filenameBase).toBe('renamed')
  })

  it('coerces BPM + Rating to integers in the draft', async () => {
    const it = item()
    const draft = draftFrom(it)
    const wrapper = await mountInspector({ item: it }, draft)

    await wrapper.find('[data-test="field-bpm"]').setValue('128')
    expect(draft.metadata.bpm).toBe(128)

    await wrapper.find('[data-test="field-rating"]').setValue('5')
    expect(draft.metadata.rating).toBe(5)
  })

  it('shows the dirty indicator only while there are unsaved edits (FR-019)', async () => {
    const wrapper = await mountInspector({ dirty: false })
    expect(wrapper.find('[data-test="inspector-dirty"]').exists()).toBe(false)
    await wrapper.setProps({ dirty: true })
    expect(wrapper.find('[data-test="inspector-dirty"]').exists()).toBe(true)
  })

  it('emits save / play from the toolbar and open-fields-dialog from the gear (FR-020/FR-022)', async () => {
    const wrapper = await mountInspector()
    await wrapper.find('[data-test="inspector-save"]').trigger('click')
    expect(wrapper.emitted('save')).toBeTruthy()
    await wrapper.find('[data-test="inspector-play"]').trigger('click')
    expect(wrapper.emitted('play')).toBeTruthy()
    await wrapper.find('[data-test="inspector-fields-gear"]').trigger('click')
    expect(wrapper.emitted('open-fields-dialog')).toBeTruthy()
  })

  it('renders the fields in the prefs order, with Name always first (FR-020)', async () => {
    const wrapper = await mountInspector({
      fields: [
        { id: 'rating', visible: true },
        { id: 'title', visible: true },
      ],
    })
    const order = wrapper.findAll('[data-test^="field-"]').map((w) => w.attributes('data-test'))
    expect(order).toEqual(['field-name', 'field-rating', 'field-title'])
  })

  it('hides a field toggled off in prefs but keeps Name (always-on)', async () => {
    const wrapper = await mountInspector({
      fields: allFields().map((f) => (f.id === 'title' ? { ...f, visible: false } : f)),
    })
    expect(wrapper.find('[data-test="field-title"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="field-name"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="field-artist"]').exists()).toBe(true)
  })

  it('shows the empty state and no fields when nothing is selected (FR-005)', async () => {
    const wrapper = await mountInspector({ item: null, draft: null })
    expect(wrapper.find('[data-test="tags-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="field-title"]').exists()).toBe(false)
  })
})
