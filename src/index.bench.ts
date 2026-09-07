import { fc } from '@fast-check/vitest'
import { test } from 'vitest'
import { unevals } from './testing/package.ts'

const values = fc.sample(fc.anything(), { seed: 42, numRuns: 5000 })

test(`uneval`, async ({ bench }) => {
  await bench.compare(
    ...Object.entries(unevals).map(([name, uneval]) =>
      bench(name, () => {
        for (const value of values) {
          uneval(value)
        }
      }),
    ),
    { warmupIterations: 50, iterations: 50 },
  )
})
