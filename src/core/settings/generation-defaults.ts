import type { Format, Model } from '../shared/types'
import { isKnownFormat, isKnownModel, isKnownVoice } from '../tts/provider'
import { normalizeSpeed } from '../tts/generate'
import type { AppConfigRepository } from './app-config-repository'

/** The single app_config row holding the JSON-serialized generation defaults (007 · US3). */
export const GENERATION_DEFAULTS_CONFIG_KEY = 'generation_defaults'

/**
 * Dependencies for generation-defaults resolution. Like the default tags (and unlike the
 * OpenAI key), these are **non-secret**, so nothing is encrypted — values are stored as
 * plain JSON in the shared {@link AppConfigRepository}, alongside `default_tags`.
 */
export interface GenerationDefaultsDeps {
  config: AppConfigRepository
}

/**
 * The configurable Voice/Model/Format/Speed defaults (FR-011). Every field is optional —
 * an unset field means "no configured default", so the editor falls through to its
 * built-in fallback (FR-012).
 */
export interface GenerationDefaults {
  voiceId?: string
  model?: Model
  format?: Format
  speed?: number
}

/** Editable input from the Settings form (loosely typed; sanitized on write). */
export interface GenerationDefaultsInput {
  voiceId?: string
  model?: string
  format?: string
  speed?: number
}

/**
 * Sanitize an arbitrary input (a form body or a parsed stored row) into the supported,
 * catalog-valid {@link GenerationDefaults} subset: `voiceId`/`model`/`format` survive only
 * when they are known catalog values; `speed` survives only when it is a finite number
 * (then clamped to the provider range). Unknown/invalid fields are dropped. Applied on both
 * write and read, so a corrupt or hand-edited row can only ever yield a clean set.
 */
function sanitize(input: unknown): GenerationDefaults {
  const src = (input ?? {}) as Record<string, unknown>
  const out: GenerationDefaults = {}
  if (typeof src.voiceId === 'string' && isKnownVoice(src.voiceId)) out.voiceId = src.voiceId
  if (typeof src.model === 'string' && isKnownModel(src.model)) out.model = src.model as Model
  if (typeof src.format === 'string' && isKnownFormat(src.format)) out.format = src.format as Format
  if (typeof src.speed === 'number' && Number.isFinite(src.speed)) out.speed = normalizeSpeed(src.speed)
  return out
}

/**
 * Read the saved generation defaults (FR-011). Returns the sanitized subset, or `{}` when
 * no row exists or the stored value can't be parsed. Total — never throws — so the Settings
 * tab and the generation-form resolution can't 500.
 */
export function getGenerationDefaults(deps: GenerationDefaultsDeps): GenerationDefaults {
  const stored = deps.config.get(GENERATION_DEFAULTS_CONFIG_KEY)
  if (!stored) return {}
  try {
    return sanitize(JSON.parse(stored))
  } catch {
    return {}
  }
}

/**
 * Save (replace) the generation defaults, sanitized and JSON-serialized. A fully empty
 * sanitized set deletes the row instead (save-all-blank ≡ clear). Returns the sanitized
 * defaults actually stored (`{}` when cleared).
 */
export function setGenerationDefaults(
  deps: GenerationDefaultsDeps,
  input: GenerationDefaultsInput,
): GenerationDefaults {
  const defaults = sanitize(input)
  if (Object.keys(defaults).length === 0) {
    deps.config.delete(GENERATION_DEFAULTS_CONFIG_KEY)
    return {}
  }
  deps.config.set(GENERATION_DEFAULTS_CONFIG_KEY, JSON.stringify(defaults))
  return defaults
}

/** Clear the saved generation defaults; the editor then falls back to built-ins. Idempotent. */
export function clearGenerationDefaults(deps: GenerationDefaultsDeps): GenerationDefaults {
  deps.config.delete(GENERATION_DEFAULTS_CONFIG_KEY)
  return {}
}
