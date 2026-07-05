import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { reactive } from 'vue'
import { flushPromises } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import GenerationProgressModal from '~/components/generate/GenerationProgressModal.vue'
import type { GenerationProgress } from '../../app/composables/useGeneration'
import type { QueueItem } from '../../app/composables/useQueue'

// 007 · US4 (T030 / FR-014–017): the generation progress modal — shows the current file
// and a succeeded/failed tally while running, disables the page (via UModal's overlay),
// and on close-request surfaces an IN-MODAL confirm (never a native window.confirm/alert).
// Confirming emits `confirm-cancel` (the page then requests a graceful stop); declining
// keeps the run going. When the run ends it shows a succeeded/failed/not-generated summary.

const colorMode = reactive({ preference: 'system', value: 'light' })
mockNuxtImport('useColorMode', () => () => colorMode)

// The modal must never use a native dialog (a11y + browser-automation rule): spy on
// window.confirm and assert it is never called.
const nativeConfirm = vi.fn()

beforeEach(() => {
  colorMode.preference = 'system'
  colorMode.value = 'light'
  vi.stubGlobal('confirm', nativeConfirm)
  nativeConfirm.mockClear()
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function item(text: string, sourceName?: string): QueueItem {
  return { clientId: 'x', text, voiceId: 'alloy', model: 'tts-1', format: 'mp3', metadata: {}, status: 'generating', source: 'text', ...(sourceName ? { sourceName } : {}) } as QueueItem
}

function runningProgress(): GenerationProgress {
  return {
    total: 3,
    index: 1,
    current: item('Hello there world'),
    succeeded: ['id-a'],
    failed: [{ clientId: 'b', error: 'boom' }],
    notGenerated: [],
    state: 'running',
  }
}

function finishedProgress(state: 'completed' | 'cancelled'): GenerationProgress {
  return {
    total: 3,
    index: 2,
    current: null,
    succeeded: ['id-a', 'id-b'],
    failed: [{ clientId: 'c', error: 'boom' }],
    notGenerated: state === 'cancelled' ? [item('leftover')] : [],
    state,
  }
}

// UButtons live inside the teleported UModal panel — findAllComponents traverses
// teleported children; wrapper.find does not.
function button(w: VueWrapper, test: string) {
  const btn = w.findAllComponents({ name: 'UButton' }).find((c) => c.attributes('data-test') === test)
  if (!btn) throw new Error(`UButton [data-test="${test}"] not found`)
  return btn
}

function inBody(test: string): Element | null {
  return document.body.querySelector(`[data-test="${test}"]`)
}

describe('GenerationProgressModal (running)', () => {
  it('teleports to the body only while open, showing current file + tally', async () => {
    const wrapper = await mountSuspended(GenerationProgressModal, {
      props: { open: false, progress: runningProgress() },
    })
    expect(inBody('progress-modal')).toBeNull()

    await wrapper.setProps({ open: true })
    await flushPromises()
    expect(inBody('progress-modal')).not.toBeNull()
    expect(inBody('progress-current')?.textContent).toContain('Hello there world')
    expect(inBody('progress-succeeded')?.textContent).toContain('1')
    expect(inBody('progress-failed')?.textContent).toContain('1')
    // No end-summary while running.
    expect(inBody('progress-summary')).toBeNull()
    wrapper.unmount()
  })

  it('surfaces an in-modal confirm on close-request (no native dialog); confirm emits confirm-cancel', async () => {
    const wrapper = await mountSuspended(GenerationProgressModal, {
      props: { open: true, progress: runningProgress() },
    })
    await flushPromises()
    // No confirm shown until the user requests a close.
    expect(inBody('progress-cancel-confirm')).toBeNull()

    await button(wrapper, 'progress-close').trigger('click')
    await flushPromises()
    expect(inBody('progress-cancel-confirm')).not.toBeNull()
    expect(wrapper.emitted('request-close')).toBeTruthy()
    expect(nativeConfirm).not.toHaveBeenCalled()

    await button(wrapper, 'progress-cancel-confirm-yes').trigger('click')
    expect(wrapper.emitted('confirm-cancel')).toBeTruthy()
    expect(nativeConfirm).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('declining the confirm emits decline-cancel and hides the confirm', async () => {
    const wrapper = await mountSuspended(GenerationProgressModal, {
      props: { open: true, progress: runningProgress() },
    })
    await flushPromises()
    await button(wrapper, 'progress-close').trigger('click')
    await flushPromises()

    await button(wrapper, 'progress-cancel-confirm-no').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('decline-cancel')).toBeTruthy()
    expect(inBody('progress-cancel-confirm')).toBeNull()
    wrapper.unmount()
  })

  it('routes an Esc/backdrop dismiss through request-close (no native dialog)', async () => {
    const wrapper = await mountSuspended(GenerationProgressModal, {
      props: { open: true, progress: runningProgress() },
    })
    await flushPromises()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(wrapper.emitted('request-close')).toBeTruthy()
    expect(inBody('progress-cancel-confirm')).not.toBeNull()
    expect(nativeConfirm).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})

describe('GenerationProgressModal (finished)', () => {
  it('shows the summary and emits done on close (completed)', async () => {
    const wrapper = await mountSuspended(GenerationProgressModal, {
      props: { open: true, progress: finishedProgress('completed') },
    })
    await flushPromises()
    expect(inBody('progress-summary')).not.toBeNull()
    expect(inBody('progress-succeeded')?.textContent).toContain('2')
    expect(inBody('progress-failed')?.textContent).toContain('1')

    await button(wrapper, 'progress-close').trigger('click')
    expect(wrapper.emitted('done')).toBeTruthy()
    wrapper.unmount()
  })

  it('reports the not-generated count when cancelled', async () => {
    const wrapper = await mountSuspended(GenerationProgressModal, {
      props: { open: true, progress: finishedProgress('cancelled') },
    })
    await flushPromises()
    const summary = inBody('progress-summary')
    expect(summary).not.toBeNull()
    expect(inBody('progress-not-generated')?.textContent).toContain('1')
    wrapper.unmount()
  })
})
