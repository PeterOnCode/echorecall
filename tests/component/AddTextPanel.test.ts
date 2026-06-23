import { describe, it, expect } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import AddTextPanel from '~/components/generate/AddTextPanel.vue'

// Component coverage for the 005 ad-hoc text entry (US4 / FR-013): a single text box
// + Add that appends one queued row from typed text. The panel is presentational —
// it validates with the shared validateItemText and emits `add` with the trimmed
// text for the page to turn into a source:'text' row (index.vue calls addItem); an
// empty/whitespace entry is refused (no emit) with a visible reason. Replaces the
// interim text-add that lived in GenerateForm through US1–US3.

describe('AddTextPanel', () => {
  it('renders the text input and add button', async () => {
    const wrapper = await mountSuspended(AddTextPanel)
    expect(wrapper.find('[data-test="add-text-input"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="add-text-submit"]').exists()).toBe(true)
  })

  it('emits add with the trimmed text and clears the box', async () => {
    const wrapper = await mountSuspended(AddTextPanel)

    const box = wrapper.find('[data-test="add-text-input"]')
    await box.setValue('  hello world  ')
    await wrapper.find('[data-test="add-text-submit"]').trigger('click')

    expect(wrapper.emitted('add')?.at(-1)?.[0]).toBe('hello world')
    expect((box.element as HTMLTextAreaElement).value).toBe('')
  })

  it('rejects empty/whitespace text with a reason and emits nothing', async () => {
    const wrapper = await mountSuspended(AddTextPanel)

    await wrapper.find('[data-test="add-text-input"]').setValue('   ')
    await wrapper.find('[data-test="add-text-submit"]').trigger('click')

    expect(wrapper.emitted('add')).toBeFalsy()
    expect(wrapper.find('[data-test="add-text-error"]').exists()).toBe(true)
  })

  it('marks the textarea invalid and links it to the error message (a11y)', async () => {
    const wrapper = await mountSuspended(AddTextPanel)
    const box = wrapper.find('[data-test="add-text-input"]')

    await wrapper.find('[data-test="add-text-submit"]').trigger('click') // empty → rejected
    await flushPromises()

    // The error is driven through UFormField's `error` prop, so the control is marked
    // invalid and described by the error message element (not just a visual slot).
    expect(box.attributes('aria-invalid')).toBe('true')
    const describedBy = box.attributes('aria-describedby') ?? ''
    expect(describedBy.split(' ').some((id) => id.endsWith('-error'))).toBe(true)
    expect(wrapper.find('[data-test="add-text-error"]').exists()).toBe(true)
  })

  it('submits via Ctrl+Enter and prevents the default newline', async () => {
    const wrapper = await mountSuspended(AddTextPanel)
    const box = wrapper.find('[data-test="add-text-input"]')
    await box.setValue('shortcut text')

    // A real cancelable keydown so we can assert .prevent stopped the native newline.
    const event = new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, cancelable: true, bubbles: true })
    box.element.dispatchEvent(event)
    await flushPromises()

    expect(event.defaultPrevented).toBe(true)
    expect(wrapper.emitted('add')?.at(-1)?.[0]).toBe('shortcut text')
    expect((box.element as HTMLTextAreaElement).value).toBe('')
  })
})
