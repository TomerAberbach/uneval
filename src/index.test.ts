import { fc, test } from '@fast-check/vitest'
import { expect, expectTypeOf } from 'vitest'
import srcify from './index.ts'

test(`srcify works`, () => {
  expectTypeOf(srcify).toEqualTypeOf<(string?: string) => string>()
  expect(srcify()).toBe(`Hello World!`)
})

test.prop([fc.string()])(`srcify always works`, string => {
  expect(srcify(string)).toInclude(string)
})
