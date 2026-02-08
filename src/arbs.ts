import { fc } from '@fast-check/vitest'

const urlArb = fc.webUrl().map(url => new URL(url))
const urlSearchParamsArb = urlArb.map(url => url.searchParams)

const nonDetachedArrayBufferArb = fc
  .record({ array: fc.int8Array(), maxByteLength: fc.nat({ max: 50 }) })
  .map(({ array, maxByteLength }) => {
    const arrayBuffer = new ArrayBuffer(array.length, {
      maxByteLength: maxByteLength < array.length ? undefined : maxByteLength,
    })
    const view = new DataView(arrayBuffer)
    for (const [index, value] of array.entries()) {
      view.setInt8(index, value)
    }
    return arrayBuffer
  })
const arrayBufferArb = fc
  .record({ arrayBuffer: nonDetachedArrayBufferArb, detached: fc.boolean() })
  .map(({ arrayBuffer, detached }) => {
    if (detached) {
      arrayBuffer.transfer()
    }
    return arrayBuffer
  })

const typedArrayArb = fc
  .record({
    TypedArray: fc.constantFrom(
      Int8Array,
      Uint8Array,
      Uint8ClampedArray,
      Int16Array,
      Uint16Array,
      Int32Array,
      Uint32Array,
      Float32Array,
      Float64Array,
      BigInt64Array,
      BigUint64Array,
    ),
    buffer: nonDetachedArrayBufferArb,
    range: fc.tuple(fc.nat(), fc.nat()),
  })
  .map(({ TypedArray, buffer, range: [start, end] }) => {
    const maxElements = Math.floor(
      buffer.byteLength / TypedArray.BYTES_PER_ELEMENT,
    )
    start %= maxElements + 1
    end %= maxElements + 1
    if (start > end) {
      ;[start, end] = [end, start]
    }

    return new TypedArray(
      buffer,
      start * TypedArray.BYTES_PER_ELEMENT,
      end - start,
    )
  })

const bufferArb = fc
  .record({
    arrayBuffer: nonDetachedArrayBufferArb,
    range: fc.tuple(fc.nat(), fc.nat()),
  })
  .map(({ arrayBuffer, range: [start, end] }) => {
    start %= arrayBuffer.byteLength + 1
    end %= arrayBuffer.byteLength + 1
    if (start > end) {
      ;[start, end] = [end, start]
    }

    return Buffer.from(arrayBuffer, start, end - start)
  })

const circularSymbol = Symbol(`circular`)
const depthIdentifier = fc.createDepthIdentifier()
export const anythingArb = fc
  .array(
    fc.letrec(tie => ({
      object: fc.dictionary(fc.string(), tie(`innerValue`), {
        depthIdentifier,
        maxKeys: 5,
      }),
      array: fc.sparseArray(tie(`innerValue`), {
        depthIdentifier,
        maxLength: 5,
      }),
      map: fc.map(tie(`innerValue`), tie(`innerValue`), {
        depthIdentifier,
        maxKeys: 5,
      }),
      set: fc.set(tie(`innerValue`), { depthIdentifier, maxLength: 5 }),
      innerValue: fc.oneof(
        { depthIdentifier },
        fc.record({ [circularSymbol]: fc.nat({ max: 5 }) }),
        tie(`value`),
      ),
      value: fc.oneof(
        { depthIdentifier },
        fc.boolean(),
        fc.float(),
        fc.double(),
        fc.bigInt(),
        fc.date(),
        fc.string({ unit: `binary` }),
        urlArb,
        urlSearchParamsArb,
        typedArrayArb,
        arrayBufferArb,
        bufferArb,
        tie(`object`),
        tie(`array`),
        tie(`map`),
        tie(`set`),
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
      } else if (value instanceof Set) {
        for (const item of value) {
          if (hasCircularSymbolLoop(item)) {
            return true
          }
        }
        return false
      } else if (isPlainObject(value)) {
        return Object.values(value).some(hasCircularSymbolLoop)
      } else {
        return false
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
      } else if (value instanceof Set) {
        const newValue = new Set()
        replaced.set(value, newValue)
        for (const item of value) {
          newValue.add(replace(item))
        }
        return newValue
      } else if (isPlainObject(value)) {
        const newValue = { ...value }
        replaced.set(value, newValue)
        for (const [key, item] of Object.entries(newValue)) {
          ;(newValue as Record<PropertyKey, unknown>)[key] = replace(item)
        }
        return newValue
      } else {
        replaced.set(value, value)
        return value
      }
    }

    return replace(values[0])
  })

const isPlainObject = (object: object): boolean => {
  const prototype = Object.getPrototypeOf(object) as unknown
  return prototype === null || prototype === Object.prototype
}
