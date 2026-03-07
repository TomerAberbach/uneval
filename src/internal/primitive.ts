// For smaller bundle size.
/* eslint-disable eqeqeq */

import { newInstance, PROPERTY_REG_EXP } from './common.ts'
import { unevalInternal } from './index.ts'
import type { State, Uneval } from './types.ts'

export const unevalBoolean = (value: boolean): string =>
  // Convert `false` to `!1` and `true` to `!0`
  `!${+!value}`

export const unevalNumber = (value: number): string => {
  if (value == Infinity) {
    return `1/0`
  } else if (value == -Infinity) {
    return `-1/0`
  }

  const source = `${value}`
  if (Object.is(value, -0)) {
    // Converting -0 to a string becomes `0` so we have to special-case it.
    return `-${source}`
  }

  // Convert `0.123` to `.123` and  `-0.123` to `-.123`.
  if (source.startsWith(`0.`)) {
    return source.slice(1)
  } else if (source.startsWith(`-0.`)) {
    return `-${source.slice(2)}`
  }

  return source
}

export const unevalBigint = (value: bigint): string => `${value}n`

// `charCodeAt` is more performant for our use-case because we're dealing with
// strings known to be single code units.
/* eslint-disable unicorn/prefer-code-point */
export const unevalLiteral = (
  value: string,
  codeUnitEscapes: Readonly<Record<string, string>>,
): string => {
  let source = ``

  let lastIndex = 0
  for (let i = 0; i < value.length; i += 1) {
    const codeUnit = value[i]!
    const escaped = codeUnitEscapes[codeUnit]
    if (escaped) {
      source += value.slice(lastIndex, i) + escaped
      lastIndex = i + 1
      continue
    }

    const code = codeUnit.charCodeAt(0)

    // https://en.wikipedia.org/wiki/UTF-16#U+D800_to_U+DFFF_(surrogates)
    let isUnpairedSurrogate: boolean | undefined
    const isLowSurrogate = code >= 0xd800 && code <= 0xdbff
    if (isLowSurrogate) {
      const next = value.charCodeAt(i + 1)
      const isHighSurrogate = next >= 0xdc00 && next <= 0xdfff
      if (isHighSurrogate) {
        i++
      } else {
        isUnpairedSurrogate = true
      }
    } else {
      const isHighSurrogate = code >= 0xdc00 && code <= 0xdfff
      // If this is a high surrogate, then it's unpaired. If it were paired,
      // then we would have skipped it in the previous iteration of the loop.
      isUnpairedSurrogate = isHighSurrogate
    }

    if (isUnpairedSurrogate) {
      // Escape unpaired surrogates in the source.
      source += `${value.slice(lastIndex, i)}\\u${code.toString(16)}`
      lastIndex = i + 1
      continue
    }

    // Prevent XSS attack via closing an inline script tag.
    if (
      codeUnit == `/` &&
      i > 0 &&
      value[i - 1] == `<` &&
      value.slice(i + 1, i + 7).toLowerCase() == `script`
    ) {
      source += `${value.slice(lastIndex, i)}\\u002f`
      lastIndex = i + 1
    }
  }

  if (lastIndex === 0) {
    // Avoid unnecessary slicing below for performance.
    return value
  }

  source += value.slice(lastIndex)
  return source
}
/* eslint-enable unicorn/prefer-code-point */

/**
 * Code unit escapes for code units that are not safe to include in JS source
 * code for a literal (like a `string` or `RegExp`).
 */
export const UNSAFE_CODE_UNIT_ESCAPES: Readonly<Record<string, string>> = {
  '\0': `\\0`,
  '\n': `\\n`,
  '\r': `\\r`,
  '\t': `\\t`,
  '\b': `\\b`,
  '\f': `\\f`,
  '\v': `\\v`,
  // https://stackoverflow.com/a/9168133
  '\u2028': `\\u2028`,
  '\u2029': `\\u2029`,
}

export const STRING_CODE_UNIT_ESCAPES: Readonly<Record<string, string>> = {
  '"': `\\"`,
  '\\': `\\\\`,
  ...UNSAFE_CODE_UNIT_ESCAPES,
}

export const unevalSymbol = (value: symbol, state: State): string => {
  let key = WELL_KNOWN_SYMBOL_TO_KEY.get(value)
  if (key) {
    return `Symbol.${key}`
  }

  key = Symbol.keyFor(value)
  if (key) {
    return `Symbol.for(${unevalInternal(key, state)})`
  }

  throw new TypeError(`Unsupported symbol`)
}

const WELL_KNOWN_SYMBOL_TO_KEY: ReadonlyMap<symbol, string> = new Map(
  Reflect.ownKeys(Symbol).flatMap(key => {
    // This doesn't happen in practice, but best to be safe if one day a
    // non-string key as added to `Symbol`.
    if (typeof key != `string`) {
      return []
    }
    if (!PROPERTY_REG_EXP.test(key)) {
      // Defend against pollution attacks.
      return []
    }
    const value = Symbol[key as keyof typeof Symbol]
    return typeof value == `symbol` ? [[value, key]] : []
  }),
)

// eslint-disable-next-line @typescript-eslint/no-wrapper-object-types
export const unevalPrimitiveWrapper: Uneval<Boolean | Number | String> = (
  value,
  state,
) => `Object(${unevalInternal(value.valueOf(), state)})`

export const unevalRegExp: Uneval<RegExp> = (
  { source, flags },
  state,
  name,
) => {
  const escapedSource = unevalLiteral(source, UNSAFE_CODE_UNIT_ESCAPES)
  return (
    // `RegExp.prototype.source` will return the escaped version of the
    // source between the forward slashes for a literal. We can use it
    // directly in the `RegExp` literal, but only if the `source` is safe
    // for JS (e.g. no unescaped `\0` inline). We can't simply use
    // `escapedSource` here because that doesn't roundtrip.
    // i.e. `/\0/.source` is does not equal `new RegExp('\0').source`.
    // The former is `'\\0'` while the later is `'\0'`.
    source == escapedSource &&
      // This protects against RCE from monkey-patched `RegExp` objects.
      /^[a-z]*$/u.test(flags)
      ? `/${source}/${flags}`
      : newInstance(
          name,
          `${unevalInternal(source, state)}${
            flags && `,${unevalInternal(flags, state)}`
          }`,
        )
  )
}
