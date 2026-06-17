import slugifyLib from '@sindresorhus/slugify'

/** Maximum slug length (characters), before any collision suffix. */
export const MAX_SLUG_LENGTH = 64

/**
 * Turn a title into a filesystem-safe slug: transliterated to ASCII, lowercased,
 * separators normalized to `-`, and capped at {@link MAX_SLUG_LENGTH} without a
 * trailing separator. Returns `''` when the title yields no usable characters
 * (caller falls back to a unique id).
 */
export function slugify(title: string): string {
  const slug = slugifyLib(title ?? '')
  if (slug.length <= MAX_SLUG_LENGTH) return slug
  // Truncate, then drop any separator the cut may have left dangling.
  return slug.slice(0, MAX_SLUG_LENGTH).replace(/-+$/, '')
}
