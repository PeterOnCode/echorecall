import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { CalendarDate } from '@internationalized/date'
import LibraryFilterBar from '~/components/library/LibraryFilterBar.vue'
import type { LibraryQuery } from '#core/client'

// 006 · US3 (FR-011/FR-012) — the Library filter bar (supersedes LibrarySearchBar).
// Controlled via v-model:query — every change emits a fresh query and snaps to page
// 1. Controls: search-all (q), audio-format, a SINGLE recording-date (one day →
// recordedFrom/recordedTo day-bounds over the tag date), genre, and language. The
// "__all__" sentinel clears a select (reka-ui forbids an empty-string item value).

function mountBar(query: LibraryQuery = {}, options: Record<string, unknown> = {}) {
  return mountSuspended(LibraryFilterBar, {
    props: { query, genres: ['Speech', 'Podcast'], languages: ['eng', 'hun'], ...options },
  })
}

function lastQuery(w: VueWrapper): LibraryQuery {
  const e = w.emitted('update:query') as LibraryQuery[][] | undefined
  if (!e || e.length === 0) throw new Error('no update:query emitted')
  return e.at(-1)![0]
}

// USelectMenu is a button-triggered combobox; drive it by emitting update:modelValue
// on the menu whose subtree carries the data-test trigger (the established lesson).
function pickMenu(w: VueWrapper, testId: string, value: string) {
  const menu = w
    .findAllComponents({ name: 'USelectMenu' })
    .find((c) => c.find(`[data-test="${testId}"]`).exists())
  if (!menu) throw new Error(`USelectMenu [data-test="${testId}"] not found`)
  menu.vm.$emit('update:modelValue', value)
}

async function openDate(w: VueWrapper) {
  await w.find('[data-test="filter-recorded-date"]').trigger('click')
  await flushPromises()
  const cal = w.findAllComponents({ name: 'UCalendar' })[0]
  if (!cal) throw new Error('UCalendar not rendered after opening the recording-date picker')
  return cal
}

describe('LibraryFilterBar (US3)', () => {
  it('search-all drives the query and resets to page 1', async () => {
    const w = await mountBar({ page: 3 })
    await w.find('[data-test="library-search"]').setValue('banana')
    expect(lastQuery(w)).toMatchObject({ q: 'banana', page: 1 })
  })

  it('format filter drives the query and resets to page 1', async () => {
    const w = await mountBar({ page: 3 })
    pickMenu(w, 'filter-format', 'wav')
    await flushPromises()
    expect(lastQuery(w)).toMatchObject({ format: 'wav', page: 1 })
  })

  it('genre filter drives the query and resets to page 1', async () => {
    const w = await mountBar({ page: 3 })
    pickMenu(w, 'filter-genre', 'Speech')
    await flushPromises()
    expect(lastQuery(w)).toMatchObject({ genre: 'Speech', page: 1 })
  })

  it('language filter drives the query and resets to page 1', async () => {
    const w = await mountBar({ page: 3 })
    pickMenu(w, 'filter-language', 'eng')
    await flushPromises()
    expect(lastQuery(w)).toMatchObject({ language: 'eng', page: 1 })
  })

  it('the single recording-date maps to that day’s recordedFrom/recordedTo bounds', async () => {
    const w = await mountBar({ page: 3 })
    const cal = await openDate(w)
    cal.vm.$emit('update:modelValue', new CalendarDate(2026, 6, 1))
    await flushPromises()
    const q = lastQuery(w)
    expect(new Date(q.recordedFrom!).getTime()).toBe(new Date(2026, 5, 1, 0, 0, 0, 0).getTime())
    expect(new Date(q.recordedTo!).getTime()).toBe(new Date(2026, 5, 1, 23, 59, 59, 999).getTime())
    expect(q.page).toBe(1)
  })

  it('clearing the recording-date resets both bounds', async () => {
    const w = await mountBar({
      recordedFrom: new Date(2026, 5, 1, 0, 0, 0, 0).toISOString(),
      recordedTo: new Date(2026, 5, 1, 23, 59, 59, 999).toISOString(),
    })
    await openDate(w)
    const clearBtn = w
      .findAllComponents({ name: 'UButton' })
      .find((c) => c.attributes('data-test') === 'filter-recorded-date-clear')
    if (!clearBtn) throw new Error('recorded-date clear button not found')
    await clearBtn.trigger('click')
    await flushPromises()
    const q = lastQuery(w)
    expect(q.recordedFrom).toBeUndefined()
    expect(q.recordedTo).toBeUndefined()
  })

  it('the "all" sentinel clears a select back to no filter', async () => {
    const w = await mountBar({ genre: 'Speech' })
    pickMenu(w, 'filter-genre', '__all__')
    await flushPromises()
    expect(lastQuery(w).genre).toBeUndefined()
  })
})
