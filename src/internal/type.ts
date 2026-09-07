// For smaller bundle size.
/* eslint-disable eqeqeq */

export const getType = (value: object): [number, string] => {
  const tag = Object.prototype.toString.call(value)
  if (
    tag == `[object Uint8Array]` &&
    typeof Buffer != `undefined` &&
    Buffer.isBuffer(value)
  ) {
    // Buffer's `[[toStringTag]]` slot is `Uint8Array`.
    return [T_BUFFER, `Buffer`]
  }

  // The engine interns the tags of built-in types, so a lookup by the full tag
  // is cheaper than one by a fresh slice.
  // A tag from `Symbol.toStringTag` is treated as a plain object.
  return TAG_TYPES[tag] ?? [T_OBJECT, tag.slice(8, -1)]
}

export const T_PRIMITIVE_WRAPPER = 0
export const T_REG_EXP = 1
export const T_ARRAY = 2
export const T_SET = 3
export const T_MAP = 4
export const T_ARRAY_BUFFER = 5
export const T_UNSUPPORTED = 6
export const T_DATA_VIEW = 7
export const T_TYPED_ARRAY = 8
export const T_DATE = 9
export const T_TEMPORAL = 10
export const T_URL = 11
export const T_ARGUMENTS = 12
export const T_ERROR = 13
export const T_BUFFER = 14
export const T_OBJECT = 15

/** The type names, indexed by the numeric type from the `T_*` constants. */
const TYPE_NAMES = [
  `Boolean Number String`,
  `RegExp`,
  `Array`,
  `Set`,
  `Map`,
  `ArrayBuffer`,
  `Function GeneratorFunction AsyncFunction AsyncGeneratorFunction Promise SharedArrayBuffer WeakMap WeakSet`,
  `DataView`,
  `Int8Array Uint8Array Uint8ClampedArray Int16Array Uint16Array Int32Array Uint32Array Float16Array Float32Array Float64Array BigInt64Array BigUint64Array`,
  `Date`,
  `Temporal.Duration Temporal.Instant Temporal.PlainDate Temporal.PlainDateTime Temporal.PlainMonthDay Temporal.PlainTime Temporal.PlainYearMonth Temporal.ZonedDateTime`,
  `URL URLSearchParams`,
  `Arguments`,
  `Error`,
  `Buffer`,
  `Object`,
]

/** A map from `Object.prototype.toString` tag to the shared type tuple. */
const TAG_TYPES: Readonly<Record<string, [number, string] | undefined>> =
  Object.fromEntries(
    TYPE_NAMES.flatMap((names, type) =>
      names
        .split(` `)
        .map((name): [string, [number, string]] => [
          `[object ${name}]`,
          [type, name],
        ]),
    ),
  )
