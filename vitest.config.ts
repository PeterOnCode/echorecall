import { defineConfig } from 'vitest/config'

// Core (framework-agnostic) + server integration tests run in plain Node — no
// Nuxt/Vite involvement (Constitution Principle IV). Component tests use a
// separate Nuxt environment config: vitest.nuxt.config.ts.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
  },
})
