/* eslint-disable no-eval */

import { fc } from '@fast-check/vitest'
import { bench } from 'vitest'
import { unevals } from './package.ts'

const values = fc.sample(fc.anything(), { seed: 42, numRuns: 5000 })

for (const [name, uneval] of Object.entries(unevals)) {
  bench(
    name,
    () => {
      for (const value of values) {
        uneval(value)
      }
    },
    {
      warmupIterations: 50,
      iterations: 50,
    },
  )
}
