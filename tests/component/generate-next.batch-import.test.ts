import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { useNuxtApp } from '#imports'
import { MAX_UPLOAD_BYTES } from '#core/client'
import GenerateNextPage from '~/pages/generate.vue'
import GenerationSettingsPanel from '~/components/generate/GenerationSettingsPanel.vue'
import QueuePanel from '~/components/generate/QueuePanel.vue'
import ScriptEntryPanel from '~/components/generate/ScriptEntryPanel.vue'
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

function structuredFile(name: string): File {
  const content = name.endsWith('.json')
    ? JSON.stringify({
        schema: 'echorecall.batch',
        version: 1,
        items: [
          { text: 'Valid JSON row', metadata: { artist: 'JSON artist' } },
          { text: '', metadata: { artist: 'Rejected artist' } },
        ],
      })
    : `schema: echorecall.batch
version: 1
items:
  - text: ${name} row
`
  return new File([content], name, {
    type: name.endsWith('.json') ? 'application/json' : 'application/yaml',
  })
}

function textFile(): File {
  return new File([
    `  First text row  \n\n${'x'.repeat(4097)}\nThird text row\n`,
  ], 'lines.txt', { type: 'text/plain' })
}

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

beforeEach(async () => {
  localStorage.clear()
  localStorage.setItem(
    'echorecall:viewprefs:genSettings',
    JSON.stringify({ voiceId: 'alloy', model: 'tts-1', format: 'wav' }),
  )
  vi.restoreAllMocks()
  await useNuxtApp().$i18n.setLocale('en')
})

