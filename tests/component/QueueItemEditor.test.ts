import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { MAX_INPUT_LENGTH } from '#core/client'
import QueueItemEditor from '~/components/generate/QueueItemEditor.vue'
import { useQueue, type ItemPatch, type QueueItem } from '~/composables/useQueue'

// Component + composable coverage for US3 (FR per spec §"Edit each queued item"):
// editing one row's text/voice/model/format/instructions/metadata affects only
// that row, with text revalidation (empty / >4,096 rejected, previous kept),
// instruction retention across model changes, and an untaggable-format warning
// that never discards metadata. The editor is controlled (props down, `update`
// events up); the authoritative mutation lives in useQueue().updateItem.

const voices = [
  { id: 'alloy', label: 'Alloy' },
  { id: 'echo', label: 'Echo' },
]

function baseItem(overrides: Partial<QueueItem> = {}): QueueItem {
  return {
    clientId: 'c1',
    text: 'Hello world',
    voiceId: 'alloy',
    model: 'gpt-4o-mini-tts',
    format: 'mp3',
    instructions: 'Speak slowly',
    metadata: { title: 'My Title' },
    status: 'queued',
    ...overrides,
  }
}

function mountEditor(item: QueueItem) {
  return mountSuspended(QueueItemEditor, { props: { item, voices } })
}

function lastPatch(wrapper: Awaited<ReturnType<typeof mountEditor>>): ItemPatch {
  const emitted = wrapper.emitted('update')
  if (!emitted || emitted.length === 0) throw new Error('no update emitted')
  return emitted[emitted.length - 1]![0] as ItemPatch
}

// The voice/model/format controls are now `USelectMenu` (a button-triggered combobox,
// not a native <select>), so `setValue` no longer applies. happy-dom can't reliably
// drive the teleported listbox, so we simulate a user choosing an option by emitting
// `update:modelValue` from the specific menu — located as the USelectMenu whose subtree
// contains the preserved data-test trigger. This exercises the component's real v-model
// wiring (the option-click behavior itself is covered by @nuxt/ui's own suite).
async function pickSelect(
  wrapper: Awaited<ReturnType<typeof mountEditor>>,
  testId: string,
  value: string,
) {
  const menu = wrapper
    .findAllComponents({ name: 'USelectMenu' })
    .find((c) => c.find(`[data-test="${testId}"]`).exists())
  if (!menu) throw new Error(`USelectMenu [data-test="${testId}"] not found`)
  menu.vm.$emit('update:modelValue', value)
  await flushPromises()
}

describe('QueueItemEditor (per-row edit)', () => {
  it('emits a minimal patch when the voice, model, or format changes', async () => {
    const wrapper = await mountEditor(baseItem())

    await pickSelect(wrapper, 'edit-voice', 'echo')
    expect(lastPatch(wrapper)).toEqual({ voiceId: 'echo' })

    await pickSelect(wrapper, 'edit-format', 'flac')
    expect(lastPatch(wrapper)).toEqual({ format: 'flac' })
  })

  it('rejects empty text, shows a message, keeps the previous value, and emits no text change', async () => {
    const wrapper = await mountEditor(baseItem())

    const textarea = wrapper.find('[data-test="edit-text"]')
    await textarea.setValue('   ')
    await textarea.trigger('blur')

    expect(wrapper.find('[data-test="edit-text-error"]').exists()).toBe(true)
    expect((textarea.element as HTMLTextAreaElement).value).toBe('Hello world')
    expect(wrapper.emitted('update')).toBeFalsy()
  })

  it('rejects text over the input cap and keeps the previous value', async () => {
    const wrapper = await mountEditor(baseItem())

    const textarea = wrapper.find('[data-test="edit-text"]')
    await textarea.setValue('x'.repeat(MAX_INPUT_LENGTH + 1))
    await textarea.trigger('blur')

    expect(wrapper.find('[data-test="edit-text-error"]').exists()).toBe(true)
    expect((textarea.element as HTMLTextAreaElement).value).toBe('Hello world')
    expect(wrapper.emitted('update')).toBeFalsy()
  })

  it('emits a trimmed text patch when the new text is valid', async () => {
    const wrapper = await mountEditor(baseItem())

    const textarea = wrapper.find('[data-test="edit-text"]')
    await textarea.setValue('  A new line  ')
    await textarea.trigger('blur')

    expect(lastPatch(wrapper)).toEqual({ text: 'A new line' })
    expect(wrapper.find('[data-test="edit-text-error"]').exists()).toBe(false)
  })

  it('keeps instructions visible and flags them unapplied when the model has no instruction support', async () => {
    const wrapper = await mountEditor(baseItem())

    // No note while on the instructions-capable model.
    expect(wrapper.find('[data-test="edit-instructions-note"]').exists()).toBe(false)

    await pickSelect(wrapper, 'edit-model', 'tts-1')
    expect(lastPatch(wrapper)).toEqual({ model: 'tts-1' })

    // Parent applies the patch; instructions are retained, not discarded.
    await wrapper.setProps({ item: baseItem({ model: 'tts-1' }) })
    expect((wrapper.find('[data-test="edit-instructions"]').element as HTMLTextAreaElement).value).toBe(
      'Speak slowly',
    )
    expect(wrapper.find('[data-test="edit-instructions-note"]').exists()).toBe(true)
  })

  it('warns about an untaggable format without discarding the entered metadata', async () => {
    const wrapper = await mountEditor(baseItem())

    expect(wrapper.find('[data-test="edit-skip-warning"]').exists()).toBe(false)

    await pickSelect(wrapper, 'edit-format', 'aac')
    expect(lastPatch(wrapper)).toEqual({ format: 'aac' })

    await wrapper.setProps({ item: baseItem({ format: 'aac' }) })
    expect(wrapper.find('[data-test="edit-skip-warning"]').exists()).toBe(true)
    // Metadata fields still carry the entered values.
    expect((wrapper.find('[data-test="meta-title"]').element as HTMLInputElement).value).toBe('My Title')
  })
})

