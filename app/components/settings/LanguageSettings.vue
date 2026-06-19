<script setup lang="ts">
import type { ComputedRef } from 'vue'

// Language selector (FR-039): English / Hungarian, default Hungarian. The chosen
// locale applies immediately via setLocale and is persisted in the `locale`
// cookie (restored on load by the i18n-locale plugin). Browser auto-detection
// stays off so Hungarian remains the deterministic default. Each language is
// labelled in its own name, which is never subject to UI translation.
const i18n = useI18n()
const { t, locale } = i18n
// @nuxtjs/i18n augments the vue-i18n composer with `setLocale`/`locales` at
// runtime, but that module augmentation doesn't bind in this project's type view
// (vue-i18n is not hoisted to the top level), so we annotate the extras we use.
const { setLocale, locales } = i18n as unknown as {
  setLocale: (code: string) => Promise<void>
  locales: ComputedRef<{ code: string; name?: string }[]>
}

const localeCookie = useCookie<string>('locale', {
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax',
  path: '/',
})

async function choose(code: string): Promise<void> {
  if (locale.value === code) return
  await setLocale(code)
  localeCookie.value = code
}
</script>

<template>
  <section aria-labelledby="language-heading" class="flex flex-col gap-2">
    <h2 id="language-heading" class="text-base font-semibold">
      {{ t('settings.language.title') }}
    </h2>
    <div role="group" :aria-label="t('settings.language.title')" class="flex flex-wrap gap-2">
      <UButton
        v-for="l in locales"
        :key="l.code"
        :data-test="`lang-${l.code}`"
        :color="locale === l.code ? 'primary' : 'neutral'"
        :variant="locale === l.code ? 'solid' : 'outline'"
        :aria-pressed="locale === l.code"
        @click="choose(l.code)"
      >
        {{ l.name }}
      </UButton>
    </div>
  </section>
</template>
