import type { ComputedRef } from 'vue'

// Restore the user's persisted locale (US7, FR-039) on app init. Browser
// auto-detection is intentionally off (Hungarian is the deterministic default),
// so we re-apply the explicit choice saved by LanguageSettings in the `locale`
// cookie. Runs universally so SSR renders in the chosen language (no flash).
export default defineNuxtPlugin(async (nuxtApp) => {
  const saved = useCookie<string | null>('locale').value
  if (!saved) return

  // The i18n composer's runtime extras (`locale`/`locales`/`setLocale`) aren't
  // visible to the type-checker here (see LanguageSettings.vue), so annotate
  // exactly what we touch.
  const i18n = nuxtApp.$i18n as unknown as {
    locale: { value: string }
    locales: ComputedRef<{ code: string }[]>
    setLocale: (code: string) => Promise<void>
  }
  if (i18n.locale.value !== saved && i18n.locales.value.some((l) => l.code === saved)) {
    await i18n.setLocale(saved)
  }
})
