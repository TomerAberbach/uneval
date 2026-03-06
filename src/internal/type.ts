// For smaller bundle size.
/* eslint-disable eqeqeq */

export const getType = (
  value: object,
): [] | [number, string] | [undefined, string] => {
  // `.constructor` returns `undefined` for objects with null prototype.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const name: string | undefined = value.constructor?.name
  return [
    (TYPES as Record<string, number>)[name] ??
      (name != `DataView` && ArrayBuffer.isView(value)
        ? T_TYPED_ARRAY
        : undefined),
    name,
  ]
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
  Array: T_ARRAY,
  ArrayBuffer: T_ARRAY_BUFFER,
  Boolean: T_PRIMITIVE_WRAPPER,
  Buffer: T_BUFFER,
  Date: T_DATE,
  Duration: T_TEMPORAL,
  Instant: T_TEMPORAL,
  Map: T_MAP,
  Number: T_PRIMITIVE_WRAPPER,
  PlainDate: T_TEMPORAL,
  PlainDateTime: T_TEMPORAL,
  PlainMonthDay: T_TEMPORAL,
  PlainTime: T_TEMPORAL,
  PlainYearMonth: T_TEMPORAL,
  RegExp: T_REG_EXP,
  Set: T_SET,
  String: T_PRIMITIVE_WRAPPER,
  URL: T_URL,
  URLSearchParams: T_URL,
  ZonedDateTime: T_TEMPORAL,
} as const

export const ALL_TYPES: ReadonlySet<unknown> = new Set(
  Array.from({ length: 11 }, (_, i) => i),
)
