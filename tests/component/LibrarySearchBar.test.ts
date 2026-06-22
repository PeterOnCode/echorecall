import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { CalendarDate } from '@internationalized/date'
import LibrarySearchBar from '~/components/library/LibrarySearchBar.vue'
import type { LibraryQuery } from '#core/client'

// Component coverage for the migrated library search/filter bar (US6 / FR-034-036,
// FR-010/011). Controlled via v-model:query — every change emits a fresh query and
// snaps to page 1. The two date inputs collapse into a single range picker
// (UPopover + UCalendar) that must emit the same inclusive local-day ISO bounds as
// before: start -> `from` (T00:00:00), end -> `to` (T23:59:59.999).

function mountBar(query: LibraryQuery = {}) {
  return mountSuspended(LibrarySearchBar, { props: { query } })
}

function lastQuery(w: VueWrapper): LibraryQuery {
  const e = w.emitted('update:query') as LibraryQuery[][] | undefined
  if (!e || e.length === 0) throw new Error('no update:query emitted')
  return e.at(-1)![0]
}

// USelectMenu is a button-triggered combobox; drive it by emitting update:modelValue
// on the menu whose subtree carries the data-test trigger (see US1 lesson).
function pickMenu(w: VueWrapper, testId: string, value: string) {
  const menu = w
    .findAllComponents({ name: 'USelectMenu' })
    .find((c) => c.find(`[data-test="${testId}"]`).exists())
  if (!menu) throw new Error(`USelectMenu [data-test="${testId}"] not found`)
  menu.vm.$emit('update:modelValue', value)
}

async function openCalendar(w: VueWrapper) {
  await w.find('[data-test="filter-range"]').trigger('click')
  await flushPromises()
  const cal = w.findAllComponents({ name: 'UCalendar' })[0]
  if (!cal) throw new Error('UCalendar not rendered after opening the range picker')
  return cal
}

describe('LibrarySearchBar', () => {
  it('search drives the query and resets to page 1', async () => {
    const w = await mountBar({ page: 3 })
    await w.find('[data-test="library-search"]').setValue('banana')
    expect(lastQuery(w)).toMatchObject({ q: 'banana', page: 1 })
  })

  it('voice filter drives the query and resets to page 1', async () => {
    const w = await mountBar({ page: 3 })
    pickMenu(w, 'filter-voice', 'echo')
    await flushPromises()
    expect(lastQuery(w)).toMatchObject({ voiceId: 'echo', page: 1 })
  })

  it('format filter drives the query and resets to page 1', async () => {
    const w = await mountBar({ page: 3 })
    pickMenu(w, 'filter-format', 'wav')
    await flushPromises()
    expect(lastQuery(w)).toMatchObject({ format: 'wav', page: 1 })
  })

  it('range picker emits both inclusive local-day ISO bounds from one selection', async () => {
    const w = await mountBar()
    const cal = await openCalendar(w)
    cal.vm.$emit('update:modelValue', {
      start: new CalendarDate(2026, 6, 1),
      end: new CalendarDate(2026, 6, 3),
    })
    await flushPromises()
    const q = lastQuery(w)
    // Inclusive local-day bounds (locale-independent instant comparison).
    expect(new Date(q.from!).getTime()).toBe(new Date(2026, 5, 1, 0, 0, 0, 0).getTime())
    expect(new Date(q.to!).getTime()).toBe(new Date(2026, 5, 3, 23, 59, 59, 999).getTime())
    expect(q.page).toBe(1)
  })

  it('clearing the range resets both bounds', async () => {
    const w = await mountBar({
      from: new Date(2026, 5, 1, 0, 0, 0, 0).toISOString(),
      to: new Date(2026, 5, 3, 23, 59, 59, 999).toISOString(),
    })
    await openCalendar(w)
    // The clear button teleports with the popover content; find it via this
    // wrapper's component tree (scoped) rather than document.body (which leaks
    // teleported nodes across tests).
    const clearBtn = w
      .findAllComponents({ name: 'UButton' })
      .find((c) => c.attributes('data-test') === 'filter-range-clear')
    if (!clearBtn) throw new Error('clear button not found')
    await clearBtn.trigger('click')
    await flushPromises()
    const q = lastQuery(w)
    expect(q.from).toBeUndefined()
    expect(q.to).toBeUndefined()
  })

  // Regression (real click-to-open): the filter menus must actually open and
  // render their options. They previously failed silently because the "all" item
  // used value '' — reka-ui's Combobox reserves the empty string, so the listbox
  // threw on render and the dropdown never appeared. The emit-based tests above
  // bypass the open path, so these drive a genuine click and assert options render.
  // Options are scoped to THIS menu's listbox (via the trigger's aria-controls),
  // since teleported menus from other tests leak into document.body.
  async function expectMenuOpens(testId: string) {
    const w = await mountBar()
    const trigger = w.find(`[data-test="${testId}"]`)
    await trigger.trigger('click')
    await flushPromises()
    expect(trigger.attributes('aria-expanded')).toBe('true')
    const listboxId = trigger.attributes('aria-controls')
    expect(listboxId).toBeTruthy()
    const listbox = document.getElementById(listboxId!)
    expect(listbox).not.toBeNull()
    expect(listbox!.querySelectorAll('[role="option"]').length).toBeGreaterThan(0)
  }

  it('opens the voice filter menu on click and renders its options', async () => {
    await expectMenuOpens('filter-voice')
  })

  it('opens the format filter menu on click and renders its options', async () => {
    await expectMenuOpens('filter-format')
  })
})
