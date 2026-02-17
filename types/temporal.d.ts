import type { Temporal as TemporalPolyfill } from '@js-temporal/polyfill'

declare global {
  var Temporal: typeof TemporalPolyfill
  namespace Temporal {
    export type ComparisonResult = TemporalPolyfill.ComparisonResult
    export type RoundingMode = TemporalPolyfill.RoundingMode
    export type AssignmentOptions = TemporalPolyfill.AssignmentOptions
    export type DurationOptions = TemporalPolyfill.DurationOptions
    export type ToInstantOptions = TemporalPolyfill.ToInstantOptions
    export type OffsetDisambiguationOptions =
      TemporalPolyfill.OffsetDisambiguationOptions
    export type ZonedDateTimeAssignmentOptions =
      TemporalPolyfill.ZonedDateTimeAssignmentOptions
    export type ArithmeticOptions = TemporalPolyfill.ArithmeticOptions
    export type DateUnit = TemporalPolyfill.DateUnit
    export type TimeUnit = TemporalPolyfill.TimeUnit
    export type DateTimeUnit = TemporalPolyfill.DateTimeUnit
    export type PluralUnit = TemporalPolyfill.PluralUnit
    export type LargestUnit = TemporalPolyfill.LargestUnit
    export type SmallestUnit = TemporalPolyfill.SmallestUnit
    export type TotalUnit = TemporalPolyfill.TotalUnit
    export type ToStringPrecisionOptions =
      TemporalPolyfill.ToStringPrecisionOptions
    export type ShowCalendarOption = TemporalPolyfill.ShowCalendarOption
    export type CalendarTypeToStringOptions =
      TemporalPolyfill.CalendarTypeToStringOptions
    export type ZonedDateTimeToStringOptions =
      TemporalPolyfill.ZonedDateTimeToStringOptions
    export type InstantToStringOptions = TemporalPolyfill.InstantToStringOptions
    export type DurationLike = TemporalPolyfill.DurationLike
    export type CalendarLike = TemporalPolyfill.CalendarLike
    export type PlainDateLike = TemporalPolyfill.PlainDateLike
    export type PlainDateTimeLike = TemporalPolyfill.PlainDateTimeLike
    export type PlainMonthDayLike = TemporalPolyfill.PlainMonthDayLike
    export type PlainTimeLike = TemporalPolyfill.PlainTimeLike
    export type PlainYearMonthLike = TemporalPolyfill.PlainYearMonthLike
    export type ZonedDateTimeLike = TemporalPolyfill.ZonedDateTimeLike
    export type TimeZoneLike = TemporalPolyfill.TimeZoneLike
    export type RoundTo = TemporalPolyfill.RoundTo
    export type DurationRoundTo = TemporalPolyfill.DurationRoundTo
    export type DurationTotalOf = TemporalPolyfill.DurationTotalOf
    export type TransitionDirection = TemporalPolyfill.TransitionDirection
    export type DifferenceOptions = TemporalPolyfill.DifferenceOptions
    export type DurationArithmeticOptions =
      TemporalPolyfill.DurationArithmeticOptions
    export type Duration = TemporalPolyfill.Duration
    export type Instant = TemporalPolyfill.Instant
    export type PlainDate = TemporalPolyfill.PlainDate
    export type PlainDateTime = TemporalPolyfill.PlainDateTime
    export type PlainMonthDay = TemporalPolyfill.PlainMonthDay
    export type PlainTime = TemporalPolyfill.PlainTime
    export type PlainYearMonth = TemporalPolyfill.PlainYearMonth
    export type ZonedDateTime = TemporalPolyfill.ZonedDateTime
    export type Now = typeof TemporalPolyfill.Now
  }
}
