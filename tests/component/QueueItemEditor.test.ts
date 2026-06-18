import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
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

describe('QueueItemEditor (per-row edit)', () => {
  it('emits a minimal patch when the voice, model, or format changes', async () => {
    const wrapper = await mountEditor(baseItem())

    await wrapper.find('[data-test="edit-voice"]').setValue('echo')
    expect(lastPatch(wrapper)).toEqual({ voiceId: 'echo' })

    await wrapper.find('[data-test="edit-format"]').setValue('flac')
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

    await wrapper.find('[data-test="edit-model"]').setValue('tts-1')
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

    await wrapper.find('[data-test="edit-format"]').setValue('aac')
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
})
