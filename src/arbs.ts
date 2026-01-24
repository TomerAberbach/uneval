import { fc } from '@fast-check/vitest'

const circularSymbol = Symbol(`circular`)
const depthIdentifier = fc.createDepthIdentifier()
const circularArb = fc
  .array(
    fc.letrec(tie => ({
      object: fc.dictionary(fc.string(), tie(`innerValue`), {
        depthIdentifier,
        maxKeys: 5,
      }),
      array: fc.array(tie(`innerValue`), { depthIdentifier, maxLength: 5 }),
      map: fc.map(tie(`innerValue`), tie(`innerValue`), {
        depthIdentifier,
        maxKeys: 5,
      }),
      innerValue: fc.oneof(
        { depthIdentifier },
        fc.record({ [circularSymbol]: fc.nat({ max: 5 }) }),
        tie(`object`),
        tie(`array`),
        tie(`map`),
      ),
      value: fc.oneof(
        { depthIdentifier },
        tie(`object`),
        tie(`array`),
        tie(`map`),
      ),
    })).value,
    { minLength: 1, maxLength: 5 },
  )
  .filter(values => {
    const hasCircularSymbolLoop = (value: unknown): boolean => {
      if (value === null || typeof value !== `object`) {
        return false
      }

      if (circularSymbol in value) {
        const visited = new Set()

        let currentValue: unknown = value
        while (
          currentValue !== null &&
          typeof currentValue === `object` &&
          circularSymbol in currentValue
        ) {
          visited.add(currentValue)

          currentValue =
            values[
              (currentValue as { [circularSymbol]: number })[circularSymbol]
            ]
          if (visited.has(currentValue)) {
            // This has an unresolvable circularSymbol loop.
            return true
          }
        }
        return false
      }

      if (Array.isArray(value)) {
        return value.some(hasCircularSymbolLoop)
      } else if (value instanceof Map) {
        for (const [key, item] of value.entries()) {
          if (hasCircularSymbolLoop(key) || hasCircularSymbolLoop(item)) {
            return true
          }
        }
        return false
      } else {
        return Object.values(value).some(hasCircularSymbolLoop)
      }
    }

    return !values.some(hasCircularSymbolLoop)
  })
  .map(values => {
    const replaced = new Map<object, object>()
    const replace = (value: unknown): unknown => {
      if (value === null || typeof value !== `object`) {
        return value
      }

      if (replaced.has(value)) {
        return replaced.get(value)
      }

      if (circularSymbol in value) {
        return replace(
          values[(value as { [circularSymbol]: number })[circularSymbol]],
        )
      }

      if (Array.isArray(value)) {
        const newValue = [...(value as unknown[])]
        replaced.set(value, newValue)
        for (const [index, item] of newValue.entries()) {
          newValue[index] = replace(item)
        }
        return newValue
      } else if (value instanceof Map) {
        const newValue = new Map()
        replaced.set(value, newValue)
        for (const [key, item] of value.entries()) {
          newValue.set(replace(key), replace(item))
        }
        return newValue
      } else {
        const newValue = { ...value }
        replaced.set(value, newValue)
        for (const [key, item] of Object.entries(newValue)) {
          ;(newValue as Record<PropertyKey, unknown>)[key] = replace(item)
        }
        return newValue
      }
    }

    return replace(values[0])
  })

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
  { weight: 5, arbitrary: circularArb },
  { weight: 1, arbitrary: fc.bigInt64Array() },
  { weight: 1, arbitrary: fc.bigUint64Array() },
  { weight: 1, arbitrary: fc.webUrl().map(url => new URL(url)) },
  { weight: 1, arbitrary: fc.webUrl().map(url => new URL(url).searchParams) },
)
