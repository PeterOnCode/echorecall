/** UTC `YYYY/MM/DD` directory derived from a creation date. */
export function datedDir(createdAt: Date): string {
  const yyyy = createdAt.getUTCFullYear().toString().padStart(4, '0')
  const mm = (createdAt.getUTCMonth() + 1).toString().padStart(2, '0')
  const dd = createdAt.getUTCDate().toString().padStart(2, '0')
  return `${yyyy}/${mm}/${dd}`
}

/**
 * Allocate a collision-safe filename (`<slug>.<ext>`, then `<slug>_2.<ext>`, …)
 * within a directory. `exists(name)` reports whether a candidate filename is
 * already taken; this never returns a name for which `exists` is true, so an
 * existing file is never overwritten.
 */
export function allocateFilename(
  slug: string,
  ext: string,
  exists: (name: string) => boolean,
): string {
  const base = `${slug}.${ext}`
  if (!exists(base)) return base
  for (let n = 2; ; n++) {
    const candidate = `${slug}_${n}.${ext}`
    if (!exists(candidate)) return candidate
  }
}
