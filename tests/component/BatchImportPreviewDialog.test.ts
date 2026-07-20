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

function invalidPreview(): BatchPreview {
  return {
    filename: 'mixed.yaml',
    format: 'yaml',
    counts: { valid: 1, rejected: 1, blank: 0 },
    canConfirm: true,
    candidates: [
      preview.candidates[0]!,
      {
        valid: false,
        location: { kind: 'item', number: 2 },
        display: { excerpt: 'Bad item', voiceId: 'missing', model: 'tts-1', format: 'wav' },
        issues: [
          { code: 'invalidVoice', path: 'items[1].voiceId' },
          { code: 'unknownField', path: 'items[1].unexpected' },
        ],
      },
    ],
  }
}

function largePreview(): BatchPreview {
  const candidates: BatchPreview['candidates'] = Array.from({ length: 205 }, (_, index) => ({
    valid: true as const,
    location: { kind: 'item' as const, number: index + 1 },
    display: { excerpt: `Candidate ${index + 1}`, voiceId: 'alloy', model: 'tts-1', format: 'wav' },
    issues: [] as [],
    input: {
      text: `Candidate ${index + 1}`,
      voiceId: 'alloy',
      model: 'tts-1' as const,
      format: 'wav' as const,
      metadata: {},
    },
  }))
  candidates[204] = {
    valid: false,
    location: { kind: 'item', number: 205 },
    display: { excerpt: 'Rejected candidate', voiceId: 'alloy', model: 'tts-1', format: 'wav' },
    issues: [{ code: 'emptyText', path: 'items[204].text' }],
  }
  return {
    filename: 'large.yaml',
    format: 'yaml',
    candidates,
    counts: { valid: 204, rejected: 1, blank: 0 },
    canConfirm: true,
  }
}

describe('BatchImportPreviewDialog – mixed review and accessibility (008 · US2)', () => {
  it('marks invalid rows and associates every localized issue with its row', async () => {
    const wrapper = await mountSuspended(BatchImportPreviewDialog, {
      props: { open: true, preview: invalidPreview() },
    })
    await flushPromises()

    const rows = [...document.body.querySelectorAll('[data-test="batch-preview-row"]')]
    expect(rows[0]?.getAttribute('data-valid')).toBe('true')
    expect(rows[1]?.getAttribute('data-valid')).toBe('false')
    expect(rows[1]?.querySelector('[data-test="batch-preview-invalid"]')?.textContent).toContain('Invalid')
    const issueNodes = [...rows[1]!.querySelectorAll('[data-test="batch-preview-issue"]')]
    expect(issueNodes).toHaveLength(2)
    expect(rows[1]?.querySelector('[data-test="batch-preview-issues"]')?.getAttribute('role')).toBe('alert')
    expect(issueNodes[0]?.textContent).toContain('voice')
    expect(issueNodes[1]?.textContent).toContain('field')
    const describedBy = rows[1]?.getAttribute('aria-describedby')?.split(' ') ?? []
    expect(issueNodes.every((node) => describedBy.includes(node.id))).toBe(true)
    wrapper.unmount()
  })

  it('disables confirmation with an explanation when no valid candidates exist', async () => {
    const zeroValid: BatchPreview = {
      ...invalidPreview(),
      candidates: [invalidPreview().candidates[1]!],
      counts: { valid: 0, rejected: 1, blank: 0 },
      canConfirm: false,
    }
    const wrapper = await mountSuspended(BatchImportPreviewDialog, {
      props: { open: true, preview: zeroValid },
    })
    await flushPromises()

    const confirm = document.body.querySelector('[data-test="batch-preview-confirm"]') as HTMLButtonElement
    expect(confirm.disabled).toBe(true)
    const reason = document.body.querySelector('[data-test="batch-preview-disabled-reason"]')
    expect(reason?.textContent).toContain('No valid items')
    expect(confirm.getAttribute('aria-describedby')).toBe(reason?.id)
    wrapper.unmount()
  })

  it('paginates at 100 rows while counts and confirmation cover the full preview', async () => {
    const wrapper = await mountSuspended(BatchImportPreviewDialog, {
      props: { open: true, preview: largePreview() },
    })
    await flushPromises()

    const rows = () => [...document.body.querySelectorAll('[data-test="batch-preview-row"]')]
    expect(rows()).toHaveLength(100)
    expect(rows()[0]?.textContent).toContain('Item 1')
    expect(rows()[99]?.textContent).toContain('Item 100')
    expect(document.body.querySelector('[data-test="batch-preview-counts"]')?.textContent).toContain('204')

    ;(document.body.querySelector('[data-test="batch-preview-next"]') as HTMLButtonElement).click()
    await flushPromises()
    expect(rows()).toHaveLength(100)
    expect(rows()[0]?.textContent).toContain('Item 101')
    expect(rows()[99]?.textContent).toContain('Item 200')

    ;(document.body.querySelector('[data-test="batch-preview-next"]') as HTMLButtonElement).click()
    await flushPromises()
    expect(rows()).toHaveLength(5)
    expect(rows()[4]?.textContent).toContain('Item 205')
    expect(document.body.querySelector('[data-test="batch-preview-page"]')?.textContent).toContain('3 / 3')
    const confirm = document.body.querySelector('[data-test="batch-preview-confirm"]') as HTMLButtonElement
    expect(confirm.textContent).toContain('204')
    confirm.click()
    expect(wrapper.emitted('confirm')).toHaveLength(1)
    wrapper.unmount()
  })

  it('announces readiness and keeps keyboard focus inside the labelled modal', async () => {
    const wrapper = await mountSuspended(BatchImportPreviewDialog, {
      props: { open: true, preview: invalidPreview() },
    })
    await flushPromises()

    const status = document.body.querySelector('[data-test="batch-preview-status"]')
    expect(status?.getAttribute('role')).toBe('status')
    expect(status?.getAttribute('aria-live')).toBe('polite')
    expect(status?.textContent).toContain('1 valid')
    expect(status?.textContent).toContain('1 rejected')
    const dialog = document.body.querySelector('[role="dialog"]')
    expect(dialog?.getAttribute('aria-labelledby')).toBeTruthy()
    expect(dialog?.contains(document.activeElement)).toBe(true)

    dialog?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(wrapper.emitted('cancel')).toBeTruthy()
    wrapper.unmount()
  })
})
