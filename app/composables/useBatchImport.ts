import type {
  BatchBaseInput,
  BatchDocumentError,
  BatchPreview,
  ResolvedQueueInput,
} from '#core/client'
import { MAX_UPLOAD_BYTES, parseBatch } from '#core/client'

export type BatchImportState =
  | { status: 'idle' }
  | { status: 'reading'; filename: string }
  | { status: 'parsing'; filename: string }
  | { status: 'preview'; preview: BatchPreview }
  | { status: 'blocked'; filename: string; error: BatchDocumentError }
  | { status: 'imported'; filename: string; added: number; rejected: number }
  | { status: 'cancelled' }

export const BATCH_EXAMPLE_FILENAME = 'echorecall-batch-v1.yaml'

/** Browser file adapter around the pure batch parser. */
export function useBatchImport() {
  const state = ref<BatchImportState>({ status: 'idle' })
  const preview = computed(() => state.value.status === 'preview' ? state.value.preview : null)
  const error = computed(() => state.value.status === 'blocked' ? state.value.error : null)

  async function selectBatchFile(file: File, base: BatchBaseInput): Promise<void> {
    const filename = file.name
    const format = filename.match(/\.txt$/i)
      ? 'text'
      : filename.match(/\.ya?ml$/i)
        ? 'yaml'
        : filename.match(/\.json$/i)
          ? 'json'
          : null
    if (!format) {
      state.value = { status: 'blocked', filename, error: { scope: 'file', code: 'unsupportedExtension' } }
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      state.value = { status: 'blocked', filename, error: { scope: 'file', code: 'tooLarge' } }
      return
    }

    const frozenBase = JSON.parse(JSON.stringify(base)) as BatchBaseInput
    state.value = { status: 'reading', filename }
    let content: string
    try {
      content = await file.text()
    } catch {
      state.value = { status: 'blocked', filename, error: { scope: 'file', code: 'readFailed' } }
      return
    }

    state.value = { status: 'parsing', filename }
    const result = parseBatch({ content, filename, format, base: frozenBase })
    state.value = result.ok
      ? { status: 'preview', preview: result.preview }
      : { status: 'blocked', filename, error: result.error }
  }

  function cancelBatchImport(): void {
    state.value = { status: 'cancelled' }
  }

  function confirmedInputs(): ResolvedQueueInput[] {
    if (state.value.status !== 'preview') return []
    return state.value.preview.candidates.flatMap((candidate) => candidate.valid ? [candidate.input] : [])
  }

  function finishBatchImport(added: number): void {
    if (state.value.status !== 'preview') return
    if (!state.value.preview.canConfirm || added === 0) return
    state.value = {
      status: 'imported',
      filename: state.value.preview.filename,
      added,
      rejected: state.value.preview.counts.rejected,
    }
  }

  /** Download the versioned static example without touching import or queue state. */
  function downloadBatchExample(): void {
    const link = document.createElement('a')
    link.href = `/examples/${BATCH_EXAMPLE_FILENAME}`
    link.download = BATCH_EXAMPLE_FILENAME
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  return {
    state,
    preview,
    error,
    selectBatchFile,
    cancelBatchImport,
    confirmedInputs,
    finishBatchImport,
    downloadBatchExample,
  }
}
