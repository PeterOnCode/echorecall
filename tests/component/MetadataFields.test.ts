import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { CalendarDate } from '@internationalized/date'
import MetadataFields from '~/components/generate/MetadataFields.vue'
import { useQueue } from '~/composables/useQueue'
import type { Metadata } from '#core/client'

// Component coverage for the metadata editor (US2 / FR-018) plus the 005 redesign
// recording-date picker (US1 / FR-008): the full scalar set, multi-value
// `languages`, repeatable `customText` / `customUrl`, and `recordedAt` rendered as
// a UPopover + UCalendar that maps a `CalendarDate` to/from the stored
// `YYYY-MM-DD` string and is clearable. The component is controlled via `v-model`;
// we feed each emitted value back with setProps so multi-step edits accumulate as
// in a real parent.

async function mountWith(initial: Metadata = {}) {
  return mountSuspended(MetadataFields, { props: { modelValue: initial } })
}

function lastModel(wrapper: Awaited<ReturnType<typeof mountWith>>): Metadata {
  const emitted = wrapper.emitted('update:modelValue')
  if (!emitted || emitted.length === 0) throw new Error('no update:modelValue emitted')
  return emitted[emitted.length - 1]![0] as Metadata
}

function isoForTomorrow(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// The recording date is a button-triggered popover; its calendar only mounts once
// the popover opens. Mirror the proven LibrarySearchBar pattern: click the trigger,
// flush, then locate the (teleported) UCalendar via this wrapper's component tree.
async function openPicker(wrapper: VueWrapper) {
  await wrapper.find('[data-test="meta-recordedAt-trigger"]').trigger('click')
  await flushPromises()
  const cal = wrapper.findAllComponents({ name: 'UCalendar' })[0]
  if (!cal) throw new Error('UCalendar not rendered after opening the recording-date picker')
  return cal
}

describe('MetadataFields', () => {
  it('edits scalar fields', async () => {
    const wrapper = await mountWith()

    await wrapper.find('[data-test="meta-title"]').setValue('My Title')
    expect(lastModel(wrapper).title).toBe('My Title')

    await wrapper.find('[data-test="meta-album"]').setValue('My Album')
    expect(lastModel(wrapper).album).toBe('My Album')
  })

  it('collects multiple languages', async () => {
    const wrapper = await mountWith()

    await wrapper.find('[data-test="meta-language-input"]').setValue('eng')
    await wrapper.find('[data-test="meta-language-add"]').trigger('click')
    let model = lastModel(wrapper)
    expect(model.languages).toEqual(['eng'])

    await wrapper.setProps({ modelValue: model })
    await wrapper.find('[data-test="meta-language-input"]').setValue('hun')
    await wrapper.find('[data-test="meta-language-add"]').trigger('click')
    model = lastModel(wrapper)
    expect(model.languages).toEqual(['eng', 'hun'])

    // Rendered chips reflect both, and a removed one drops out.
    await wrapper.setProps({ modelValue: model })
    expect(wrapper.findAll('[data-test="meta-language-chip"]')).toHaveLength(2)
    await wrapper.findAll('[data-test="meta-language-remove"]')[0]!.trigger('click')
    expect(lastModel(wrapper).languages).toEqual(['hun'])
  })

  it('adds repeatable custom text entries', async () => {
    const wrapper = await mountWith()

    await wrapper.find('[data-test="meta-text-desc"]').setValue('mood')
    await wrapper.find('[data-test="meta-text-value"]').setValue('calm')
    await wrapper.find('[data-test="meta-text-add"]').trigger('click')

    expect(lastModel(wrapper).customText).toEqual([{ description: 'mood', value: 'calm' }])
  })

  it('adds repeatable custom URL entries', async () => {
    const wrapper = await mountWith()

    await wrapper.find('[data-test="meta-url-desc"]').setValue('homepage')
    await wrapper.find('[data-test="meta-url-value"]').setValue('https://example.com')
    await wrapper.find('[data-test="meta-url-add"]').trigger('click')

    expect(lastModel(wrapper).customUrl).toEqual([
      { description: 'homepage', url: 'https://example.com' },
    ])
  })
})

describe('MetadataFields recording-date picker (US1)', () => {
  it('renders recordedAt as a popover calendar picker', async () => {
    const wrapper = await mountWith()
    expect(wrapper.find('[data-test="meta-recordedAt-trigger"]').exists()).toBe(true)
  })

  it('defaults a newly created queue item’s recording date to tomorrow', async () => {
    const q = useQueue()
    const created = q.addItem('hello')!
    const tomorrow = isoForTomorrow()
    expect(created.metadata.recordedAt).toBe(tomorrow)

    // The picker surfaces that default on the calendar.
    const wrapper = await mountWith(created.metadata)
    const cal = await openPicker(wrapper)
    expect((cal.props('modelValue') as CalendarDate | undefined)?.toString()).toBe(tomorrow)
  })

  it('maps a calendar selection back to a YYYY-MM-DD string', async () => {
    const wrapper = await mountWith()
    const cal = await openPicker(wrapper)

    cal.vm.$emit('update:modelValue', new CalendarDate(2026, 6, 24))
    await flushPromises()

    expect(lastModel(wrapper).recordedAt).toBe('2026-06-24')
  })

  it('clears the recording date', async () => {
    const wrapper = await mountWith({ recordedAt: '2026-06-24' })
    await openPicker(wrapper)

    // The clear button teleports with the popover content; find it via this
    // wrapper's component tree (scoped) rather than document.body.
    const clearBtn = wrapper
      .findAllComponents({ name: 'UButton' })
      .find((c) => c.attributes('data-test') === 'meta-recordedAt-clear')
    if (!clearBtn) throw new Error('clear button not found')
    await clearBtn.trigger('click')

    expect(lastModel(wrapper).recordedAt).toBeUndefined()
  })
})
