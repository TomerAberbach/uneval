/* eslint-disable no-eval */

import { fc } from '@fast-check/vitest'
import { bench, describe } from 'vitest'
import { unevals } from './package.ts'

describe.each([
  [`booleans`, fc.boolean()],
  [`integers`, fc.integer()],
  [`numbers`, fc.double()],
  [`strings`, fc.string()],
  [`objects`, fc.object()],
])(`%s`, (_, arb: fc.Arbitrary<unknown>) => {
  const values = fc.sample(arb, { seed: 42, numRuns: 5000 })

  for (const [name, uneval] of Object.entries(unevals)) {
    bench(name, () => {
      for (const value of values) {
        ;(0, eval)(`(${uneval(value)})`)
      }
    })
  }
})
