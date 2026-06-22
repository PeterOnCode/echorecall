import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { reactive } from 'vue'
import { flushPromises } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { CalendarDate } from '@internationalized/date'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { VOICES, type BulkCleanFilter } from '#core/client'
import BulkCleanDialog from '~/components/library/BulkCleanDialog.vue'

// Migration coverage for the bulk-clean overlay (004 / US3, FR-003/004/006/008/010/011):
// the bespoke `.backdrop`/`.dialog` modal collapses onto `UModal` (teleports to
// document.body, supplies focus trap + Escape dismiss + focus return + dark-mode theming),
// the voice `<select>` becomes a `USelectMenu`, and the two native date inputs collapse
// into one range date picker (UPopover + UCalendar) emitting the same inclusive local-day
// ISO bounds. The contract holds: confirm stays disabled until a filter is set, filters
// re-seed on each open, and confirm emits BulkCleanFilter. The bulk-from/bulk-to hooks are
// intentionally collapsed to a single bulk-range (consuming selectors updated here, FR-006).

const colorMode = reactive({ preference: 'system', value: 'light' })
mockNuxtImport('useColorMode', () => () => colorMode)

beforeEach(() => {
  colorMode.preference = 'system'
  colorMode.value = 'light'
})
afterEach(() => vi.restoreAllMocks())

const VOICE = VOICES[0]!.id

// All interactive controls live inside the teleported UModal panel. findAllComponents
// traverses the component tree (which includes teleported children), so we drive controls
// through it rather than the wrapper's own DOM (wrapper.find excludes teleported nodes).
function button(w: VueWrapper, test: string) {
  const btn = w.findAllComponents({ name: 'UButton' }).find((c) => c.attributes('data-test') === test)
  if (!btn) throw new Error(`UButton [data-test="${test}"] not found`)
  return btn
}

function pickVoice(w: VueWrapper, value: string) {
  const menu = w
    .findAllComponents({ name: 'USelectMenu' })
    .find((c) => c.find('[data-test="bulk-voice"]').exists())
  if (!menu) throw new Error('USelectMenu [data-test="bulk-voice"] not found')
  menu.vm.$emit('update:modelValue', value)
}

async function pickRange(w: VueWrapper, start: CalendarDate, end: CalendarDate) {
  await button(w, 'bulk-range').trigger('click')
  await flushPromises()
  const cal = w.findAllComponents({ name: 'UCalendar' })[0]
  if (!cal) throw new Error('UCalendar not rendered after opening the range picker')
  cal.vm.$emit('update:modelValue', { start, end })
  await flushPromises()
}

function lastConfirm(w: VueWrapper): BulkCleanFilter {
  const e = w.emitted('confirm') as BulkCleanFilter[][] | undefined
  if (!e || e.length === 0) throw new Error('no confirm emitted')
  return e.at(-1)![0]
}

describe('BulkCleanDialog (UModal + range picker)', () => {
  it('teleports the dialog to document.body only while open', async () => {
    const wrapper = await mountSuspended(BulkCleanDialog, { props: { open: false } })
    expect(document.body.querySelector('[data-test="bulk-clean-dialog"]')).toBeNull()

    await wrapper.setProps({ open: true })
    await flushPromises()
    expect(document.body.querySelector('[data-test="bulk-clean-dialog"]')).not.toBeNull()

    await wrapper.setProps({ open: false })
    await flushPromises()
    expect(document.body.querySelector('[data-test="bulk-clean-dialog"]')).toBeNull()
    wrapper.unmount()
  })

  it('disables confirm until at least one filter is set', async () => {
    const wrapper = await mountSuspended(BulkCleanDialog, { props: { open: true } })
    await flushPromises()
    expect((button(wrapper, 'bulk-confirm').element as HTMLButtonElement).disabled).toBe(true)

    pickVoice(wrapper, VOICE)
    await flushPromises()
    expect((button(wrapper, 'bulk-confirm').element as HTMLButtonElement).disabled).toBe(false)
    wrapper.unmount()
  })

  it('emits confirm with the chosen voice', async () => {
    const wrapper = await mountSuspended(BulkCleanDialog, { props: { open: true } })
    await flushPromises()
    pickVoice(wrapper, VOICE)
    await flushPromises()
    await button(wrapper, 'bulk-confirm').trigger('click')

    expect(lastConfirm(wrapper)).toMatchObject({ voiceId: VOICE })
    wrapper.unmount()
  })

  it('emits identical inclusive local-day ISO bounds from one range selection', async () => {
    const wrapper = await mountSuspended(BulkCleanDialog, { props: { open: true } })
    await flushPromises()
    await pickRange(wrapper, new CalendarDate(2026, 6, 1), new CalendarDate(2026, 6, 3))
    await button(wrapper, 'bulk-confirm').trigger('click')

    const filter = lastConfirm(wrapper)
    expect(new Date(filter.from!).getTime()).toBe(new Date(2026, 5, 1, 0, 0, 0, 0).getTime())
    expect(new Date(filter.to!).getTime()).toBe(new Date(2026, 5, 3, 23, 59, 59, 999).getTime())
    wrapper.unmount()
  })

  it('re-seeds the filters each time it opens (no stale selection)', async () => {
    const wrapper = await mountSuspended(BulkCleanDialog, { props: { open: true } })
    await flushPromises()
    pickVoice(wrapper, VOICE)
    await flushPromises()
    expect((button(wrapper, 'bulk-confirm').element as HTMLButtonElement).disabled).toBe(false)

    // Close, then reopen: the prior voice selection must not carry over.
    await wrapper.setProps({ open: false })
    await flushPromises()
    await wrapper.setProps({ open: true })
    await flushPromises()
    expect((button(wrapper, 'bulk-confirm').element as HTMLButtonElement).disabled).toBe(true)
    wrapper.unmount()
  })

  it('emits cancel from the Cancel button and from Escape', async () => {
    const wrapper = await mountSuspended(BulkCleanDialog, { props: { open: true } })
    await flushPromises()

    await button(wrapper, 'bulk-cancel').trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect((wrapper.emitted('cancel') as unknown[][]).length).toBeGreaterThanOrEqual(2)
    wrapper.unmount()
  })

  it('renders via the design-system overlay with no bespoke hardcoded panel in dark mode', async () => {
    colorMode.preference = 'dark'
    colorMode.value = 'dark'
    const wrapper = await mountSuspended(BulkCleanDialog, { props: { open: true } })
    await flushPromises()

    expect(document.querySelector('.backdrop')).toBeNull()
    expect(document.querySelector('.dialog')).toBeNull()
    expect(document.body.querySelector('[data-test="bulk-clean-dialog"]')).not.toBeNull()
    wrapper.unmount()
  })
})
