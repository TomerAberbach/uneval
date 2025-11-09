import { fc } from '@fast-check/vitest'

export const anythingArb = fc.oneof(
  {
    weight: 50,
    arbitrary: fc.anything({
      stringUnit: `binary`,
      withBigInt: true,
      withBoxedValues: true,
      withDate: true,
      withNullPrototype: true,
      withMap: true,
      withSet: true,
      withSparseArray: true,
      withTypedArray: true,
    }),
  },
  { weight: 1, arbitrary: fc.bigInt64Array() },
  { weight: 1, arbitrary: fc.bigUint64Array() },
  { weight: 1, arbitrary: fc.webUrl().map(url => new URL(url)) },
  { weight: 1, arbitrary: fc.webUrl().map(url => new URL(url).searchParams) },
  { weight: 1, arbitrary: fc.uint8Array().map(array => array.buffer) },
  { weight: 1, arbitrary: fc.uint8Array().map(array => Buffer.from(array)) },
)
