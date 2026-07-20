import { MAX_INPUT_LENGTH } from '../tts/generate'
import type {
  BatchBaseInput,
  BatchParseResult,
  ImportCandidate,
  ParseBatchRequest,
  ResolvedQueueInput,
} from './contract'

function cloneBase(base: BatchBaseInput): BatchBaseInput {
  return {
    voiceId: base.voiceId,
    model: base.model,
    format: base.format,
    ...(base.instructions === undefined ? {} : { instructions: base.instructions }),
    metadata: structuredClone(base.metadata),
  }
}

/** Convert line-oriented text into the same ordered preview contract as structured imports. */
export function parseText(
  content: string,
  request: Pick<ParseBatchRequest, 'filename' | 'base'>,
): BatchParseResult {
  if (content.trim().length === 0) {
    return {
      ok: true,
      preview: {
        filename: request.filename,
        format: 'text',
        candidates: [],
        counts: { valid: 0, rejected: 0, blank: 0 },
        canConfirm: false,
      },
    }
  }

  const lines = content.split(/\r?\n/)
  if (lines.length > 1 && lines.at(-1) === '') lines.pop()

  const candidates: ImportCandidate[] = []
  let blank = 0
  lines.forEach((raw, index) => {
    const text = raw.trim()
    if (text.length === 0) {
      blank++
      return
    }

    const number = index + 1
    const location = { kind: 'line' as const, number }
    const resolved = cloneBase(request.base)
    const display = {
      excerpt: text.replace(/\s+/g, ' ').slice(0, 120),
      voiceId: resolved.voiceId,
      model: resolved.model,
      format: resolved.format,
    }
    if (text.length > MAX_INPUT_LENGTH) {
      candidates.push({
        valid: false,
        location,
        display,
        issues: [{ code: 'textTooLong', path: `lines[${number}]` }],
      })
      return
    }

    const input: ResolvedQueueInput = { ...resolved, text }
    candidates.push({ valid: true, location, display, issues: [], input })
  })

  const valid = candidates.filter((candidate) => candidate.valid).length
  const rejected = candidates.length - valid
  return {
    ok: true,
    preview: {
      filename: request.filename,
      format: 'text',
      candidates,
      counts: { valid, rejected, blank },
      canConfirm: valid > 0,
    },
  }
}
