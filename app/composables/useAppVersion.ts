/**
 * The running application version (FR-046), read from the single authoritative
 * source — `runtimeConfig.public.appVersion`, which `nuxt.config.ts` populates
 * from `package.json` at config time (and which `bumpp` updates on release).
 *
 * Returns `null` when the version cannot be determined (missing or empty) so the
 * header can omit it and still load. It never performs a remote version check.
 */
export function useAppVersion(): string | null {
  // Nuxt types this computed public value broadly, so narrow it ourselves: any
  // non-string or empty value is treated as "unavailable" and degrades to null.
  const version = useRuntimeConfig().public.appVersion
  return typeof version === 'string' && version.length > 0 ? version : null
}
