// For smaller bundle size.
/* eslint-disable eqeqeq */

import { newInstance } from './common.ts'
import { unevalWithoutCustom } from './index.ts'
import type { Uneval } from './types.ts'

export const unevalDate: Uneval<Date> = (date, state, name) =>
  newInstance(name, unevalWithoutCustom(+date, state))

export const unevalTemporal: Uneval<
  | Temporal.Duration
  | Temporal.Instant
  | Temporal.PlainDate
  | Temporal.PlainDateTime
  | Temporal.PlainMonthDay
  | Temporal.PlainTime
  | Temporal.PlainYearMonth
  | Temporal.ZonedDateTime
> = (temporal, state, name) => {
  // `Temporal.ZonedDateTime` is the only `Temporal` type whose name has `Z` at
  // index 9.
  if (name[9] != `Z`) {
    return `${name}.from(${unevalWithoutCustom(
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      `${temporal}`,
      state,
    )})`
  }

  // We handle `ZonedDateTime` differently from that other `Temporal`
  // objects because `Temporal.ZonedDateTime.from(zonedDateTime.toString())`
  // does not always roundtrip:
  // https://github.com/tc39/proposal-temporal/pull/3014#issuecomment-3856086253
  const zonedDateTime = temporal as Temporal.ZonedDateTime
  return `new ${name}(${unevalWithoutCustom(
    zonedDateTime.epochNanoseconds,
    state,
  )},${unevalWithoutCustom(zonedDateTime.timeZoneId, state)})`
}
