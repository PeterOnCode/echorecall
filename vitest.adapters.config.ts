import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// GATED adapter suite (Constitution II / research §1): exercises the real
// taglib-wasm tagger (and, later, an optional live OpenAI provider) in plain
// Node. Kept OUT of the default suite (vitest.config.ts globs only unit +
// integration) so `pnpm test` stays network-/binary-free; run explicitly with
// `pnpm test:adapters`. The WASM tagger runs in-process — no system binary.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/adapters/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    // taglib-wasm loads its WASM module once per file; give it generous headroom.
    testTimeout: 30_000,
  },
  resolve: {
    alias: [
      {
        find: /^#core$/,
        replacement: fileURLToPath(new URL('./src/core/index.ts', import.meta.url)),
      },
    ],
  },
})
