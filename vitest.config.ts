import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: `jsdom`,
    setupFiles: [`vitest.setup.ts`],
    testTimeout: 25_000,
    coverage: {
      include: [`src`],
    },
  },
})
