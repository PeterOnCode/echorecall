import { fileURLToPath } from 'node:url'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devServer: {
    port: 3102,
  },
  modules: ['@nuxt/eslint', '@nuxt/test-utils/module'],
  typescript: {
    strict: true,
  },
  // Server-only secrets / config. Override via env: NUXT_OPENAI_API_KEY, NUXT_DATA_DIR
  runtimeConfig: {
    openaiApiKey: '',
    dataDir: '',
  },
  alias: {
    '#core': fileURLToPath(new URL('./src/core', import.meta.url)),
  },
})
