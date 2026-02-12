import { fc } from '@fast-check/vitest'

const urlArb = fc.webUrl().map(url => new URL(url))
const urlSearchParamsArb = urlArb.map(url => url.searchParams)

const temporalInstantArb = fc
  .bigInt({
    min: -8_640_000_000_000_000_000_000n,
    max: 8_640_000_000_000_000_000_000n,
  })
  .map(epochNs => new Temporal.Instant(epochNs))
const temporalPlainDateArb = fc
  .record({
    year: fc.integer({ min: -271_820, max: 275_759 }),
    month: fc.integer({ min: 1, max: 12 }),
    day: fc.integer({ min: 1, max: 28 }),
  })
  .map(({ year, month, day }) => new Temporal.PlainDate(year, month, day))
const temporalPlainTimeArb = fc
  .record({
    hour: fc.integer({ min: 0, max: 23 }),
    minute: fc.integer({ min: 0, max: 59 }),
    second: fc.integer({ min: 0, max: 59 }),
    millisecond: fc.integer({ min: 0, max: 999 }),
    microsecond: fc.integer({ min: 0, max: 999 }),
    nanosecond: fc.integer({ min: 0, max: 999 }),
  })
  .map(
    ({ hour, minute, second, millisecond, microsecond, nanosecond }) =>
      new Temporal.PlainTime(
        hour,
        minute,
        second,
        millisecond,
        microsecond,
        nanosecond,
      ),
  )
const temporalPlainDateTimeArb = fc
  .record({ date: temporalPlainDateArb, time: temporalPlainTimeArb })
  .map(
    ({ date, time }) =>
      new Temporal.PlainDateTime(
        date.year,
        date.month,
        date.day,
        time.hour,
        time.minute,
        time.second,
        time.millisecond,
        time.microsecond,
        time.nanosecond,
      ),
  )
const temporalPlainYearMonthArb = fc
  .record({
    year: fc.integer({ min: -271_820, max: 275_759 }),
    month: fc.integer({ min: 1, max: 12 }),
  })
  .map(({ year, month }) => new Temporal.PlainYearMonth(year, month))
const temporalPlainMonthDayArb = fc
  .record({
    month: fc.integer({ min: 1, max: 12 }),
    day: fc.integer({ min: 1, max: 28 }),
  })
  .map(({ month, day }) => new Temporal.PlainMonthDay(month, day))
const temporalZonedDateTimeArb = fc
  .record({
    epochNs: fc.bigInt({
      min: -8_640_000_000_000_000_000_000n,
      max: 8_640_000_000_000_000_000_000n,
    }),
    timeZone: fc.constantFrom(
      `UTC`,
      `America/New_York`,
      `America/Los_Angeles`,
      `Europe/London`,
      `Europe/Paris`,
      `Asia/Tokyo`,
      `Australia/Sydney`,
    ),
  })
  .map(({ epochNs, timeZone }) => new Temporal.ZonedDateTime(epochNs, timeZone))
const temporalDurationArb = fc
  .record({
    years: fc.integer({ min: 0, max: 100 }),
    months: fc.integer({ min: 0, max: 100 }),
    weeks: fc.integer({ min: 0, max: 100 }),
    days: fc.integer({ min: 0, max: 100 }),
    hours: fc.integer({ min: 0, max: 100 }),
    minutes: fc.integer({ min: 0, max: 100 }),
    seconds: fc.integer({ min: 0, max: 100 }),
    milliseconds: fc.integer({ min: 0, max: 999 }),
    microseconds: fc.integer({ min: 0, max: 999 }),
    nanoseconds: fc.integer({ min: 0, max: 999 }),
  })
  .map(
    ({
      years,
      months,
      weeks,
      days,
      hours,
      minutes,
      seconds,
      milliseconds,
      microseconds,
      nanoseconds,
    }) =>
      new Temporal.Duration(
        years,
        months,
        weeks,
        days,
        hours,
        minutes,
        seconds,
        milliseconds,
        microseconds,
        nanoseconds,
      ),
  )
const temporalArb = fc.oneof(
  temporalInstantArb,
  temporalPlainDateArb,
  temporalPlainTimeArb,
  temporalPlainDateTimeArb,
  temporalPlainYearMonthArb,
  temporalPlainMonthDayArb,
  temporalZonedDateTimeArb,
  temporalDurationArb,
)

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
      object: fc
        .dictionary(
          fc.string(),
          fc.record(
            {
              configurable: fc.boolean(),
              enumerable: fc.boolean(),
              writable: fc.boolean(),
              value: tie(`innerValue`),
            },
            { requiredKeys: [] },
          ),
          { depthIdentifier, maxKeys: 5 },
        )
        .map((descriptors: PropertyDescriptorMap) =>
          Object.defineProperties(
            Object.setPrototypeOf(
              {},
              // Take the prototype from `descriptors` to allow the possibility
              // of `null` prototype from the arbitrary.
              Object.getPrototypeOf(descriptors) as object | null,
            ) as unknown,
            descriptors,
          ),
        ),
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
        ...(typeof Temporal === `undefined` ? [] : [temporalArb]),
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
        return Reflect.ownKeys(value).some(key =>
          hasCircularSymbolLoop((value as Record<PropertyKey, unknown>)[key]),
        )
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
        const newValue: object = {}
        replaced.set(value, newValue)
        for (const key of Reflect.ownKeys(value)) {
          const descriptor = Object.getOwnPropertyDescriptor(value, key)!
          if (`value` in descriptor) {
            descriptor.value = replace(descriptor.value)
          }
          Object.defineProperty(newValue, key, descriptor)
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
