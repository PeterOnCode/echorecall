import type { BatchParseResult, ParseBatchRequest } from './contract'
import { parseJson } from './parse-json'
import { parseText } from './parse-text'
import { parseYaml } from './parse-yaml'
import { validateBatch } from './validate-batch'

/** Parse and validate a batch document without performing any queue mutation. */
export function parseBatch(request: ParseBatchRequest): BatchParseResult {
  if (request.format === 'text') return parseText(request.content, request)
  const parsed = request.format === 'yaml'
    ? parseYaml(request.content)
    : parseJson(request.content)
  if (!parsed.ok) return parsed
  return validateBatch(parsed.value, request)
}
