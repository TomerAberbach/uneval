// For smaller bundle size.
/* eslint-disable eqeqeq */

export const getType = (
  value: object,
): [] | [number, string] | [undefined, string] => {
  // `.constructor` returns `undefined` for objects with null prototype.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const name = value.constructor?.name
  return [(TYPES as Record<string, number>)[name], name]
}

export const T_PRIMITIVE_WRAPPER = 0
export const T_REG_EXP = 1
export const T_ARRAY = 2
export const T_SET = 3
export const T_MAP = 4
export const T_ARRAY_BUFFER = 5
export const T_TYPED_ARRAY = 6
export const T_BUFFER = 7
export const T_DATE = 8
export const T_TEMPORAL = 9
export const T_URL = 10

const TYPES = {
  Boolean: T_PRIMITIVE_WRAPPER,
  Number: T_PRIMITIVE_WRAPPER,
  RegExp: T_REG_EXP,
  String: T_PRIMITIVE_WRAPPER,

  Array: T_ARRAY,
  Set: T_SET,
  Map: T_MAP,

  ArrayBuffer: T_ARRAY_BUFFER,
  Int8Array: T_TYPED_ARRAY,
  Uint8Array: T_TYPED_ARRAY,
  Uint8ClampedArray: T_TYPED_ARRAY,
  Int16Array: T_TYPED_ARRAY,
  Uint16Array: T_TYPED_ARRAY,
  Int32Array: T_TYPED_ARRAY,
  Uint32Array: T_TYPED_ARRAY,
  Float16Array: T_TYPED_ARRAY,
  Float32Array: T_TYPED_ARRAY,
  Float64Array: T_TYPED_ARRAY,
  BigInt64Array: T_TYPED_ARRAY,
  BigUint64Array: T_TYPED_ARRAY,
  Buffer: T_BUFFER,

  Date: T_DATE,
  Duration: T_TEMPORAL,
  Instant: T_TEMPORAL,
  PlainDate: T_TEMPORAL,
  PlainDateTime: T_TEMPORAL,
  PlainMonthDay: T_TEMPORAL,
  PlainTime: T_TEMPORAL,
  PlainYearMonth: T_TEMPORAL,
  ZonedDateTime: T_TEMPORAL,

  URL: T_URL,
  URLSearchParams: T_URL,
} as const
