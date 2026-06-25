import { describe, it, expect } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import LibraryFilterBar from '~/components/library/LibraryFilterBar.vue'
import LibraryFileTable from '~/components/library/LibraryFileTable.vue'
import LibraryColumnsDialog from '~/components/library/LibraryColumnsDialog.vue'
import BulkTagEditDialog from '~/components/library/BulkTagEditDialog.vue'
import TagInspector from '~/components/library/TagInspector.vue'
import InspectorFieldsDialog from '~/components/library/InspectorFieldsDialog.vue'
import type { LibraryItem } from '~/composables/useLibrary'
import type { LibraryColumnPref, InspectorFieldPref } from '~/composables/useViewPreferences'
import type { TagDraft } from '~/composables/useTagDrafts'

// 006 · FR-026 / SC-008 — accessibility/keyboard sweep across the redesigned Library
// surfaces. Every interactive control the redesign adds MUST be a real, focusable
// native control (so it is keyboard-operable) AND expose a non-empty accessible name
// (aria-label / labelled checkbox / button text) — so an icon-only gear, a Prev/Next
// arrow, or a select-all checkbox is never a silent, unlabelled target for assistive
// tech. This guard fails the moment a new control ships without a name.

/** The accessible name of a native control: aria-label, title, a referenced/associated
 *  label, a wrapping <label>, or (for buttons) trimmed text content. */
function hasAccessibleName(el: HTMLElement, root: ParentNode): boolean {
  const aria = (el.getAttribute('aria-label') ?? '').trim()
  if (aria) return true
  const title = (el.getAttribute('title') ?? '').trim()
  if (title) return true
  const labelledby = el.getAttribute('aria-labelledby')
  if (labelledby) {
    const ref = root.querySelector(`#${CSS.escape(labelledby)}`)
    if (ref && (ref.textContent ?? '').trim()) return true
  }
  const id = el.getAttribute('id')
  if (id) {
    const forLabel = root.querySelector(`label[for="${CSS.escape(id)}"]`)
    if (forLabel && (forLabel.textContent ?? '').trim()) return true
  }
  if (el.closest('label')) return true
  return (el.textContent ?? '').trim().length > 0
}

/** Assert every button + checkable input under `root` is named (and thus reachable). */
function expectControlsNamed(root: ParentNode, where: string) {
  const controls = root.querySelectorAll<HTMLElement>(
    'button, input[type="checkbox"], input[type="radio"]',
  )
  expect(controls.length, `${where}: no interactive controls found`).toBeGreaterThan(0)
  for (const el of controls) {
    const tag = el.tagName.toLowerCase()
    const type = el.getAttribute('type') ?? ''
    const dataTest = el.getAttribute('data-test') ?? el.closest('[data-test]')?.getAttribute('data-test') ?? '?'
    expect(
      hasAccessibleName(el, root),
      `${where}: unnamed ${tag}${type ? `[${type}]` : ''} (near data-test="${dataTest}")`,
    ).toBe(true)
  }
}

function item(over: Partial<LibraryItem> & { id: string }): LibraryItem {
  return {
    id: over.id,
    text: 't',
    voiceId: 'alloy',
    model: null,
    format: 'mp3',
    speed: null,
    createdAt: '2026-06-15T10:00:00.000Z',
    filename: `${over.id}.mp3`,
    audioUrl: `/api/generations/${over.id}/audio`,
    metadata: {},
    ...over,
  }
}

const allColumns: LibraryColumnPref[] = [
  'title', 'artist', 'album', 'year', 'track', 'genre',
  'comment', 'date', 'composer', 'duration', 'bitrate',
].map((id) => ({ id: id as LibraryColumnPref['id'], visible: true }))

const allFields: InspectorFieldPref[] = [
  'text', 'title', 'artist', 'album', 'comment', 'date', 'track',
  'genre', 'encodedBy', 'language', 'albumArtist', 'composer', 'bpm', 'rating',
].map((id) => ({ id: id as InspectorFieldPref['id'], visible: true }))

function draftFrom(it: LibraryItem): TagDraft {
  return { filenameBase: it.filename.replace(/\.[^.]+$/, ''), metadata: { ...it.metadata } }
}

describe('Library a11y sweep (FR-026)', () => {
  it('LibraryFilterBar controls are all named', async () => {
    const w = await mountSuspended(LibraryFilterBar, {
      props: { query: { page: 1 }, genres: ['Speech'], languages: ['eng'] },
    })
    await flushPromises()
    expectControlsNamed(w.element as ParentNode, 'LibraryFilterBar')
  })

  it('LibraryFileTable controls (checkboxes, sort headers, toolbar) are all named', async () => {
    const w = await mountSuspended(LibraryFileTable, {
      props: {
        items: [item({ id: 'a', metadata: { title: 'Alpha' } })],
        total: 1,
        query: { sort: 'createdAt', order: 'desc', page: 1, pageSize: 20 },
        activeId: null,
        selectedIds: new Set<string>(),
        columns: allColumns,
      },
    })
    await flushPromises()
    expectControlsNamed(w.element as ParentNode, 'LibraryFileTable')
  })

  it('TagInspector toolbar + field controls are all named', async () => {
    const it = item({ id: 'a', metadata: { title: 'Alpha', artist: 'Me' } })
    const w = await mountSuspended(TagInspector, {
      props: {
        item: it,
        draft: draftFrom(it),
        dirty: false,
        hasPrev: true,
        hasNext: true,
        fields: allFields,
      },
    })
    await flushPromises()
    expectControlsNamed(w.element as ParentNode, 'TagInspector')
  })

  it('LibraryColumnsDialog controls are all named', async () => {
    const w = await mountSuspended(LibraryColumnsDialog, {
      props: { open: true, columns: allColumns },
    })
    await flushPromises()
    expectControlsNamed(document.body, 'LibraryColumnsDialog')
    w.unmount()
  })

  it('InspectorFieldsDialog controls are all named', async () => {
    const w = await mountSuspended(InspectorFieldsDialog, {
      props: { open: true, fields: allFields },
    })
    await flushPromises()
    expectControlsNamed(document.body, 'InspectorFieldsDialog')
    w.unmount()
  })

  it('BulkTagEditDialog controls are all named', async () => {
    const w = await mountSuspended(BulkTagEditDialog, {
      props: { open: true, count: 3 },
    })
    await flushPromises()
    expectControlsNamed(document.body, 'BulkTagEditDialog')
    w.unmount()
  })
})
