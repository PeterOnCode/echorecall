import { fileURLToPath } from 'node:url'
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
  // Integration tests import the server's error mapper (server/utils/errors.ts),
  // which references the core through the '#core' alias. The Nuxt-provided alias
  // only exists in the Nuxt env config, so resolve it here too. Scoped to an
  // exact match so it never shadows '#core/client'.
  resolve: {
    alias: [
      {
        find: /^#core$/,
        replacement: fileURLToPath(new URL('./src/core/index.ts', import.meta.url)),
      },
    ],
  },
})
