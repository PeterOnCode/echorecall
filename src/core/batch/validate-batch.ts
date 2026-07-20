import type { Format, Metadata, Model } from '../shared/types'
import { MAX_INPUT_LENGTH } from '../tts/generate'
import { isKnownFormat, isKnownModel, isKnownVoice } from '../tts/provider'
import type {
  BatchBaseInput,
  BatchDocumentError,
  BatchIssue,
  BatchParseResult,
  CandidateDisplay,
  ImportCandidate,
  ParseBatchRequest,
  ResolvedQueueInput,
} from './contract'

type UnknownRecord = Record<string, unknown>

const ROOT_FIELDS = new Set(['schema', 'version', 'defaults', 'items'])
const OVERRIDE_FIELDS = new Set(['voiceId', 'model', 'format', 'instructions', 'metadata'])
const ITEM_FIELDS = new Set([...OVERRIDE_FIELDS, 'text'])
const TEXT_METADATA_FIELDS = new Set([
  'title',
  'artist',
  'album',
  'genre',
  'comment',
  'recordedAt',
  'track',
  'notes',
  'encodedBy',
  'albumArtist',
  'composer',
])
const METADATA_FIELDS = new Set([
  ...TEXT_METADATA_FIELDS,
  'languages',
  'customText',
  'customUrl',
  'bpm',
  'rating',
])

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function blocking(
  code: BatchDocumentError['code'],
  scope: BatchDocumentError['scope'],
  path?: string,
): BatchParseResult {
  return { ok: false, error: { scope, code, ...(path ? { path } : {}) } }
}

function issue(code: BatchIssue['code'], path: string): BatchIssue {
  return { code, path }
}

function cloneBase(base: BatchBaseInput): BatchBaseInput {
  return {
    voiceId: base.voiceId,
    model: base.model,
    format: base.format,
    ...(base.instructions === undefined ? {} : { instructions: base.instructions }),
    metadata: structuredClone(base.metadata),
  }
}

function validateEntryArray(
  value: unknown,
  path: string,
  valueKey: 'value' | 'url',
): { valid: true; value: { description: string; value?: string; url?: string }[] } | { valid: false } {
  if (!Array.isArray(value)) return { valid: false }
  const normalized: { description: string; value?: string; url?: string }[] = []
  for (let index = 0; index < value.length; index++) {
    const entry = value[index]
    if (!isRecord(entry)) return { valid: false }
    if (Object.keys(entry).some((key) => key !== 'description' && key !== valueKey)) {
      return { valid: false }
    }
    const description = entry.description
    const entryValue = entry[valueKey]
    if (
      typeof description !== 'string' ||
      description.trim().length === 0 ||
      typeof entryValue !== 'string' ||
      entryValue.trim().length === 0
    ) {
      return { valid: false }
    }
    normalized.push({ description: description.trim(), [valueKey]: entryValue.trim() })
  }
  void path
  return { valid: true, value: normalized }
}

function applyMetadata(
  current: Metadata,
  raw: unknown,
  path: string,
): { metadata: Metadata; issues: BatchIssue[] } {
  let metadata = structuredClone(current)
  if (!isRecord(raw)) return { metadata, issues: [issue('invalidMetadata', path)] }

  const issues: BatchIssue[] = []
  for (const [key, value] of Object.entries(raw)) {
    const fieldPath = `${path}.${key}`
    if (!METADATA_FIELDS.has(key)) {
      issues.push(issue('unknownField', fieldPath))
      continue
    }
    if (value === null) {
      metadata = Object.fromEntries(Object.entries(metadata).filter(([field]) => field !== key)) as Metadata
      continue
    }
    if (TEXT_METADATA_FIELDS.has(key)) {
      if (typeof value !== 'string') issues.push(issue('invalidMetadata', fieldPath))
      else Object.assign(metadata, { [key]: value })
      continue
    }
    if (key === 'languages') {
      if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || entry.trim().length === 0)) {
        issues.push(issue('invalidMetadata', fieldPath))
      } else if (value.length === 0) {
        delete metadata.languages
      } else {
        metadata.languages = value.map((entry) => (entry as string).trim())
      }
      continue
    }
    if (key === 'customText' || key === 'customUrl') {
      const valueKey = key === 'customText' ? 'value' : 'url'
      const entries = validateEntryArray(value, fieldPath, valueKey)
      if (!entries.valid) issues.push(issue('invalidMetadata', fieldPath))
      else if (key === 'customText' && entries.value.length === 0) delete metadata.customText
      else if (key === 'customUrl' && entries.value.length === 0) delete metadata.customUrl
      else if (key === 'customText') metadata.customText = entries.value as NonNullable<Metadata['customText']>
      else metadata.customUrl = entries.value as NonNullable<Metadata['customUrl']>
      continue
    }
    if (key === 'bpm') {
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
        issues.push(issue('invalidMetadata', fieldPath))
      } else metadata.bpm = value
      continue
    }
    if (key === 'rating') {
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 5) {
        issues.push(issue('invalidMetadata', fieldPath))
      } else metadata.rating = value
    }
  }
  return { metadata, issues }
}

