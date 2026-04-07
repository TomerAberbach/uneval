import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: `jsdom`,
    setupFiles: [`vitest.setup.ts`],
    testTimeout: 100_000,
    coverage: {
      include: [`src`],
      exclude: [`*.bench.ts`, `src/testing`],
    },
    chaiConfig: {
      truncateThreshold: Infinity,
    },
  },
})
