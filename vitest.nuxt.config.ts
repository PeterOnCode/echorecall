import { defineVitestConfig } from '@nuxt/test-utils/config'

// Component tests run inside the Nuxt runtime environment (auto-imports, app
// context, the '#core/client' alias) provided by @nuxt/test-utils. The plain
// framework-agnostic core/server tests use vitest.config.ts (node) instead, so
// the two suites never overlap (this config only picks up tests/component/**).
// Run with: pnpm test:component
export default defineVitestConfig({
  test: {
    environment: 'nuxt',
    include: ['tests/component/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
  },
})
