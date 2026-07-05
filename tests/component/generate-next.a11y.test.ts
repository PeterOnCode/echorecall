import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { reactive } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { VOICES } from '#core/client'
import ScriptEntryPanel from '~/components/generate/ScriptEntryPanel.vue'
import GenerationSettingsPanel from '~/components/generate/GenerationSettingsPanel.vue'
import GenerationActionBar from '~/components/generate/GenerationActionBar.vue'
import QueuePanel from '~/components/generate/QueuePanel.vue'
import GenerationProgressModal from '~/components/generate/GenerationProgressModal.vue'
import type { GenerationProgress } from '../../app/composables/useGeneration'
import type { QueueItem } from '../../app/composables/useQueue'

// 007 · Polish (T046 / FR-023, SC-007): accessibility/keyboard sweep across every control
// the redesigned Generate surface adds. Each interactive control we author MUST be a real,
// focusable native control (keyboard-operable) AND expose a non-empty accessible name
// (aria-label / labelled control / button text) — so an icon-only reset, the per-item
// remove, or the progress-modal confirm is never a silent, unlabelled AT target. Mirrors
// the 006 library sweep. (UModal needs the colorMode mock, per the recorded gotcha.)

const colorMode = reactive({ preference: 'system', value: 'light' })
mockNuxtImport('useColorMode', () => () => colorMode)

beforeEach(() => {
  colorMode.preference = 'system'
  colorMode.value = 'light'
})
afterEach(() => vi.restoreAllMocks())

/** The accessible name of a native control: aria-label, title, referenced/associated
 *  label, a wrapping <label>, or (for buttons) trimmed text content. */
function hasAccessibleName(el: HTMLElement, root: ParentNode): boolean {
  const aria = (el.getAttribute('aria-label') ?? '').trim()
  if (aria) return true
  const title = (el.getAttribute('title') ?? '').trim()
  if (title) return true
  const labelledby = el.getAttribute('aria-labelledby')
  if (labelledby) {
    const ref = root.querySelector(`#${CSS.escape(labelledby)}`)
    if (ref && (ref.textContent ?? '').trim()) return true
  }
  const id = el.getAttribute('id')
  if (id) {
    const forLabel = root.querySelector(`label[for="${CSS.escape(id)}"]`)
    if (forLabel && (forLabel.textContent ?? '').trim()) return true
  }
  if (el.closest('label')) return true
  return (el.textContent ?? '').trim().length > 0
}

/** Assert every button + checkable/textual input under `root` is named (and reachable). */
function expectControlsNamed(root: ParentNode, where: string) {
  const controls = root.querySelectorAll<HTMLElement>(
    'button, input[type="checkbox"], input[type="radio"], textarea',
  )
  expect(controls.length, `${where}: no interactive controls found`).toBeGreaterThan(0)
  for (const el of controls) {
    const tag = el.tagName.toLowerCase()
    const type = el.getAttribute('type') ?? ''
    const dataTest =
      el.getAttribute('data-test') ?? el.closest('[data-test]')?.getAttribute('data-test') ?? '?'
    expect(
      hasAccessibleName(el, root),
      `${where}: unnamed ${tag}${type ? `[${type}]` : ''} (near data-test="${dataTest}")`,
    ).toBe(true)
  }
}

function queueItem(clientId: string, text: string): QueueItem {
  return { clientId, text, voiceId: 'alloy', model: 'tts-1', format: 'mp3', metadata: {}, status: 'queued', source: 'text' }
}

describe('Generate redesign a11y sweep (007 / FR-023)', () => {
  it('ScriptEntryPanel controls (textarea, Clear, Add) are all named', async () => {
    const w = await mountSuspended(ScriptEntryPanel)
    await flushPromises()
    expectControlsNamed(w.element as ParentNode, 'ScriptEntryPanel')
  })

  it('GenerationSettingsPanel controls (selects, per-field resets) are all named', async () => {
    const w = await mountSuspended(GenerationSettingsPanel, {
      props: {
        voices: [...VOICES],
        voiceId: VOICES[0]!.id,
        model: 'tts-1',
        format: 'mp3',
      },
    })
    await flushPromises()
    expectControlsNamed(w.element as ParentNode, 'GenerationSettingsPanel')
  })

  it('GenerationActionBar controls (Save/Load/Upload/Generate) are all named', async () => {
    const w = await mountSuspended(GenerationActionBar, {
      props: { queueCount: 2, totalUsd: 0.01, unavailableCount: 1 },
    })
    await flushPromises()
    expectControlsNamed(w.element as ParentNode, 'GenerationActionBar')
  })

  it('QueuePanel per-item remove is named', async () => {
    const w = await mountSuspended(QueuePanel, {
      props: { items: [queueItem('a', 'hello')] },
    })
    await flushPromises()
    expectControlsNamed(w.element as ParentNode, 'QueuePanel')
  })

  it('GenerationProgressModal running + cancel-confirm controls are all named', async () => {
    const progress: GenerationProgress = {
      total: 2,
      index: 0,
      current: queueItem('a', 'hello'),
      succeeded: [],
      failed: [],
      notGenerated: [],
      state: 'running',
    }
    const w = await mountSuspended(GenerationProgressModal, { props: { open: true, progress } })
    await flushPromises()
    // Reveal the in-modal cancel confirm so its Yes/No buttons are swept too.
    const stop = w.findAllComponents({ name: 'UButton' }).find((c) => c.attributes('data-test') === 'progress-close')
    await stop!.trigger('click')
    await flushPromises()
    expectControlsNamed(document.body, 'GenerationProgressModal (running)')
    w.unmount()
  })

  it('GenerationProgressModal summary Close is named', async () => {
    const progress: GenerationProgress = {
      total: 2,
      index: 1,
      current: null,
      succeeded: ['id-a'],
      failed: [],
      notGenerated: [],
      state: 'completed',
    }
    const w = await mountSuspended(GenerationProgressModal, { props: { open: true, progress } })
    await flushPromises()
    expectControlsNamed(document.body, 'GenerationProgressModal (summary)')
    w.unmount()
  })
})
