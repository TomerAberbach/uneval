import { Temporal as TemporalPolyfill } from '@js-temporal/polyfill'

globalThis.Temporal = TemporalPolyfill as typeof Temporal
