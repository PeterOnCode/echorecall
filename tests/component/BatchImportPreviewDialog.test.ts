import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useNuxtApp } from '#imports'
import type { BatchPreview } from '#core/client'
import BatchImportPreviewDialog from '~/components/generate/BatchImportPreviewDialog.vue'

const colorMode = reactive({ preference: 'system', value: 'light' })
mockNuxtImport('useColorMode', () => () => colorMode)

const preview: BatchPreview = {
  filename: 'narration.yaml',
  format: 'yaml',
  counts: { valid: 2, rejected: 0, blank: 0 },
  canConfirm: true,
  candidates: [
    {
      valid: true,
      location: { kind: 'item', number: 1 },
      display: {
        excerpt: 'First line Second line',
        voiceId: 'nova',
        model: 'gpt-4o-mini-tts',
        format: 'mp3',
      },
      issues: [],
      input: {
        text: 'First line\nSecond line',
        voiceId: 'nova',
        model: 'gpt-4o-mini-tts',
        format: 'mp3',
        instructions: 'Speak clearly',
        metadata: {},
      },
    },
    {
      valid: true,
      location: { kind: 'item', number: 2 },
      display: {
        excerpt: 'Second item',
        voiceId: 'echo',
        model: 'tts-1-hd',
        format: 'flac',
      },
      issues: [],
      input: {
        text: 'Second item',
        voiceId: 'echo',
        model: 'tts-1-hd',
        format: 'flac',
        metadata: {},
      },
    },
  ],
}

function panel(): HTMLElement | null {
  return document.body.querySelector('[data-test="batch-import-preview-dialog"]')
}

function removeStalePreviewPanels() {
  document.body.querySelectorAll('[data-test="batch-import-preview-dialog"]').forEach((node) => node.remove())
}

beforeEach(async () => {
  removeStalePreviewPanels()
  await useNuxtApp().$i18n.setLocale('en')
  colorMode.preference = 'system'
  colorMode.value = 'light'
})

afterEach(async () => {
  removeStalePreviewPanels()
  vi.restoreAllMocks()
  await useNuxtApp().$i18n.setLocale('hu')
})

describe('BatchImportPreviewDialog – valid YAML preview (008 · US1)', () => {
  it('shows the filename, totals, and ordered one-based items with excerpts', async () => {
    const wrapper = await mountSuspended(BatchImportPreviewDialog, {
      props: { open: true, preview },
    })
    await flushPromises()

    expect(panel()).not.toBeNull()
    expect(panel()!.textContent).toContain('narration.yaml')
    const counts = document.body.querySelector('[data-test="batch-preview-counts"]')
    expect(counts?.textContent).toContain('2')
    expect(counts?.textContent).toContain('0')

    const rows = [...document.body.querySelectorAll('[data-test="batch-preview-row"]')]
    expect(rows).toHaveLength(2)
    expect(rows[0]?.textContent).toContain('Item 1')
    expect(rows[0]?.textContent).toContain('First line Second line')
    expect(rows[1]?.textContent).toContain('Item 2')
    expect(rows[1]?.textContent).toContain('Second item')
    wrapper.unmount()
  })

  it('shows every candidate’s resolved voice, model, and format', async () => {
    const wrapper = await mountSuspended(BatchImportPreviewDialog, {
      props: { open: true, preview },
    })
    await flushPromises()

    const rows = [...document.body.querySelectorAll('[data-test="batch-preview-row"]')]
    expect(rows[0]?.querySelector('[data-test="batch-preview-voice"]')?.textContent).toContain(
      'nova',
    )
    expect(rows[0]?.querySelector('[data-test="batch-preview-model"]')?.textContent).toContain(
      'gpt-4o-mini-tts',
    )
    expect(rows[0]?.querySelector('[data-test="batch-preview-format"]')?.textContent).toContain(
      'mp3',
    )
    expect(rows[1]?.querySelector('[data-test="batch-preview-voice"]')?.textContent).toContain(
      'echo',
    )
    expect(rows[1]?.querySelector('[data-test="batch-preview-model"]')?.textContent).toContain(
      'tts-1-hd',
    )
    expect(rows[1]?.querySelector('[data-test="batch-preview-format"]')?.textContent).toContain(
      'flac',
    )
    wrapper.unmount()
  })

  it('emits confirm and cancel from the preview actions', async () => {
    const wrapper = await mountSuspended(BatchImportPreviewDialog, {
      props: { open: true, preview },
    })
    await flushPromises()
    ;(
      document.body.querySelector('[data-test="batch-preview-confirm"]') as HTMLButtonElement
    ).click()
    ;(
      document.body.querySelector('[data-test="batch-preview-cancel"]') as HTMLButtonElement
    ).click()

    expect(wrapper.emitted('confirm')).toBeTruthy()
    expect(wrapper.emitted('cancel')).toBeTruthy()
    wrapper.unmount()
  })
})
