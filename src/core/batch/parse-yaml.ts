import { LineCounter, parseAllDocuments, visit } from 'yaml'

import type { BatchDocumentError } from './contract'

export type ParseYamlResult =
  | { ok: true; value: unknown }
  | { ok: false; error: BatchDocumentError }

function documentError(
  code: BatchDocumentError['code'],
  lineCounter: LineCounter,
  offset?: number,
): ParseYamlResult {
  const position = offset === undefined ? undefined : lineCounter.linePos(offset)
  return {
    ok: false,
    error: {
      scope: 'document',
      code,
      ...(position ? { line: position.line, column: position.col } : {}),
    },
  }
}

/** Parse the deliberately small, safe YAML 1.2 subset accepted by batch imports. */
export function parseYaml(content: string): ParseYamlResult {
  const lineCounter = new LineCounter()
  const documents = parseAllDocuments(content, {
    lineCounter,
    logLevel: 'silent',
    merge: false,
    prettyErrors: true,
    resolveKnownTags: false,
    schema: 'core',
    strict: true,
    uniqueKeys: true,
    version: '1.2',
  })
  if (documents.length !== 1) return documentError('malformed', lineCounter)
  const document = documents[0]
  if (!document) return documentError('malformed', lineCounter)

  let aliasOffset: number | undefined
  let anchorOffset: number | undefined
  let tagOffset: number | undefined
  visit(document, {
    Alias(_key, node) {
      aliasOffset ??= node.range?.[0]
    },
    Node(_key, node) {
      if (node.anchor) anchorOffset ??= node.range?.[0]
      if (node.tag) tagOffset ??= node.range?.[0]
    },
  })

  if (aliasOffset !== undefined) return documentError('alias', lineCounter, aliasOffset)
  if (anchorOffset !== undefined) return documentError('anchor', lineCounter, anchorOffset)
  if (tagOffset !== undefined) return documentError('customTag', lineCounter, tagOffset)

  const parseError = document.errors[0]
  if (parseError) {
    const code = parseError.code === 'DUPLICATE_KEY' ? 'duplicateKey' : 'malformed'
    const position = parseError.linePos?.[0]
    return {
      ok: false,
      error: {
        scope: 'document',
        code,
        ...(position ? { line: position.line, column: position.col } : {}),
      },
    }
  }

  try {
    return { ok: true, value: document.toJS({ mapAsMap: false, maxAliasCount: 0 }) as unknown }
  } catch {
    return documentError('malformed', lineCounter)
  }
}