function applyOverrides(
  base: BatchBaseInput,
  raw: UnknownRecord,
  path: string,
): { value: BatchBaseInput; issues: BatchIssue[] } {
  const value = cloneBase(base)
  const issues: BatchIssue[] = []

  if ('voiceId' in raw) {
    if (typeof raw.voiceId !== 'string') issues.push(issue('wrongType', `${path}.voiceId`))
    else if (!isKnownVoice(raw.voiceId)) issues.push(issue('invalidVoice', `${path}.voiceId`))
    else value.voiceId = raw.voiceId
  }
  if ('model' in raw) {
    if (typeof raw.model !== 'string') issues.push(issue('wrongType', `${path}.model`))
    else if (!isKnownModel(raw.model)) issues.push(issue('invalidModel', `${path}.model`))
    else value.model = raw.model as Model
  }
  if ('format' in raw) {
    if (typeof raw.format !== 'string') issues.push(issue('wrongType', `${path}.format`))
    else if (!isKnownFormat(raw.format)) issues.push(issue('invalidFormat', `${path}.format`))
    else value.format = raw.format as Format
  }
  if ('instructions' in raw) {
    if (raw.instructions === null) delete value.instructions
    else if (typeof raw.instructions !== 'string') issues.push(issue('wrongType', `${path}.instructions`))
    else value.instructions = raw.instructions
  }
  if ('metadata' in raw) {
    const result = applyMetadata(value.metadata, raw.metadata, `${path}.metadata`)
    value.metadata = result.metadata
    issues.push(...result.issues)
  }
  return { value, issues }
}

function displayFor(raw: UnknownRecord, resolved: BatchBaseInput): CandidateDisplay {
  const excerpt = typeof raw.text === 'string' ? raw.text.trim().replace(/\s+/g, ' ').slice(0, 120) : ''
  return {
    excerpt,
    voiceId: typeof raw.voiceId === 'string' ? raw.voiceId : resolved.voiceId,
    model: typeof raw.model === 'string' ? raw.model : resolved.model,
    format: typeof raw.format === 'string' ? raw.format : resolved.format,
  }
}

/** Validate and normalize an unknown structured document into preview candidates. */
export function validateBatch(
  value: unknown,
  request: Pick<ParseBatchRequest, 'filename' | 'format' | 'base'>,
): BatchParseResult {
  if (!isRecord(value)) return blocking('invalidRoot', 'document')
  const unknownRoot = Object.keys(value).find((key) => !ROOT_FIELDS.has(key))
  if (unknownRoot) return blocking('unknownField', 'document', unknownRoot)
  if (value.schema !== 'echorecall.batch') return blocking('schema', 'document', 'schema')
  if (value.version !== 1) return blocking('version', 'document', 'version')
  if (!Array.isArray(value.items)) return blocking('invalidRoot', 'document', 'items')

  let inherited = cloneBase(request.base)
  if ('defaults' in value) {
    if (!isRecord(value.defaults)) return blocking('invalidDefaults', 'defaults', 'defaults')
    const unknownDefault = Object.keys(value.defaults).find((key) => !OVERRIDE_FIELDS.has(key))
    if (unknownDefault) return blocking('unknownField', 'defaults', `defaults.${unknownDefault}`)
    const resolvedDefaults = applyOverrides(inherited, value.defaults, 'defaults')
    if (resolvedDefaults.issues.length > 0) {
      const first = resolvedDefaults.issues[0]
      return blocking(first?.code === 'unknownField' ? 'unknownField' : 'invalidDefaults', 'defaults', first?.path)
    }
    inherited = resolvedDefaults.value
  }

  const candidates: ImportCandidate[] = value.items.map((raw, index) => {
    const location = { kind: 'item' as const, number: index + 1 }
    const path = `items[${index}]`
    if (!isRecord(raw)) {
      return {
        valid: false,
        location,
        display: { excerpt: '' },
        issues: [issue('wrongType', path)],
      }
    }

    const resolved = applyOverrides(inherited, raw, path)
    for (const key of Object.keys(raw)) {
      if (!ITEM_FIELDS.has(key)) resolved.issues.push(issue('unknownField', `${path}.${key}`))
    }
    if (!('text' in raw)) resolved.issues.push(issue('missingField', `${path}.text`))
    else if (typeof raw.text !== 'string') resolved.issues.push(issue('wrongType', `${path}.text`))
    else if (raw.text.trim().length === 0) resolved.issues.push(issue('emptyText', `${path}.text`))
    else if (raw.text.trim().length > MAX_INPUT_LENGTH) resolved.issues.push(issue('textTooLong', `${path}.text`))

    const display = displayFor(raw, resolved.value)
    if (resolved.issues.length > 0 || typeof raw.text !== 'string') {
      return { valid: false, location, display, issues: resolved.issues }
    }
    const input: ResolvedQueueInput = { ...resolved.value, text: raw.text.trim() }
    return { valid: true, location, display, issues: [], input }
  })

  const valid = candidates.filter((candidate) => candidate.valid).length
  const rejected = candidates.length - valid
  return {
    ok: true,
    preview: {
      filename: request.filename,
      format: request.format,
      candidates,
      counts: { valid, rejected, blank: 0 },
      canConfirm: valid > 0,
    },
  }
}
