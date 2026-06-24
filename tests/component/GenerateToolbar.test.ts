import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import GenerateToolbar from '~/components/generate/GenerateToolbar.vue'

// Centralized action toolbar for the Generate workspace (005 · US2 / FR-004/005/
// 005a, contract §2). Hosts upload, previous, next, generate, save queue, open
// queue and open settings. Prev/next are disabled at the selection boundaries;
// generate is disabled when there is nothing to generate or a run is in flight;
// when rows are checked, generate advertises that it acts on the selection. Each
// action emits a discrete event the page wires to the queue/file composables.

const BASE = {
  hasPrev: true,
  hasNext: true,
  canGenerate: true,
  generating: false,
  checkedCount: 0,
}

function isDisabled(wrapper: Awaited<ReturnType<typeof mountSuspended>>, testId: string): boolean {
  return (wrapper.find(`[data-test="${testId}"]`).element as HTMLButtonElement).disabled
}

describe('GenerateToolbar', () => {
  it('renders every primary action', async () => {
    const wrapper = await mountSuspended(GenerateToolbar, { props: BASE })
    for (const id of [
      'toolbar-upload',
      'toolbar-prev',
      'toolbar-next',
      'toolbar-generate',
      'toolbar-save-queue',
      'toolbar-open-queue',
      'toolbar-open-settings',
    ]) {
      expect(wrapper.find(`[data-test="${id}"]`).exists(), id).toBe(true)
    }
  })

  it('disables prev/next at the selection boundaries', async () => {
    const wrapper = await mountSuspended(GenerateToolbar, {
      props: { ...BASE, hasPrev: false, hasNext: false },
    })
    expect(isDisabled(wrapper, 'toolbar-prev')).toBe(true)
    expect(isDisabled(wrapper, 'toolbar-next')).toBe(true)
  })

  it('enables prev/next when navigation is available', async () => {
    const wrapper = await mountSuspended(GenerateToolbar, { props: BASE })
    expect(isDisabled(wrapper, 'toolbar-prev')).toBe(false)
    expect(isDisabled(wrapper, 'toolbar-next')).toBe(false)
  })

  it('disables generate when nothing can be generated or a run is in flight', async () => {
    const empty = await mountSuspended(GenerateToolbar, { props: { ...BASE, canGenerate: false } })
    expect(isDisabled(empty, 'toolbar-generate')).toBe(true)

    const running = await mountSuspended(GenerateToolbar, { props: { ...BASE, generating: true } })
    expect(isDisabled(running, 'toolbar-generate')).toBe(true)
  })

  it('disables the queue-mutating actions (upload, open-queue) during a run', async () => {
    // Mutating the queue mid-run (uploading rows, or replacing it via open-queue)
    // races the in-flight generation loop, so those entry points lock while busy;
    // save-queue is read-only and stays available.
    const wrapper = await mountSuspended(GenerateToolbar, { props: { ...BASE, generating: true } })
    expect(isDisabled(wrapper, 'toolbar-upload')).toBe(true)
    expect(isDisabled(wrapper, 'toolbar-open-queue')).toBe(true)
    expect(isDisabled(wrapper, 'toolbar-save-queue')).toBe(false)
  })

  it('advertises the selection on the generate control when rows are checked', async () => {
    const none = await mountSuspended(GenerateToolbar, { props: { ...BASE, checkedCount: 0 } })
    const some = await mountSuspended(GenerateToolbar, { props: { ...BASE, checkedCount: 2 } })

    const noneTitle = none.find('[data-test="toolbar-generate"]').attributes('title') ?? ''
    const someTitle = some.find('[data-test="toolbar-generate"]').attributes('title') ?? ''
    expect(someTitle).toContain('2')
    expect(someTitle).not.toBe(noneTitle)
  })

  it('emits a discrete event for each action', async () => {
    const wrapper = await mountSuspended(GenerateToolbar, { props: BASE })
    const map: [string, string][] = [
      ['toolbar-upload', 'upload'],
      ['toolbar-prev', 'prev'],
      ['toolbar-next', 'next'],
      ['toolbar-generate', 'generate'],
      ['toolbar-save-queue', 'save-queue'],
      ['toolbar-open-queue', 'open-queue'],
      ['toolbar-open-settings', 'open-settings'],
    ]
    for (const [testId, event] of map) {
      await wrapper.find(`[data-test="${testId}"]`).trigger('click')
      expect(wrapper.emitted(event), event).toBeTruthy()
    }
  })

  // FR-020 / SC-009: every toolbar action must be keyboard-operable and exposed to
  // assistive tech. Each renders as a native <button> (focusable + Enter/Space) and
  // carries a non-empty accessible name — a visible label (upload, generate) or an
  // aria-label for the icon-only controls (prev, next, save, open, settings).
  it('exposes every action to keyboard and assistive tech (FR-020)', async () => {
    const wrapper = await mountSuspended(GenerateToolbar, { props: BASE })
    for (const id of [
      'toolbar-upload',
      'toolbar-prev',
      'toolbar-next',
      'toolbar-generate',
      'toolbar-save-queue',
      'toolbar-open-queue',
      'toolbar-open-settings',
    ]) {
      const btn = wrapper.find(`[data-test="${id}"]`).element as HTMLElement
      expect(btn.tagName, id).toBe('BUTTON')
      const name = btn.getAttribute('aria-label') ?? btn.textContent?.trim() ?? ''
      expect(name.length, `${id} accessible name`).toBeGreaterThan(0)
    }
  })
})
