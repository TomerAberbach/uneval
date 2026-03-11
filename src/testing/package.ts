import assert from 'node:assert'
import * as devalue from 'devalue'
import { stringify as javaScriptStringify } from 'javascript-stringify'
import jsStringify from 'js-stringify'
import jsesc from 'jsesc'
import serializeJavaScript from 'serialize-javascript'
import { serialize as seroval } from 'seroval'
import toSource from 'tosource'
import tomerUneval from '../index.ts'

export const unevals = {
  '@tomer/uneval':
    // Uncomment to benchmark against the built version, which is faster.
    // (await import(`../../dist/index.js`)).default,
    tomerUneval,
  devalue: (value, { custom } = {}) => {
    const replacer = custom
      ? (value: unknown) => custom(value, uneval) ?? undefined
      : undefined
    return devalue.uneval(value, replacer)
  },
  'javascript-stringify': value =>
    javaScriptStringify(value, null, null, { references: true }) ?? ``,
  jsesc: (() => {
    const options = { wrap: true, compact: true }
    return value => jsesc(value, options)
  })(),
  'js-stringify': value => jsStringify(value),
  'serialize-javascript': value => serializeJavaScript(value),
  seroval: value => seroval(value),
  tosource: (value, { custom } = {}) => {
    const replacer = custom
      ? (value: unknown) => custom(value, uneval)
      : undefined
    const uneval = (value: unknown) => toSource(value, replacer)
    return uneval(value)
  },
} as const satisfies Record<string, typeof tomerUneval>

// Change this to test out other packages.
const packageName = process.env.UNEVAL_PACKAGE ?? `@tomer/uneval`
assert(Object.hasOwn(unevals, packageName), packageName)
const uneval: typeof tomerUneval = unevals[packageName as keyof typeof unevals]

export default uneval
