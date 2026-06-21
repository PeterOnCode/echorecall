import type { Metadata } from '../shared/types'
import type { AppConfigRepository } from './app-config-repository'

/** The single app_config row holding the JSON-serialized default tag set (003). */
export const DEFAULT_TAGS_CONFIG_KEY = 'default_tags'

/**
 * Dependencies for default-tags resolution. Unlike the OpenAI key, tag defaults are
 * **non-secret**, so there is no app secret and nothing is encrypted — values are
 * stored as plain JSON in the shared {@link AppConfigRepository}.
 */
export interface DefaultTagsDeps {
  config: AppConfigRepository
}

/** Editable input from the Settings form. `languages` may arrive as a CSV string. */
export interface DefaultTagsInput {
  artist?: string
  album?: string
  genre?: string
  comment?: string
  languages?: string[] | string
}

/** Trim a scalar, returning `undefined` for missing/blank/whitespace-only. */
function cleanScalar(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

/** Normalize a languages value (array or CSV string) to a trimmed, de-duped list. */
function cleanLanguages(value: unknown): string[] | undefined {
  const raw = typeof value === 'string' ? value.split(',') : Array.isArray(value) ? value : []
  const seen = new Set<string>()
  for (const entry of raw) {
    if (typeof entry !== 'string') continue
    const code = entry.trim()
    if (code) seen.add(code)
  }
  return seen.size > 0 ? [...seen] : undefined
}

/**
 * Sanitize an arbitrary input (a form body or a parsed stored row) into the supported,
 * non-title {@link Metadata} subset. Only artist/album/genre/comment/languages survive;
 * Title and any unknown field are dropped; scalars are trimmed and blanks omitted;
 * languages are trimmed, de-duped (first-seen order), and dropped when empty. Applied on
 * both write and read, so a corrupt or hand-edited row can only ever yield a clean set.
 */
function sanitize(input: unknown): Metadata {
  const src = (input ?? {}) as Record<string, unknown>
  const tags: Metadata = {}
  const artist = cleanScalar(src.artist)
  const album = cleanScalar(src.album)
  const genre = cleanScalar(src.genre)
  const comment = cleanScalar(src.comment)
  if (artist) tags.artist = artist
  if (album) tags.album = album
  if (genre) tags.genre = genre
  if (comment) tags.comment = comment
  const languages = cleanLanguages(src.languages)
  if (languages) tags.languages = languages
  // Title is intentionally never read — every generation starts with a blank Title.
  return tags
}

/**
 * Read the saved default tag values (FR-009). Returns the sanitized Metadata subset,
 * or `{}` when no row exists or the stored value can't be parsed. Total — never throws —
 * so the Settings tab and the generation-form pre-fill can't 500 (FR-014).
 */
export function getDefaultTags(deps: DefaultTagsDeps): Metadata {
  const stored = deps.config.get(DEFAULT_TAGS_CONFIG_KEY)
  if (!stored) return {}
  try {
    return sanitize(JSON.parse(stored))
  } catch {
    return {}
  }
}

/**
 * Save (replace) the default tag values, sanitized and JSON-serialized. A fully empty
 * sanitized set deletes the row instead (save-all-blank ≡ clear, FR-011). Returns the
 * sanitized Metadata actually stored (`{}` when cleared). Title is never persisted,
 * regardless of input (FR-006).
 */
export function setDefaultTags(deps: DefaultTagsDeps, input: DefaultTagsInput): Metadata {
  const tags = sanitize(input)
  if (Object.keys(tags).length === 0) {
    deps.config.delete(DEFAULT_TAGS_CONFIG_KEY)
    return {}
  }
  deps.config.set(DEFAULT_TAGS_CONFIG_KEY, JSON.stringify(tags))
  return tags
}

/** Clear the saved defaults (FR-008/010); new generations start blank. Idempotent. */
export function clearDefaultTags(deps: DefaultTagsDeps): Metadata {
  deps.config.delete(DEFAULT_TAGS_CONFIG_KEY)
  return {}
}
