import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { Voice } from '#core/client'
import GenerateForm from '~/components/GenerateForm.vue'

const voices: Voice[] = [
  { id: 'alloy', label: 'Alloy' },
  { id: 'echo', label: 'Echo' },
]

describe('GenerateForm', () => {
  it('renders one option per voice and a submit button', async () => {
    const wrapper = await mountSuspended(GenerateForm, {
      props: { voices, status: 'idle', error: null },
    })

    expect(wrapper.text()).toContain('characters remaining')
    expect(wrapper.findAll('option')).toHaveLength(voices.length)
    expect(wrapper.find('button[type="submit"]').exists()).toBe(true)
  })

  it('emits submit with the entered text and selected voice', async () => {
    const wrapper = await mountSuspended(GenerateForm, {
      props: { voices, status: 'idle', error: null },
    })

    await wrapper.find('textarea').setValue('Hello world')
    await wrapper.find('form').trigger('submit.prevent')

    const submitted = wrapper.emitted('submit')
    expect(submitted).toBeTruthy()
    // voiceId defaults to the first voice once the catalog loads.
    expect(submitted![0]![0]).toEqual({ text: 'Hello world', voiceId: 'alloy' })
  })
})
