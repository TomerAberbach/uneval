/* eslint-disable no-eval */

import { fc } from '@fast-check/vitest'
import * as devalue from 'devalue'
import jsesc from 'jsesc'
import serializeJavaScript from 'serialize-javascript'
import toSource from 'tosource'
import { bench, describe } from 'vitest'
import uneval from './index.ts'

describe.each([
  [`booleans`, fc.boolean()],
  [`integers`, fc.integer()],
  [`numbers`, fc.double()],
  [`bigints`, fc.bigInt()],
  [`strings`, fc.string()],
  [`objects`, fc.object()],
])(`%s`, (_, arb: fc.Arbitrary<unknown>) => {
  const values = fc.sample(arb, { seed: 42, numRuns: 5000 })

  bench(`uneval`, () => {
    for (const value of values) {
      ;(0, eval)(`(${uneval(value)})`)
    }
  })

  bench(`devalue`, () => {
    for (const value of values) {
      ;(0, eval)(`(${devalue.uneval(value)})`)
    }
  })

  bench(`jsesc`, () => {
    for (const value of values) {
      ;(0, eval)(`(${jsesc(value, { wrap: true })})`)
    }
  })

  bench(`serialize-javascript`, () => {
    for (const value of values) {
      ;(0, eval)(`(${serializeJavaScript(value)})`)
    }
  })

  bench(`tosource`, () => {
    for (const value of values) {
      ;(0, eval)(`(${toSource(value)})`)
    }
  })
})
