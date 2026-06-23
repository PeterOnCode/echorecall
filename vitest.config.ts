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
  //
  // The 005 client composables under app/ (e.g. useQueue/useQueueFile) import the
  // browser-safe '#core/client' subset for value imports (MAX_INPUT_LENGTH,
  // isKnownModel/Format). Their pure logic is unit/integration-tested in this node
  // env, so resolve that alias here too (exact match — never shadows '#core').
  resolve: {
    alias: [
      {
        find: /^#core\/client$/,
        replacement: fileURLToPath(new URL('./src/core/client.ts', import.meta.url)),
      },
      {
        find: /^#core$/,
        replacement: fileURLToPath(new URL('./src/core/index.ts', import.meta.url)),
      },
    ],
  },
})
