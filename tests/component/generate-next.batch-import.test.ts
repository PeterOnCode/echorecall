import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import GenerateNextPage from '~/pages/generate.vue'
import GenerationSettingsPanel from '~/components/generate/GenerationSettingsPanel.vue'
import QueuePanel from '~/components/generate/QueuePanel.vue'
import type { QueueItem } from '../../app/composables/useQueue'

registerEndpoint('/api/voices', () => ({
  voices: [
    { id: 'alloy', label: 'Alloy' },
    { id: 'echo', label: 'Echo' },
    { id: 'nova', label: 'Nova' },
  ],
}))
registerEndpoint('/api/settings/defaults', () => ({
  defaultTags: { artist: 'Base artist' },
}))
registerEndpoint('/api/settings/generation-defaults', () => ({ generationDefaults: {} }))

const yamlFile = () =>
  new File(
    [
      `schema: echorecall.batch
version: 1
items:
  - text: First YAML row
  - text: Second YAML row
`,
    ],
    'narration.yaml',
    { type: 'application/yaml' },
  )

async function settle(): Promise<void> {
  for (let index = 0; index < 6; index++) await flushPromises()
}

async function mountPage() {
  const wrapper = await mountSuspended(GenerateNextPage)
  await settle()
  return wrapper
}

async function chooseBatchFile(wrapper: VueWrapper, file: File): Promise<void> {
  const input = wrapper.find('[data-test="batch-file-input"]')
  Object.defineProperty(input.element, 'files', { configurable: true, value: [file] })
  await input.trigger('change')
  await settle()
}

function queueItems(wrapper: VueWrapper): QueueItem[] {
  return wrapper.getComponent(QueuePanel).props('items') as QueueItem[]
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem(
    'echorecall:viewprefs:genSettings',
    JSON.stringify({ voiceId: 'alloy', model: 'tts-1', format: 'wav' }),
  )
  vi.restoreAllMocks()
})

describe('Generate page – YAML batch import (008 · US1)', () => {
  it('freezes Generate values at selection and appends only after confirmation', async () => {
    const wrapper = await mountPage()
    const input = wrapper.find('[data-test="batch-file-input"]')
    const click = vi.spyOn(input.element as HTMLInputElement, 'click')

    await wrapper.find('[data-test="action-import-batch"]').trigger('click')
    expect(click).toHaveBeenCalledOnce()

    await chooseBatchFile(wrapper, yamlFile())

    expect(queueItems(wrapper)).toHaveLength(0)
    expect(document.body.querySelector('[data-test="batch-import-preview-dialog"]')).not.toBeNull()
    const previewRows = [...document.body.querySelectorAll('[data-test="batch-preview-row"]')]
    expect(previewRows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('First YAML row'),
      expect.stringContaining('Second YAML row'),
    ])

    const settings = wrapper.getComponent(GenerationSettingsPanel)
    settings.vm.$emit('update:voiceId', 'echo')
    settings.vm.$emit('update:model', 'tts-1-hd')
    settings.vm.$emit('update:format', 'flac')
    await settle()

    for (const row of previewRows) {
      expect(row.querySelector('[data-test="batch-preview-voice"]')?.textContent).toContain('alloy')
      expect(row.querySelector('[data-test="batch-preview-model"]')?.textContent).toContain('tts-1')
      expect(row.querySelector('[data-test="batch-preview-format"]')?.textContent).toContain('wav')
    }
    expect(queueItems(wrapper)).toHaveLength(0)
    ;(
      document.body.querySelector('[data-test="batch-preview-confirm"]') as HTMLButtonElement
    ).click()
    await settle()

    expect(queueItems(wrapper).map((item) => item.text)).toEqual([
      'First YAML row',
      'Second YAML row',
    ])
    for (const item of queueItems(wrapper)) {
      expect(item).toMatchObject({
        voiceId: 'alloy',
        model: 'tts-1',
        format: 'wav',
        metadata: { artist: 'Base artist' },
        status: 'queued',
        source: 'upload',
        sourceName: 'narration.yaml',
      })
    }
    wrapper.unmount()
  })

  it('clears the file input so the same YAML file can be selected again after cancel', async () => {
    const wrapper = await mountPage()
    const file = yamlFile()

    await chooseBatchFile(wrapper, file)
    expect(document.body.querySelectorAll('[data-test="batch-preview-row"]')).toHaveLength(2)
    ;(
      document.body.querySelector('[data-test="batch-preview-cancel"]') as HTMLButtonElement
    ).click()
    await settle()

    const input = wrapper.find('[data-test="batch-file-input"]')
    expect((input.element as HTMLInputElement).value).toBe('')
    expect(document.body.querySelector('[data-test="batch-import-preview-dialog"]')).toBeNull()
    expect(queueItems(wrapper)).toHaveLength(0)

    await chooseBatchFile(wrapper, file)
    expect(document.body.querySelectorAll('[data-test="batch-preview-row"]')).toHaveLength(2)
    expect(queueItems(wrapper)).toHaveLength(0)
    wrapper.unmount()
  })
})