describe('useQueue().updateItem', () => {
  it('updates only the targeted row', () => {
    const q = useQueue()
    const a = q.addItem('one')!
    const b = q.addItem('two')!

    const result = q.updateItem(a.clientId, { voiceId: 'echo', format: 'flac' })

    expect(result.ok).toBe(true)
    const rows = q.items.value
    expect(rows.find((i) => i.clientId === a.clientId)).toMatchObject({ voiceId: 'echo', format: 'flac' })
    expect(rows.find((i) => i.clientId === b.clientId)).toMatchObject({ voiceId: '', format: 'mp3' })
  })

  it('revalidates text, rejecting empty or over-long edits and keeping the previous value', () => {
    const q = useQueue()
    const a = q.addItem('keep me')!

    const empty = q.updateItem(a.clientId, { text: '   ' })
    expect(empty).toEqual({ ok: false, reason: 'empty' })

    const tooLong = q.updateItem(a.clientId, { text: 'x'.repeat(MAX_INPUT_LENGTH + 1) })
    expect(tooLong).toEqual({ ok: false, reason: 'tooLong' })

    expect(q.items.value[0]!.text).toBe('keep me')

    const ok = q.updateItem(a.clientId, { text: '  trimmed me  ' })
    expect(ok.ok).toBe(true)
    expect(q.items.value[0]!.text).toBe('trimmed me')
  })

  it('retains instructions across a model change and flags untaggable formats without discarding metadata', () => {
    const q = useQueue()
    const a = q.addItem('hi')!
    q.updateItem(a.clientId, { instructions: 'whisper', metadata: { title: 'T' } })

    q.updateItem(a.clientId, { model: 'tts-1' })
    expect(q.items.value[0]).toMatchObject({ model: 'tts-1', instructions: 'whisper' })

    const result = q.updateItem(a.clientId, { format: 'aac' })
    expect(result).toMatchObject({ ok: true, tagsSkipped: true })
    expect(q.items.value[0]!.metadata).toEqual({ title: 'T' })
  })

  it('reports a missing row as notFound rather than a text rejection', () => {
    const q = useQueue()
    expect(q.updateItem('nope', { voiceId: 'echo' })).toEqual({ ok: false, reason: 'notFound' })
  })
})

describe('useQueue().applyMetadataToPending', () => {
  it('fills shared form metadata into untouched rows but preserves a per-row metadata edit', () => {
    const q = useQueue()
    const shared = q.addItem('shared')!
    const edited = q.addItem('edited')!

    // One row gets its own metadata through the per-row editor (sets metadataEdited).
    q.updateItem(edited.clientId, { metadata: { title: 'Per-row Title' } })

    // Form metadata is filled, then applied to the batch just before generation.
    q.metadata.value = { title: 'Shared Title' }
    q.applyMetadataToPending()

    const rows = q.items.value
    expect(rows.find((i) => i.clientId === shared.clientId)!.metadata).toEqual({ title: 'Shared Title' })
    expect(rows.find((i) => i.clientId === edited.clientId)!.metadata).toEqual({ title: 'Per-row Title' })
  })
})
