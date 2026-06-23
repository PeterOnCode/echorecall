import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import QueueColumnsDialog from '~/components/generate/QueueColumnsDialog.vue'
import type { QueueColumnId } from '~/composables/useViewPreferences'

// Column-visibility chooser for the queue (005 · US3 / FR-012, contract §4): a modal
// with one toggle per data column. Toggling a column emits the updated visibility
// map (v-model:columns); the guard never lets the user hide every column — the last
// remaining visible toggle is disabled. Persistence itself lives in
// useViewPreferences (its own unit test); here we assert the dialog's emit + guard.
// UModal teleports its panel to document.body, so the controls are queried there.

const COLUMN_IDS: QueueColumnId[] = ['source', 'voice', 'format', 'recordedAt', 'language', 'status']

function allVisible(): Record<QueueColumnId, boolean> {
  return Object.fromEntries(COLUMN_IDS.map((id) => [id, true])) as Record<QueueColumnId, boolean>
}

function el(testId: string): HTMLElement | null {
  return document.body.querySelector(`[data-test="${testId}"]`)
}

describe('QueueColumnsDialog', () => {
  it('renders a toggle for every data column', async () => {
    const wrapper = await mountSuspended(QueueColumnsDialog, {
      props: { open: true, columns: allVisible() },
    })
    await flushPromises()
    expect(el('queue-columns-dialog')).not.toBeNull()
    for (const id of COLUMN_IDS) {
      expect(el(`queue-column-toggle-${id}`), id).not.toBeNull()
    }
    wrapper.unmount()
  })

  it('emits the updated visibility map when a visible column is toggled off', async () => {
    const wrapper = await mountSuspended(QueueColumnsDialog, {
      props: { open: true, columns: allVisible() },
    })
    await flushPromises()

    el('queue-column-toggle-voice')!.click()
    await flushPromises()

    const emitted = wrapper.emitted('update:columns')
    expect(emitted).toBeTruthy()
    expect((emitted!.at(-1)![0] as Record<QueueColumnId, boolean>).voice).toBe(false)
    wrapper.unmount()
  })

  it('disables the last visible toggle so columns can never all be hidden', async () => {
    const onlyStatus = Object.fromEntries(
      COLUMN_IDS.map((id) => [id, id === 'status']),
    ) as Record<QueueColumnId, boolean>
    const wrapper = await mountSuspended(QueueColumnsDialog, {
      props: { open: true, columns: onlyStatus },
    })
    await flushPromises()

    expect((el('queue-column-toggle-status') as HTMLButtonElement).disabled).toBe(true)
    // A hidden column can still be re-enabled.
    expect((el('queue-column-toggle-voice') as HTMLButtonElement).disabled).toBe(false)
    wrapper.unmount()
  })

  it('closes via the apply button', async () => {
    const wrapper = await mountSuspended(QueueColumnsDialog, {
      props: { open: true, columns: allVisible() },
    })
    await flushPromises()

    el('queue-columns-apply')!.click()
    await flushPromises()

    const emitted = wrapper.emitted('update:open')
    expect(emitted).toBeTruthy()
    expect(emitted!.at(-1)![0]).toBe(false)
    wrapper.unmount()
  })
})
