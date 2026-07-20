import type { Format, Metadata, Model } from '../shared/types'

/** A metadata override may replace or explicitly clear any supported field. */
export type MetadataPatch = {
  [Field in keyof Metadata]?: Metadata[Field] | null
}

/** Shared structured-file values applied before an item's own overrides. */
export interface BatchDefaults {
  voiceId?: string
  model?: Model
  format?: Format
  instructions?: string | null
  metadata?: MetadataPatch
}

/** One ordered structured-file candidate. */
export interface BatchItem extends BatchDefaults {
  text: string
}

/** Canonical structured batch document after its raw `unknown` value is validated. */
export interface BatchDocumentV1 {
  schema: 'echorecall.batch'
  version: 1
  defaults?: BatchDefaults
  items: BatchItem[]
}

/** Generate values frozen when the user selects a batch file. */
export interface BatchBaseInput {
  voiceId: string
  model: Model
  format: Format
  instructions?: string
  metadata: Metadata
}

/** Fully normalized input carried only by a valid preview candidate. */
export interface ResolvedQueueInput extends BatchBaseInput {
  text: string
}

/** A candidate's one-based position in its original source. */
export type BatchSourceLocation =
  | { kind: 'item'; number: number }
  | { kind: 'line'; number: number }

/** Stable, localization-independent validation issue codes for one candidate. */
export type BatchIssueCode =
  | 'missingField'
  | 'unknownField'
  | 'wrongType'
  | 'emptyText'
  | 'textTooLong'
  | 'invalidVoice'
  | 'invalidModel'
  | 'invalidFormat'
  | 'invalidMetadata'

export interface BatchIssue {
  code: BatchIssueCode
  path: string
  details?: Record<string, string | number>
}

/** Best-effort values shown even when a candidate cannot be normalized. */
export interface CandidateDisplay {
  excerpt: string
  voiceId?: string
  model?: string
  format?: string
}

export interface ValidImportCandidate {
  valid: true
  location: BatchSourceLocation
  display: CandidateDisplay
  issues: []
  input: ResolvedQueueInput
}

export interface InvalidImportCandidate {
  valid: false
  location: BatchSourceLocation
  display: CandidateDisplay
  issues: BatchIssue[]
  /** Invalid candidates cannot cross the normalized queue-input boundary. */
  input?: never
}

/** A preview row discriminated by whether it owns normalized queue input. */
export type ImportCandidate = ValidImportCandidate | InvalidImportCandidate

/** Stable blocking error codes produced before queue confirmation is possible. */
export type BatchDocumentErrorCode =
  | 'unsupportedExtension'
  | 'tooLarge'
  | 'readFailed'
  | 'malformed'
  | 'duplicateKey'
  | 'duplicateProperty'
  | 'customTag'
  | 'anchor'
  | 'alias'
  | 'unknownField'
  | 'schema'
  | 'version'
  | 'invalidRoot'
  | 'invalidDefaults'

export type BatchDocumentErrorScope = 'file' | 'document' | 'defaults'

export interface BatchDocumentError {
  scope: BatchDocumentErrorScope
  code: BatchDocumentErrorCode
  path?: string
  line?: number
  column?: number
  details?: Record<string, string | number>
}

export type BatchFormat = 'text' | 'yaml' | 'json'

export interface BatchPreviewCounts {
  valid: number
  rejected: number
  blank: number
}

export interface BatchPreview {
  filename: string
  format: BatchFormat
  candidates: ImportCandidate[]
  counts: BatchPreviewCounts
  canConfirm: boolean
}

/** Framework-independent request supplied by file or CLI adapters. */
export interface ParseBatchRequest {
  content: string
  filename: string
  format: BatchFormat
  base: BatchBaseInput
}

/** Blocking errors and confirmable previews are mutually exclusive. */
export type BatchParseResult =
  | { ok: true; preview: BatchPreview }
  | { ok: false; error: BatchDocumentError }
