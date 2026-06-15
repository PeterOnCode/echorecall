/** A selectable speaking voice offered by the TTS provider. */
export interface Voice {
  id: string
  label: string
}

/** A persisted text-to-speech library entry (metadata only). */
export interface Generation {
  id: string
  text: string
  voiceId: string
  /** ISO 8601 UTC timestamp. */
  createdAt: string
}

/** User-supplied input for a new generation. */
export interface GenerationInput {
  text: string
  voiceId: string
}
