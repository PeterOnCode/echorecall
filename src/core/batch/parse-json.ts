import { LineCounter, parseDocument } from 'yaml'

import type { BatchDocumentError } from './contract'

export type ParseJsonResult =
  | { ok: true; value: unknown }
  | { ok: false; error: BatchDocumentError }

function malformed(): ParseJsonResult {
  return { ok: false, error: { scope: 'document', code: 'malformed' } }
}

/** Parse strict JSON after an AST preflight that detects decoded duplicate properties. */
export function parseJson(content: string): ParseJsonResult {
  const lineCounter = new LineCounter()
  const document = parseDocument(content, {
    lineCounter,
    logLevel: 'silent',
    schema: 'json',
    strict: true,
    stringKeys: true,
    uniqueKeys: true,
  })
  const duplicate = document.errors.find((error) => error.code === 'DUPLICATE_KEY')
  if (duplicate) {
    const position = duplicate.linePos?.[0]
    return {
      ok: false,
      error: {
        scope: 'document',
        code: 'duplicateProperty',
        ...(position ? { line: position.line, column: position.col } : {}),
      },
    }
  }

  try {
    return { ok: true, value: JSON.parse(content) as unknown }
  } catch {
    return malformed()
  }
}
