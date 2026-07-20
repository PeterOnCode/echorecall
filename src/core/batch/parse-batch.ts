import type { BatchParseResult, ParseBatchRequest } from './contract'
import { parseYaml } from './parse-yaml'
import { validateBatch } from './validate-batch'

/** Parse and validate a batch document without performing any queue mutation. */
export function parseBatch(request: ParseBatchRequest): BatchParseResult {
  if (request.format !== 'yaml') {
    return { ok: false, error: { scope: 'file', code: 'unsupportedExtension' } }
  }
  const parsed = parseYaml(request.content)
  if (!parsed.ok) return parsed
  return validateBatch(parsed.value, request)
}
