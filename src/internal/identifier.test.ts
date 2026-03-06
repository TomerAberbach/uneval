import { fc, test } from '@fast-check/vitest'
import { expect } from 'vitest'
import { generateIdentifier } from './identifier.ts'

test.prop(
  [
    fc.uniqueArray(fc.nat(), {
      minLength: 2,
      maxLength: 1000,
    }),
  ],
  { numRuns: 250_000 },
)(`generateIdentifier generates a unique identifier`, nats => {
  const identifiers = nats.map(generateIdentifier)

  expect(identifiers).toStrictEqual([...new Set(identifiers)])
})

test.prop([fc.nat()], { numRuns: 100_000 })(
  `generateIdentifier generates a valid identifier`,
  index => {
    const identifier = generateIdentifier(index)
    const expectedValue = 42

    // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call, no-new-func
    const value = new Function(
      `let ${identifier}=${expectedValue};return ${identifier}`,
    )() as unknown
    expect(value).toBe(expectedValue)
  },
)
