/** A selectable speaking voice offered by the TTS provider. */
export interface Voice {
  id: string
  label: string
}

/** TTS model identifiers. Instructions are honoured only by `gpt-4o-mini-tts`. */
export type Model = 'tts-1' | 'tts-1-hd' | 'gpt-4o-mini-tts'

/** Output audio formats offered by the provider. */
export type Format = 'mp3' | 'wav' | 'flac' | 'opus' | 'aac' | 'pcm'

/** Static catalog entry describing a format: its extension and tagging capability. */
export interface FormatInfo {
  id: Format
  /** File extension without the dot, e.g. `mp3`. */
  ext: string
  /** Which tagging path applies: ID3v2.4 (mp3/wav), Vorbis comments (flac/opus), or none (aac/pcm). */
  taggable: 'id3' | 'vorbis' | 'none'
}

/** A description-keyed custom free-text tag entry (ID3 TXXX). */
export interface CustomTextEntry {
  description: string
  value: string
}

/** A description-keyed custom URL tag entry (ID3 WXXX; ID3-only). */
export interface CustomUrlEntry {
  description: string
  url: string
}

/**
 * The full, standards-oriented tag set embedded into generated files and
 * persisted alongside a {@link Generation}. Saving replaces the whole set
 * (clearing a field removes it). All fields are optional; an empty set is `{}`.
 */
export interface Metadata {
  title?: string
  artist?: string
  album?: string
  genre?: string
  comment?: string
  /** Full timestamp OR year-only. */
  recordedAt?: string
  /** `n` or `n/total`. */
  track?: string
  /** ISO 639-2 codes; multi-value (ID3 TLAN). */
  languages?: string[]
  customText?: CustomTextEntry[]
  customUrl?: CustomUrlEntry[]
}

/**
 * A persisted text-to-speech library entry. Filename (via `path`) and `metadata`
 * are mutable; `text`, audio bytes, `voiceId`, `model`, `format`, `speed` and
 * `createdAt` are immutable after creation.
 */
export interface Generation {
  id: string
  text: string
  voiceId: string
  /** `null` on legacy rows predating model selection (treated as the default). */
  model: Model | null
  format: Format
  /** `null` on legacy rows (treated as 1.0). */
  speed: number | null
  /** ISO 8601 UTC timestamp. */
  createdAt: string
  /** Stored audio path relative to the data dir, e.g. `audio/2026/06/17/<slug>.mp3`. Authoritative locator. */
  path: string
  /** Embedded tag set; `{}` when none. */
  metadata: Metadata
}

/** User-supplied input for a new generation. */
export interface GenerationInput {
  text: string
  voiceId: string
}

/**
 * An ephemeral, per-session batch queue row (never persisted). `speed` is NOT
 * here — it is a single form-level value applied to every row.
 */
export interface ListItem {
  clientId: string
  text: string
  voiceId: string
  model: Model
  format: Format
  /** Retained across model changes; sent only for `gpt-4o-mini-tts`. */
  instructions?: string
  metadata: Metadata
}

/** Composable server-side library query (search + filter + sort + pagination). */
export interface LibraryQuery {
  /** Free-text LIKE over title, source text, tags, and filename. */
  q?: string
  voiceId?: string
  format?: Format
  /** Inclusive `createdAt` range bounds (ISO 8601). */
  from?: string
  to?: string
  sort?: 'createdAt' | 'title' | 'voice' | 'format'
  order?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}
