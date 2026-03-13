// For smaller bundle size.
/* eslint-disable eqeqeq */

export const getType = (
  value: object,
): [] | [number, string] | [undefined, string] => {
  const name = Object.prototype.toString.call(value).slice(8, -1)
  if (
    name == `Uint8Array` &&
    typeof Buffer != `undefined` &&
    Buffer.isBuffer(value)
  ) {
    // Buffer's `[[toStringTag]]` slot is `Uint8Array`.
    return [T_BUFFER, `Buffer`]
  }

  const type = (TYPES as Record<string, number>)[name]
  return [type, name]
}

export const T_PRIMITIVE_WRAPPER = 0
export const T_REG_EXP = 1
export const T_ARRAY = 2
export const T_SET = 3
export const T_MAP = 4
export const T_ARRAY_BUFFER = 5
export const T_BUFFER = 6
export const T_DATA_VIEW = 7
export const T_TYPED_ARRAY = 8
export const T_DATE = 9
export const T_TEMPORAL = 10
export const T_URL = 11
export const T_ARGUMENTS = 12
export const T_UNSUPPORTED = 13

const TYPES = {
  Boolean: T_PRIMITIVE_WRAPPER,
  Number: T_PRIMITIVE_WRAPPER,
  RegExp: T_REG_EXP,
  String: T_PRIMITIVE_WRAPPER,

  Array: T_ARRAY,
  Set: T_SET,
  Map: T_MAP,

  ArrayBuffer: T_ARRAY_BUFFER,
  DataView: T_DATA_VIEW,
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

  Date: T_DATE,
  'Temporal.Duration': T_TEMPORAL,
  'Temporal.Instant': T_TEMPORAL,
  'Temporal.PlainDate': T_TEMPORAL,
  'Temporal.PlainDateTime': T_TEMPORAL,
  'Temporal.PlainMonthDay': T_TEMPORAL,
  'Temporal.PlainTime': T_TEMPORAL,
  'Temporal.PlainYearMonth': T_TEMPORAL,
  'Temporal.ZonedDateTime': T_TEMPORAL,

  URL: T_URL,
  URLSearchParams: T_URL,

  Arguments: T_ARGUMENTS,

  Function: T_UNSUPPORTED,
  GeneratorFunction: T_UNSUPPORTED,
  AsyncFunction: T_UNSUPPORTED,
  AsyncGeneratorFunction: T_UNSUPPORTED,
  Promise: T_UNSUPPORTED,
  SharedArrayBuffer: T_UNSUPPORTED,
  WeakMap: T_UNSUPPORTED,
  WeakSet: T_UNSUPPORTED,
} as const
