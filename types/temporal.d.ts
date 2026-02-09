import type { Temporal as TemporalPolyfill } from '@js-temporal/polyfill'

declare global {
  var Temporal: typeof TemporalPolyfill
}