afterEach(async () => {
  document.body.querySelectorAll('[data-test="batch-import-preview-dialog"]').forEach((node) => node.remove())
  await useNuxtApp().$i18n.setLocale('hu')
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

function namedFile(name: string, content = 'not used'): File {
  return new File([content], name, { type: 'application/octet-stream' })
}

function mixedYamlFile(): File {
  return new File([
    `schema: echorecall.batch
version: 1
items:
  - text: Valid imported row
  - text: ""
  - text: Unknown-field row
    unexpected: true
`,
  ], 'mixed.yaml', { type: 'application/yaml' })
}

describe('Generate page – mixed import states and errors (008 · US2)', () => {
  it.each([
    ['unsupported extension', namedFile('batch.csv'), 'Unsupported file type'],
    ['oversized file', (() => {
      const file = namedFile('large.yaml')
      Object.defineProperty(file, 'size', { configurable: true, value: MAX_UPLOAD_BYTES + 1 })
      return file
    })(), 'too large'],
  ])('shows an actionable alert for an %s without changing the queue', async (_label, file, message) => {
    const wrapper = await mountPage()
    await chooseBatchFile(wrapper, file)

    const alert = wrapper.find('[data-test="batch-import-error"]')
    expect(alert.attributes('role')).toBe('alert')
    expect(alert.text()).toContain(message)
    expect(queueItems(wrapper)).toHaveLength(0)
    expect(document.body.querySelector('[data-test="batch-import-preview-dialog"]')).toBeNull()
    wrapper.unmount()
  })

  it('reports unreadable files and blocking document errors with no queue mutation', async () => {
    const wrapper = await mountPage()
    const unreadable = namedFile('unreadable.yaml')
    vi.spyOn(unreadable, 'text').mockRejectedValue(new Error('read failed'))
    await chooseBatchFile(wrapper, unreadable)
    expect(wrapper.get('[data-test="batch-import-error"]').text()).toContain('could not be read')
    expect(queueItems(wrapper)).toHaveLength(0)

    const wrongSchema = new File([
      'schema: echorecall.queue\nversion: 1\nitems: []\n',
    ], 'wrong-schema.yaml', { type: 'application/yaml' })
    await chooseBatchFile(wrapper, wrongSchema)
    const alert = wrapper.get('[data-test="batch-import-error"]')
    expect(alert.attributes('role')).toBe('alert')
    expect(alert.text()).toContain('schema')
    expect(alert.text()).not.toBe('schema')
    expect(queueItems(wrapper)).toHaveLength(0)
    wrapper.unmount()
  })

  it('announces parsing, preview readiness, and valid-only import completion', async () => {
    const wrapper = await mountPage()
    const file = mixedYamlFile()
    let resolveText: ((content: string) => void) | undefined
    const pendingText = new Promise<string>((resolve) => { resolveText = resolve })
    vi.spyOn(file, 'text').mockReturnValue(pendingText)
    const input = wrapper.get('[data-test="batch-file-input"]')
    Object.defineProperty(input.element, 'files', { configurable: true, value: [file] })
    input.element.dispatchEvent(new Event('change', { bubbles: true }))
    await flushPromises()

    const status = wrapper.get('[data-test="batch-import-status"]')
    expect(status.attributes('role')).toBe('status')
    expect(status.attributes('aria-live')).toBe('polite')
    expect(status.text()).toContain('Parsing')

    resolveText?.(await mixedYamlFile().text())
    await settle()
    expect(wrapper.get('[data-test="batch-import-status"]').text()).toContain('1 valid')
    expect(wrapper.get('[data-test="batch-import-status"]').text()).toContain('2 rejected')

    ;(document.body.querySelector('[data-test="batch-preview-confirm"]') as HTMLButtonElement).click()
    await settle()
    expect(queueItems(wrapper).map((item) => item.text)).toEqual(['Valid imported row'])
    const success = wrapper.get('[data-test="batch-import-success"]')
    expect(success.attributes('role')).toBe('status')
    expect(success.text()).toContain('1 imported')
    expect(success.text()).toContain('2 rejected')
    wrapper.unmount()
  })

  it('appends after rows added while preview is open and cancellation remains mutation-free', async () => {
    const wrapper = await mountPage()
    await chooseBatchFile(wrapper, mixedYamlFile())

    wrapper.getComponent(ScriptEntryPanel).vm.$emit('add', 'Concurrent typed row')
    await settle()
    ;(document.body.querySelector('[data-test="batch-preview-confirm"]') as HTMLButtonElement).click()
    await settle()
    expect(queueItems(wrapper).map((item) => item.text)).toEqual([
      'Concurrent typed row',
      'Valid imported row',
    ])

    await chooseBatchFile(wrapper, mixedYamlFile())
    ;(document.body.querySelector('[data-test="batch-preview-cancel"]') as HTMLButtonElement).click()
    await settle()
    expect(queueItems(wrapper).map((item) => item.text)).toEqual([
      'Concurrent typed row',
      'Valid imported row',
    ])
    expect(document.body.querySelector('[data-test="batch-import-preview-dialog"]')).toBeNull()
    wrapper.unmount()
  })
})

describe('Generate page – JSON and text batch import (008 · US3)', () => {
  it('advertises and dispatches every supported batch extension', async () => {
    const wrapper = await mountPage()
    const input = wrapper.get('[data-test="batch-file-input"]')
    expect(input.attributes('accept')).toContain('.txt')
    expect(input.attributes('accept')).toContain('.yaml')
    expect(input.attributes('accept')).toContain('.yml')
    expect(input.attributes('accept')).toContain('.json')

    for (const filename of ['batch.yaml', 'batch.yml', 'batch.json']) {
      await chooseBatchFile(wrapper, structuredFile(filename))
      const dialog = document.body.querySelector('[data-test="batch-import-preview-dialog"]')
      expect(dialog?.textContent).toContain(filename)
      expect(dialog?.querySelector('[data-test="batch-preview-row"]')?.textContent)
        .toContain(filename.endsWith('.json') ? 'Valid JSON row' : `${filename} row`)
      ;(dialog?.querySelector('[data-test="batch-preview-cancel"]') as HTMLButtonElement).click()
      await settle()
    }

    wrapper.unmount()
  })

  it('previews JSON items and appends only valid rows with their source filename', async () => {
    const wrapper = await mountPage()
    wrapper.getComponent(ScriptEntryPanel).vm.$emit('add', 'Existing row')
    await settle()
    await chooseBatchFile(wrapper, structuredFile('narration.json'))

    const dialog = document.body.querySelector('[data-test="batch-import-preview-dialog"]')
    expect(dialog?.querySelectorAll('[data-test="batch-preview-row"]')).toHaveLength(2)
    expect(dialog?.querySelector('[data-test="batch-preview-counts"]')?.textContent).toContain('Valid: 1')
    expect(dialog?.querySelector('[data-test="batch-preview-counts"]')?.textContent).toContain('Rejected: 1')
    ;(dialog?.querySelector('[data-test="batch-preview-confirm"]') as HTMLButtonElement).click()
    await settle()

    expect(queueItems(wrapper).map((item) => item.text)).toEqual(['Existing row', 'Valid JSON row'])
    expect(queueItems(wrapper)[1]).toMatchObject({
      source: 'upload',
      sourceName: 'narration.json',
      metadata: { artist: 'JSON artist' },
      metadataEdited: true,
    })
    wrapper.unmount()
  })

  it('previews original text line numbers and confirms valid rows only in text mode', async () => {
    const wrapper = await mountPage()
    await chooseBatchFile(wrapper, textFile())

    const dialog = document.body.querySelector('[data-test="batch-import-preview-dialog"]')
    const rows = [...(dialog?.querySelectorAll('[data-test="batch-preview-row"]') ?? [])]
    expect(rows).toHaveLength(3)
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Line 1'),
      expect.stringContaining('Line 3'),
      expect.stringContaining('Line 4'),
    ])
    expect(rows[1]?.getAttribute('data-valid')).toBe('false')
    expect(dialog?.querySelector('[data-test="batch-preview-counts"]')?.textContent).toContain('Valid: 2')
    expect(dialog?.querySelector('[data-test="batch-preview-counts"]')?.textContent).toContain('Rejected: 1')
    expect(dialog?.querySelector('[data-test="batch-preview-counts"]')?.textContent).toContain('Blank: 1')

    ;(dialog?.querySelector('[data-test="batch-preview-confirm"]') as HTMLButtonElement).click()
    await settle()
    expect(queueItems(wrapper).map((item) => item.text)).toEqual(['First text row', 'Third text row'])
    expect(queueItems(wrapper).every((item) => item.sourceName === 'lines.txt')).toBe(true)
    expect(queueItems(wrapper).every((item) => item.metadataEdited === false)).toBe(true)
    wrapper.unmount()
  })
})

describe('Generate page – downloadable batch example (008 · US4)', () => {
  it('downloads the exact YAML example filename without mutating the queue', async () => {
    const wrapper = await mountPage()
    wrapper.getComponent(ScriptEntryPanel).vm.$emit('add', 'Existing row')
    await settle()

    let downloaded: { filename: string; href: string } | undefined
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloaded = { filename: this.download, href: this.href }
    })
    await wrapper.get('[data-test="action-download-batch-example"]').trigger('click')
    await settle()

    expect(downloaded).toMatchObject({ filename: 'echorecall-batch-v1.yaml' })
    expect(downloaded?.href).toContain('/examples/echorecall-batch-v1.yaml')
    expect(queueItems(wrapper).map((item) => item.text)).toEqual(['Existing row'])
    expect(document.body.querySelector('[data-test="batch-import-preview-dialog"]')).toBeNull()
    wrapper.unmount()
  })
})
