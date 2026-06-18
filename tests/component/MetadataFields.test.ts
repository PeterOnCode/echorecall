import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import MetadataFields from '~/components/generate/MetadataFields.vue'
import type { Metadata } from '#core/client'

// Component coverage for the metadata editor (US2 / FR-018): the full set,
// multi-value `languages`, and repeatable `customText` / `customUrl`. The
// component is controlled via `v-model` (update:modelValue); we feed each emitted
// value back with setProps so multi-step edits accumulate as in a real parent.

async function mountWith(initial: Metadata = {}) {
  return mountSuspended(MetadataFields, { props: { modelValue: initial } })
}

function lastModel(wrapper: Awaited<ReturnType<typeof mountWith>>): Metadata {
  const emitted = wrapper.emitted('update:modelValue')
  if (!emitted || emitted.length === 0) throw new Error('no update:modelValue emitted')
  return emitted[emitted.length - 1]![0] as Metadata
}

describe('MetadataFields', () => {
  it('edits scalar fields, including a year-only recording date', async () => {
    const wrapper = await mountWith()

    await wrapper.find('[data-test="meta-title"]').setValue('My Title')
    expect(lastModel(wrapper).title).toBe('My Title')

    await wrapper.find('[data-test="meta-recordedAt"]').setValue('2026')
    expect(lastModel(wrapper).recordedAt).toBe('2026')
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
