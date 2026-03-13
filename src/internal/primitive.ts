// For smaller bundle size.
/* eslint-disable eqeqeq */

import { newInstance, PROPERTY_REG_EXP } from './common.ts'
import { unevalInternal, unevalWithoutCustom } from './index.ts'
import type { State, Uneval } from './types.ts'

export const unevalBoolean = (boolean: boolean): string =>
  // Convert `false` to `!1` and `true` to `!0`
  `!${+!boolean}`

export const unevalNumber = (number: number): string => {
  if (number == Infinity) {
    return `1/0`
  } else if (number == -Infinity) {
    return `-1/0`
  } else if (Object.is(number, -0)) {
    // Converting -0 to a string becomes `0` so we have to special-case it.
    return `-0`
  }

  const source = `${number}`

  // Convert `0.123` to `.123` and  `-0.123` to `-.123`.
  const zeroIndex = +(number < 0)
  const pointIndex = zeroIndex + 1
  if (source[zeroIndex] == `0` && source[pointIndex] == `.`) {
    return source.slice(0, zeroIndex) + source.slice(pointIndex)
  }

  return source
}

export const unevalBigint = (bigint: bigint): string => `${bigint}n`

export const unevalSymbol = (symbol: symbol, state: State): string => {
  let key = WELL_KNOWN_SYMBOL_TO_KEY.get(symbol)
  if (key) {
    return `Symbol.${key}`
  }

  key = Symbol.keyFor(symbol)
  if (key) {
    return `Symbol.for(${unevalWithoutCustom(key, state)})`
  }

  throw new TypeError(`Unsupported: Symbol`)
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
      // This protects against RCE from monkey-patched `RegExp` objects, where
      // `source` or `flags` could be set to arbitrary strings.
      isSafeRegExpSource(source) &&
      SAFE_REG_EXP_FLAGS_REG_EXP.test(flags)
      ? `/${source}/${flags}`
      : newInstance(
          name,
          `${unevalWithoutCustom(source, state)}${
            flags && `,${unevalWithoutCustom(flags, state)}`
          }`,
        )
  )
}

const isSafeRegExpSource = (source: string): boolean => {
  // eslint-disable-next-line @typescript-eslint/prefer-string-starts-ends-with
  if (source[0] == `*`) {
    // This would start a block comment.
    return false
  }

  let inCharClass = false
  for (let i = 0; i < source.length; i++) {
    const char = source[i]
    if (char === `\\`) {
      // Skip escaped character.
      i++
    } else if (inCharClass) {
      if (char === `]`) {
        inCharClass = false
      }
    } else if (char === `[`) {
      inCharClass = true
    } else if (char === `/`) {
      // An unescaped `/` outside a character class would end the `RegExp`
      // literal early.
      return false
    }
  }

  // Otherwise it's safe.
  return true
}

const SAFE_REG_EXP_FLAGS_REG_EXP = /^[a-z]*$/u

export const unevalString = (string: string): string =>
  `"${unevalLiteral(string, STRING_CODE_UNIT_ESCAPES)}"`

// `charCodeAt` is more performant for our use-case because we're dealing with
// strings known to be single code units.
/* eslint-disable unicorn/prefer-code-point */
const unevalLiteral = (
  literal: string,
  codeUnitEscapes: Readonly<Record<string, string>>,
): string => {
  let source = ``

  let lastIndex = 0
  for (let i = 0; i < literal.length; i += 1) {
    const codeUnit = literal[i]!
    const escaped = codeUnitEscapes[codeUnit]
    if (escaped) {
      source += literal.slice(lastIndex, i) + escaped
      lastIndex = i + 1
      continue
    }

    const code = codeUnit.charCodeAt(0)

    // https://en.wikipedia.org/wiki/UTF-16#U+D800_to_U+DFFF_(surrogates)
    let isUnpairedSurrogate: boolean | undefined
    const isLowSurrogate = code >= 0xd800 && code <= 0xdbff
    if (isLowSurrogate) {
      const next = literal.charCodeAt(i + 1)
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
      source += `${literal.slice(lastIndex, i)}\\u${code.toString(16)}`
      lastIndex = i + 1
      continue
    }

    // Prevent XSS attack via closing an inline script tag.
    if (
      codeUnit == `/` &&
      i > 0 &&
      literal[i - 1] == `<` &&
      literal.slice(i + 1, i + 7).toLowerCase() == `script`
    ) {
      source += `${literal.slice(lastIndex, i)}\\u002f`
      lastIndex = i + 1
    }
  }

  if (lastIndex === 0) {
    // Avoid unnecessary slicing below for performance.
    return literal
  }

  source += literal.slice(lastIndex)
  return source
}
/* eslint-enable unicorn/prefer-code-point */

/**
 * Code unit escapes for code units that are not safe to include in JS source
 * code for a literal (like a `string` or `RegExp`).
 */
const UNSAFE_CODE_UNIT_ESCAPES: Readonly<Record<string, string>> = {
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

const STRING_CODE_UNIT_ESCAPES: Readonly<Record<string, string>> = {
  '"': `\\"`,
  '\\': `\\\\`,
  ...UNSAFE_CODE_UNIT_ESCAPES,
}
