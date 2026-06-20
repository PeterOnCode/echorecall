import type { Metadata } from '../shared/types'

/**
 * Read deployment-provided default tag values (US10 / FR-048) from the environment
 * into a {@link Metadata} object used to pre-fill the generation form and new list
 * items. Only non-title fields are defaultable — Title is **never** defaulted, even
 * if `NUXT_DEFAULT_TAG_TITLE` is set. Scalar values are trimmed and blank/whitespace
 * ones are omitted; `LANGUAGES` is a comma-separated list (blank entries dropped).
 * Invalid or missing config simply yields an empty object — the reader never throws,
 * so the route never 500s.
 */
export function readDefaultTags(env: Record<string, string | undefined>): Metadata {
  const tags: Metadata = {}

  const artist = clean(env.NUXT_DEFAULT_TAG_ARTIST)
  const album = clean(env.NUXT_DEFAULT_TAG_ALBUM)
  const genre = clean(env.NUXT_DEFAULT_TAG_GENRE)
  const comment = clean(env.NUXT_DEFAULT_TAG_COMMENT)
  if (artist) tags.artist = artist
  if (album) tags.album = album
  if (genre) tags.genre = genre
  if (comment) tags.comment = comment

  const languages = (env.NUXT_DEFAULT_TAG_LANGUAGES ?? '')
    .split(',')
    .map((code) => code.trim())
    .filter((code) => code.length > 0)
  if (languages.length > 0) tags.languages = languages

  // Title is intentionally never read: it must stay blank for the user (FR-048).
  return tags
}

/** Trim a raw env value, returning `undefined` for missing/blank/whitespace-only. */
function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}
