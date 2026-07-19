import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ScriptEntryPanel from '~/components/generate/ScriptEntryPanel.vue'

// 007 · US1 (T004 / FR-004): the Script entry column — a titled panel with a badge, a
// textarea, a character hint, Clear, and "Add to queue". Forks AddTextPanel: it
// validates with the shared validateItemText, emits `add` with the trimmed text and
// clears, and refuses a blank entry (no emit). Clear empties the box and emits `clear`.
describe('ScriptEntryPanel', () => {
  it('renders the panel, textarea, char hint, Clear and Add', async () => {
    const wrapper = await mountSuspended(ScriptEntryPanel)
    for (const id of ['script-panel', 'add-text-input', 'add-text-submit', 'script-clear', 'script-charcount']) {
      expect(wrapper.find(`[data-test="${id}"]`).exists(), id).toBe(true)
    }
  })

  it('reflects the typed length in the character hint', async () => {
    const wrapper = await mountSuspended(ScriptEntryPanel)
    await wrapper.find('[data-test="add-text-input"]').setValue('hello')
    expect(wrapper.find('[data-test="script-charcount"]').text()).toContain('5')
  })

  it('emits add with trimmed text and clears the box', async () => {
    const wrapper = await mountSuspended(ScriptEntryPanel)
    const box = wrapper.find('[data-test="add-text-input"]')
    await box.setValue('  hello world  ')
    await wrapper.find('[data-test="add-text-submit"]').trigger('click')
    expect(wrapper.emitted('add')?.at(-1)?.[0]).toBe('hello world')
    expect((box.element as HTMLTextAreaElement).value).toBe('')
  })

  it('refuses a blank entry (no add emitted)', async () => {
    const wrapper = await mountSuspended(ScriptEntryPanel)
    await wrapper.find('[data-test="add-text-input"]').setValue('   ')
    await wrapper.find('[data-test="add-text-submit"]').trigger('click')
    expect(wrapper.emitted('add')).toBeFalsy()
  })

  it('Clear empties the box and emits clear', async () => {
    const wrapper = await mountSuspended(ScriptEntryPanel)
    const box = wrapper.find('[data-test="add-text-input"]')
    await box.setValue('draft text')
    await wrapper.find('[data-test="script-clear"]').trigger('click')
    expect((box.element as HTMLTextAreaElement).value).toBe('')
    expect(wrapper.emitted('clear')).toBeTruthy()
  })
})
