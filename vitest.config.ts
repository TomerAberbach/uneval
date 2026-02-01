import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: `jsdom`,
    setupFiles: [`vitest.setup.ts`],
    testTimeout: 75_000,
    coverage: {
      include: [`src`],
      exclude: [`*.bench.ts`, `arbs.ts`],
    },
    chaiConfig: {
      truncateThreshold: Infinity,
    },
  },
})
