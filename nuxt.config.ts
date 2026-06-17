import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Single authoritative app version (FR-046), read from package.json at config time.
const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8'),
) as { version: string }

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devServer: {
    port: 3102,
  },
  // @nuxt/ui auto-registers @nuxt/icon, @nuxt/fonts and @nuxtjs/color-mode (default: system).
  modules: ['@nuxt/eslint', '@nuxt/test-utils/module', '@nuxt/ui', '@nuxtjs/i18n'],
  css: ['~/assets/css/main.css'],
  typescript: {
    strict: true,
  },
  // Server-only secrets / config. Override via env: NUXT_OPENAI_API_KEY, NUXT_DATA_DIR, NUXT_APP_SECRET
  runtimeConfig: {
    openaiApiKey: '',
    dataDir: '',
    // NUXT_APP_SECRET — enables encrypted in-app OpenAI key storage (US8); env key is used when unset.
    appSecret: '',
    public: {
      // Shown in the header; degrades gracefully if absent (FR-046).
      appVersion: version,
    },
  },
  i18n: {
    strategy: 'no_prefix',
    defaultLocale: 'hu',
    locales: [
      { code: 'en', name: 'English', file: 'en.json' },
      { code: 'hu', name: 'Magyar', file: 'hu.json' },
    ],
    // Hungarian is the deterministic default; user-choice persistence is wired in US7.
    detectBrowserLanguage: false,
  },
  alias: {
    '#core': fileURLToPath(new URL('./src/core', import.meta.url)),
  },
})
