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
  | { status: 'imported'; filename: string; count: number }

/** Browser file adapter around the pure batch parser. */
export function useBatchImport() {
  const state = ref<BatchImportState>({ status: 'idle' })
  const preview = computed(() => state.value.status === 'preview' ? state.value.preview : null)
  const error = computed(() => state.value.status === 'blocked' ? state.value.error : null)

  async function selectBatchFile(file: File, base: BatchBaseInput): Promise<void> {
    const filename = file.name
    if (!/\.ya?ml$/i.test(filename)) {
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
    const result = parseBatch({ content, filename, format: 'yaml', base: frozenBase })
    state.value = result.ok
      ? { status: 'preview', preview: result.preview }
      : { status: 'blocked', filename, error: result.error }
  }

  function cancelBatchImport(): void {
    state.value = { status: 'idle' }
  }

  function confirmedInputs(): ResolvedQueueInput[] {
    if (state.value.status !== 'preview') return []
    return state.value.preview.candidates.flatMap((candidate) => candidate.valid ? [candidate.input] : [])
  }

  function finishBatchImport(count: number): void {
    if (state.value.status !== 'preview') return
    state.value = { status: 'imported', filename: state.value.preview.filename, count }
  }

  return { state, preview, error, selectBatchFile, cancelBatchImport, confirmedInputs, finishBatchImport }
}
