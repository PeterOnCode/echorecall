import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import GenerateForm from '~/components/generate/GenerateForm.vue'

// Component coverage for the 005 redesign "defaults bar" (US1 / FR-021): the
// compact form-level controls (voice / model / format / speed) that newly added
// queue rows inherit, plus the interim text-add path kept here until US4's
// AddTextPanel replaces it. The controls are controlled via v-model; we assert
// each emits its update and that Add only fires for non-empty text.

const voices = [
  { id: 'alloy', label: 'Alloy' },
  { id: 'echo', label: 'Echo' },
]

function mountForm() {
  return mountSuspended(GenerateForm, {
    props: { voices, voiceId: 'alloy', model: 'gpt-4o-mini-tts', format: 'mp3', speed: 1 },
  })
}

// USelectMenu is a button-triggered combobox; drive it by emitting update:modelValue
// on the menu whose subtree carries the data-test trigger (the established US1 lesson).
function pickMenu(w: VueWrapper, testId: string, value: string) {
  const menu = w
    .findAllComponents({ name: 'USelectMenu' })
    .find((c) => c.find(`[data-test="${testId}"]`).exists())
  if (!menu) throw new Error(`USelectMenu [data-test="${testId}"] not found`)
  menu.vm.$emit('update:modelValue', value)
}

describe('GenerateForm (defaults bar)', () => {
  it('renders the four default controls and the text-add path', async () => {
    const wrapper = await mountForm()
    for (const id of ['voice', 'model', 'format', 'speed', 'add-text', 'add-item']) {
      expect(wrapper.find(`[data-test="${id}"]`).exists(), id).toBe(true)
    }
  })

  it('updates the form-level voice / model / format defaults via v-model', async () => {
    const wrapper = await mountForm()

    pickMenu(wrapper, 'voice', 'echo')
    await flushPromises()
    expect(wrapper.emitted('update:voiceId')?.at(-1)?.[0]).toBe('echo')

    pickMenu(wrapper, 'model', 'tts-1')
    await flushPromises()
    expect(wrapper.emitted('update:model')?.at(-1)?.[0]).toBe('tts-1')

    pickMenu(wrapper, 'format', 'flac')
    await flushPromises()
    expect(wrapper.emitted('update:format')?.at(-1)?.[0]).toBe('flac')
  })

  it('emits add with the trimmed text and clears the box', async () => {
    const wrapper = await mountForm()

    const box = wrapper.find('[data-test="add-text"]')
    await box.setValue('  hello world  ')
    await wrapper.find('[data-test="add-item"]').trigger('click')

    expect(wrapper.emitted('add')?.at(-1)?.[0]).toBe('hello world')
    expect((box.element as HTMLTextAreaElement).value).toBe('')
  })

  it('does not emit add for empty/whitespace text', async () => {
    const wrapper = await mountForm()

    await wrapper.find('[data-test="add-text"]').setValue('   ')
    await wrapper.find('[data-test="add-item"]').trigger('click')

    expect(wrapper.emitted('add')).toBeFalsy()
  })
})
