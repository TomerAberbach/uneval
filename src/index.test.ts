import { test } from '@fast-check/vitest'
import { expect } from 'vitest'
import { anythingArb } from './arbs.ts'
import srcify from './index.ts'

test.prop([anythingArb], {
  numRuns: 100_000,
  examples: [
    undefined,
    null,
    false,
    true,
    -0,
    Number.NaN,
    -Infinity,
    Infinity,
    /abc/u,
    // eslint-disable-next-line require-unicode-regexp
    /def/,
  ].map(value => [value]),
})(`srcify works`, value => {
  const source = srcify(value)

  // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call, no-new-func
  const roundtrippedValue = new Function(`return (${source})`)() as unknown
  expect(roundtrippedValue, source).toStrictEqual(value)
})
