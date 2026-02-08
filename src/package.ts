import * as devalue from 'devalue'
import jsesc from 'jsesc'
import serializeJavaScript from 'serialize-javascript'
import toSource from 'tosource'
import tomerUneval from './index.ts'

export const unevals = {
  tomer: tomerUneval,
  devalue: (value, { custom } = {}) => devalue.uneval(value, custom),
  jsesc: (() => {
    const options = { wrap: true, compact: true }
    return value => jsesc(value, options)
  })(),
  serializeJavaScript: value => serializeJavaScript(value),
  toSource: (value, { custom } = {}) => {
    const replacer = custom
      ? (value: unknown) => custom(value, uneval)
      : undefined
    const uneval = (value: unknown) => toSource(value, replacer)
    return uneval(value)
  },
} as const satisfies Record<string, typeof tomerUneval>

// Change this to test out other packages.
const uneval: typeof tomerUneval = unevals.tomer

export default uneval
