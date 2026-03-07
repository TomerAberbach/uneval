// For smaller bundle size.
/* eslint-disable eqeqeq */

import { newInstance } from './common.ts'
import { unevalInternal } from './index.ts'
import type { Uneval } from './types.ts'

export const unevalDate: Uneval<Date> = (date, state, name) =>
  newInstance(name, unevalInternal(+date, state))

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
  // eslint-disable-next-line @typescript-eslint/prefer-string-starts-ends-with
  if (name[0] != `Z`) {
    return `Temporal.${name}.from(${unevalInternal(
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
  return `new Temporal.${name}(${unevalInternal(
    zonedDateTime.epochNanoseconds,
    state,
  )},${unevalInternal(zonedDateTime.timeZoneId, state)})`
}
