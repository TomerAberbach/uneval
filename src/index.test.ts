/* eslint-disable id-length */
/* eslint-disable prefer-regex-literals */
/* eslint-disable require-unicode-regexp */
/* eslint-disable no-sparse-arrays */
/* eslint-disable unicorn/new-for-builtins */
/* eslint-disable no-new-wrappers */

import { assertNoPoisoning, restoreGlobals } from '@fast-check/poisoning'
import { test } from '@fast-check/vitest'
import { afterEach, describe, expect } from 'vitest'
import type { UnevalOptions } from './index.ts'
import { anythingArb } from './testing/arbs.ts'

// This has to happen before `uneval` is imported because well-known symbols are
// collected its module runs.
const evilSymbol = Symbol(`evil`)
// @ts-expect-error For testing.
Symbol[`</script>xss`] = evilSymbol
const { default: uneval } = await import(`./testing/package.ts`)
// @ts-expect-error For testing.
delete Symbol[`</script>xss`]

const ignoredRootRegex = /^(?:console|__vitest_.*|Person|__SEROVAL_REFS__)$/u
const poisoningAfterEach = () => {
  try {
    assertNoPoisoning({ ignoredRootRegex })
  } catch (error: unknown) {
    restoreGlobals({ ignoredRootRegex })
    throw error
  }
}
afterEach(poisoningAfterEach)

const isComparison = !!process.env.UNEVAL_COMPARISON

type Case = {
  todo?: boolean
  name: string
  value: unknown
  options?: UnevalOptions
  expected:
    | {
        source: string
        roundtrips?: boolean
      }
    | { error: true | string }
  compare?: boolean
}

const customBoolean: UnevalOptions[`custom`] = value =>
  typeof value === `boolean` ? String(value) : undefined
const customNumber: UnevalOptions[`custom`] = value =>
  typeof value === `number` && Number.isInteger(value)
    ? `${value}.0`
    : undefined
const customString: UnevalOptions[`custom`] = value =>
  typeof value === `string`
    ? JSON.stringify(value).replaceAll(`"`, `'`)
    : undefined
const customBigInt: UnevalOptions[`custom`] = value =>
  typeof value === `bigint` ? `BigInt("${value}")` : undefined
const customSymbol: UnevalOptions[`custom`] = (value, uneval) =>
  typeof value === `symbol` ? `Symbol(${uneval(value.description)})` : undefined

const cases: Record<string, Case[]> = {
  undefined: [
    {
      name: `undefined`,
      value: undefined,
      expected: { source: `void 0` },
    },
    {
      name: `custom undefined`,
      value: undefined,
      options: {
        custom: value => (value === undefined ? `undefined` : undefined),
      },
      expected: { source: `undefined` },
    },
    {
      name: `omit undefined from array`,
      value: [1, undefined, 3],
      options: { custom: value => (value === undefined ? null : undefined) },
      expected: {
        source: `[1,,3]`,
        roundtrips: false,
      },
    },
  ],

  null: [
    {
      name: `null`,
      value: null,
      expected: { source: `null` },
    },
    {
      name: `custom null`,
      value: null,
      options: {
        custom: value => (value === null ? `JSON.parse("null")` : undefined),
      },
      expected: { source: `JSON.parse("null")` },
    },
    {
      name: `omit null from array`,
      value: [1, null, 3],
      options: { custom: value => (value === null ? null : undefined) },
      expected: {
        source: `[1,,3]`,
        roundtrips: false,
      },
    },
  ],

  boolean: [
    { name: `false`, value: false, expected: { source: `!1` } },
    {
      name: `boxed false`,
      value: new Boolean(false),
      expected: { source: `Object(!1)` },
    },
    { name: `true`, value: true, expected: { source: `!0` } },
    {
      name: `boxed true`,
      value: new Boolean(true),
      expected: { source: `Object(!0)` },
    },
    {
      name: `polluted boxed boolean`,
      value: (() => {
        const value = new Boolean()
        value.valueOf = () =>
          // @ts-expect-error Purposefully using the wrong type.
          `</script><script src='https://evil.com/hacked.js'>`
        return value
      })(),
      expected: {
        source: `Object("<\\u002fscript><script src='https://evil.com/hacked.js'>")`,
        roundtrips: false,
      },
    },
    {
      name: `custom boolean`,
      value: true,
      options: { custom: customBoolean },
      expected: { source: `true` },
    },
    {
      name: `custom boolean affects boxed boolean`,
      value: new Boolean(true),
      options: { custom: customBoolean },
      expected: { source: `Object(true)` },
    },
    {
      name: `omit boolean from array`,
      value: [true, 1],
      options: { custom: value => (value === true ? null : undefined) },
      expected: {
        source: `[,1]`,
        roundtrips: false,
      },
    },
    {
      name: `omit boolean cascades to boxed boolean`,
      value: [new Boolean(true), 1],
      options: { custom: value => (value === true ? null : undefined) },
      expected: {
        source: `[,1]`,
        roundtrips: false,
      },
    },
  ],

  number: [
    { name: `zero`, value: 0, expected: { source: `0` } },
    {
      name: `boxed zero`,
      value: new Number(0),
      expected: { source: `Object(0)` },
    },
    { name: `negative zero`, value: -0, expected: { source: `-0` } },
    {
      name: `boxed negative zero`,
      value: new Number(-0),
      expected: { source: `Object(-0)` },
    },
    { name: `positive integer`, value: 42, expected: { source: `42` } },
    {
      name: `boxed positive integer`,
      value: new Number(42),
      expected: { source: `Object(42)` },
    },
    { name: `negative integer`, value: -42, expected: { source: `-42` } },
    {
      name: `boxed negative integer`,
      value: new Number(-42),
      expected: { source: `Object(-42)` },
    },
    { name: `positive decimal`, value: 3.14, expected: { source: `3.14` } },
    {
      name: `boxed positive decimal`,
      value: new Number(3.14),
      expected: { source: `Object(3.14)` },
    },
    { name: `negative decimal`, value: -3.14, expected: { source: `-3.14` } },
    {
      name: `boxed negative decimal`,
      value: new Number(-3.14),
      expected: { source: `Object(-3.14)` },
    },
    {
      name: `decimal between 0 and 1`,
      value: 0.12,
      expected: { source: `.12` },
    },
    {
      name: `boxed decimal between 0 and 1`,
      value: new Number(0.12),
      expected: { source: `Object(.12)` },
    },
    {
      name: `decimal between -1 and 0`,
      value: -0.12,
      expected: { source: `-.12` },
    },
    {
      name: `boxed decimal between -1 and 0`,
      value: new Number(-0.12),
      expected: { source: `Object(-.12)` },
    },
    {
      name: `max safe integer value`,
      value: Number.MAX_SAFE_INTEGER,
      expected: { source: `9007199254740991` },
    },
    {
      name: `boxed max safe integer value`,
      value: new Number(Number.MAX_SAFE_INTEGER),
      expected: { source: `Object(9007199254740991)` },
    },
    {
      name: `max number value`,
      value: Number.MAX_VALUE,
      expected: { source: `1.7976931348623157e+308` },
    },
    {
      name: `boxed max number value`,
      value: new Number(Number.MAX_VALUE),
      expected: { source: `Object(1.7976931348623157e+308)` },
    },
    {
      name: `min safe integer value`,
      value: Number.MIN_SAFE_INTEGER,
      expected: { source: `-9007199254740991` },
    },
    {
      name: `boxed min safe integer value`,
      value: new Number(Number.MIN_SAFE_INTEGER),
      expected: { source: `Object(-9007199254740991)` },
    },
    {
      name: `min number value`,
      value: Number.MIN_VALUE,
      expected: { source: `5e-324` },
    },
    {
      name: `boxed min number value`,
      value: new Number(Number.MIN_VALUE),
      expected: { source: `Object(5e-324)` },
    },
    { name: `NaN`, value: Number.NaN, expected: { source: `NaN` } },
    {
      name: `boxed NaN`,
      value: new Number(Number.NaN),
      expected: { source: `Object(NaN)` },
    },
    { name: `infinity`, value: Infinity, expected: { source: `1/0` } },
    {
      name: `boxed infinity`,
      value: new Number(Infinity),
      expected: { source: `Object(1/0)` },
    },
    {
      name: `negative infinity`,
      value: -Infinity,
      expected: { source: `-1/0` },
    },
    {
      name: `boxed negative infinity`,
      value: new Number(-Infinity),
      expected: { source: `Object(-1/0)` },
    },
    {
      name: `polluted boxed number`,
      value: (() => {
        const value = new Number(42)
        value.valueOf = () =>
          // @ts-expect-error Purposefully using the wrong type.
          `</script><script src='https://evil.com/hacked.js'>`
        return value
      })(),
      expected: {
        source: `Object("<\\u002fscript><script src='https://evil.com/hacked.js'>")`,
        roundtrips: false,
      },
    },
    {
      name: `custom number`,
      value: 42,
      options: { custom: customNumber },
      expected: { source: `42.0` },
    },
    {
      name: `custom number affects boxed number`,
      value: new Number(42),
      options: { custom: customNumber },
      expected: { source: `Object(42.0)` },
    },
    {
      name: `omit number from array`,
      value: [42, 1],
      options: { custom: value => (value === 42 ? null : undefined) },
      expected: {
        source: `[,1]`,
        roundtrips: false,
      },
    },
    {
      name: `omit number cascades to boxed number`,
      value: [new Number(42), 1],
      options: { custom: value => (value === 42 ? null : undefined) },
      expected: {
        source: `[,1]`,
        roundtrips: false,
      },
    },
  ],

  BigInt: [
    { name: `zero bigint`, value: 0n, expected: { source: `0n` } },
    { name: `negative zero bigint`, value: -0n, expected: { source: `0n` } },
    { name: `positive bigint`, value: 42n, expected: { source: `42n` } },
    { name: `negative bigint`, value: -42n, expected: { source: `-42n` } },
    {
      name: `large positive bigint`,
      value: 2_347_623_847_628_347_263_123n,
      expected: { source: `2347623847628347263123n` },
    },
    {
      name: `large negative bigint`,
      value: -2_347_623_847_628_347_263_123n,
      expected: { source: `-2347623847628347263123n` },
    },
    {
      name: `custom bigint`,
      value: 42n,
      options: {
        custom: (value, uneval) =>
          typeof value === `bigint`
            ? `BigInt(${uneval(String(value))})`
            : undefined,
      },
      expected: { source: `BigInt("42")` },
    },
    {
      name: `omit bigint from array`,
      value: [42n, 1],
      options: { custom: value => (value === 42n ? null : undefined) },
      expected: {
        source: `[,1]`,
        roundtrips: false,
      },
    },
  ],

  string: [
    { name: `empty string`, value: ``, expected: { source: `""` } },
    {
      name: `boxed empty string`,
      value: new String(``),
      expected: { source: `Object("")` },
    },
    {
      name: `single character string`,
      value: `a`,
      expected: { source: `"a"` },
    },
    {
      name: `boxed single character string`,
      value: new String(`a`),
      expected: { source: `Object("a")` },
    },
    {
      name: `string with spaces`,
      value: `a b c`,
      expected: { source: `"a b c"` },
    },
    {
      name: `boxed string with spaces`,
      value: new String(`a b c`),
      expected: { source: `Object("a b c")` },
    },
    {
      name: `string with single quotes`,
      value: `'''`,
      expected: { source: `"'''"` },
    },
    {
      name: `boxed string with single quotes`,
      value: new String(`'''`),
      expected: { source: `Object("'''")` },
    },
    {
      name: `string with double quote`,
      value: `"`,
      expected: { source: `"\\""` },
    },
    {
      name: `boxed string with double quote`,
      value: new String(`"`),
      expected: { source: `Object("\\"")` },
    },
    { name: `backslash string`, value: `\\`, expected: { source: `"\\\\"` } },
    {
      name: `boxed backslash string`,
      value: new String(`\\`),
      expected: { source: `Object("\\\\")` },
    },
    {
      name: `null terminator string`,
      value: `\0`,
      expected: { source: `"\\0"` },
    },
    {
      name: `boxed null terminator string`,
      value: new String(`\0`),
      expected: { source: `Object("\\0")` },
    },
    { name: `newline string`, value: `\n`, expected: { source: `"\\n"` } },
    {
      name: `boxed newline string`,
      value: new String(`\n`),
      expected: { source: `Object("\\n")` },
    },
    {
      name: `carriage return string`,
      value: `\r`,
      expected: { source: `"\\r"` },
    },
    {
      name: `boxed carriage return string`,
      value: new String(`\r`),
      expected: { source: `Object("\\r")` },
    },
    { name: `tab string`, value: `\t`, expected: { source: `"\\t"` } },
    {
      name: `boxed tab string`,
      value: new String(`\t`),
      expected: { source: `Object("\\t")` },
    },
    { name: `backspace string`, value: `\b`, expected: { source: `"\\b"` } },
    {
      name: `boxed backspace string`,
      value: new String(`\b`),
      expected: { source: `Object("\\b")` },
    },
    { name: `form feed string`, value: `\f`, expected: { source: `"\\f"` } },
    {
      name: `boxed form feed string`,
      value: new String(`\f`),
      expected: { source: `Object("\\f")` },
    },
    {
      name: `vertical tabulator string`,
      value: `\v`,
      expected: { source: `"\\v"` },
    },
    {
      name: `boxed vertical tabulator string`,
      value: new String(`\v`),
      expected: { source: `Object("\\v")` },
    },
    {
      name: `line separator string`,
      value: `\u2028`,
      expected: { source: `"\\u2028"` },
    },
    {
      name: `boxed line separator string`,
      value: new String(`\u2028`),
      expected: { source: `Object("\\u2028")` },
    },
    {
      name: `multiple line separators string`,
      value: `\u2028\u2028`,
      expected: { source: `"\\u2028\\u2028"` },
    },
    {
      name: `boxed multiple line separators string`,
      value: new String(`\u2028\u2028`),
      expected: { source: `Object("\\u2028\\u2028")` },
    },
    {
      name: `paragraph separator string`,
      value: `\u2029`,
      expected: { source: `"\\u2029"` },
    },
    {
      name: `boxed paragraph separator string`,
      value: new String(`\u2029`),
      expected: { source: `Object("\\u2029")` },
    },
    {
      name: `multiple paragraph separators string`,
      value: `\u2029\u2029`,
      expected: { source: `"\\u2029\\u2029"` },
    },
    {
      name: `boxed multiple paragraph separators string`,
      value: new String(`\u2029\u2029`),
      expected: { source: `Object("\\u2029\\u2029")` },
    },
    {
      name: `string with closing script tag`,
      value: `</script>`,
      expected: { source: `"<\\u002fscript>"` },
    },
    {
      name: `string with multiple closing script tags`,
      value: ` </script> sdf </script> sdfsfd </script>  sdf </script>`,
      expected: {
        source: `" <\\u002fscript> sdf <\\u002fscript> sdfsfd <\\u002fscript>  sdf <\\u002fscript>"`,
      },
    },
    {
      name: `boxed string with closing script tag`,
      value: new String(`</script>`),
      expected: { source: `Object("<\\u002fscript>")` },
    },
    {
      name: `string with capitalized closing script tag`,
      value: `</SCRIPT>`,
      expected: { source: `"<\\u002fSCRIPT>"` },
    },
    {
      name: `boxed string with capitalized closing script tag`,
      value: new String(`</SCRIPT>`),
      expected: { source: `Object("<\\u002fSCRIPT>")` },
    },
    {
      name: `string with mixed capitalization closing script tag`,
      value: `</sCrIpT>`,
      expected: { source: `"<\\u002fsCrIpT>"` },
    },
    {
      name: `boxed string with mixed capitalization capitalized closing script tag`,
      value: new String(`</sCrIpT>`),
      expected: { source: `Object("<\\u002fsCrIpT>")` },
    },
    {
      name: `string with closing script tag with whitespace`,
      value: `</script   >`,
      expected: { source: `"<\\u002fscript   >"` },
    },
    {
      name: `boxed string with closing script tag with whitespace`,
      value: new String(`</script   >`),
      expected: { source: `Object("<\\u002fscript   >")` },
    },
    {
      name: `string with unpaired low surrogate`,
      value: `\uDC00`,
      expected: { source: `"\\udc00"` },
    },
    {
      name: `boxed string with unpaired low surrogate`,
      value: new String(`\uDC00`),
      expected: { source: `Object("\\udc00")` },
    },
    {
      name: `string with unpaired high surrogate`,
      value: `\uD800`,
      expected: { source: `"\\ud800"` },
    },
    {
      name: `boxed string with unpaired high surrogate`,
      value: new String(`\uD800`),
      expected: { source: `Object("\\ud800")` },
    },
    {
      name: `string with unpaired low surrogate in middle`,
      value: `a\uDC00b`,
      expected: { source: `"a\\udc00b"` },
    },
    {
      name: `boxed string with unpaired low surrogate in middle`,
      value: new String(`a\uDC00b`),
      expected: { source: `Object("a\\udc00b")` },
    },
    {
      name: `string with unpaired high surrogate in middle`,
      value: `a\uD800b`,
      expected: { source: `"a\\ud800b"` },
    },
    {
      name: `boxed string with unpaired high surrogate in middle`,
      value: new String(`a\uD800b`),
      expected: { source: `Object("a\\ud800b")` },
    },
    {
      name: `string with multiple unpaired surrogates`,
      value: `\uD800\uDBFF`,
      expected: { source: `"\\ud800\\udbff"` },
    },
    {
      name: `boxed string with multiple unpaired surrogates`,
      value: new String(`\uD800\uDBFF`),
      expected: { source: `Object("\\ud800\\udbff")` },
    },
    {
      name: `string with surrogate pair`,
      value: `\uD83D\uDE00`,
      expected: { source: `"😀"` },
    },
    {
      name: `boxed string with surrogate pair`,
      value: new String(`\uD83D\uDE00`),
      expected: { source: `Object("😀")` },
    },
    {
      name: `polluted boxed string`,
      value: (() => {
        const value = new String(42)
        value.valueOf = () =>
          `</script><script src='https://evil.com/hacked.js'>`
        return value
      })(),
      expected: {
        source: `Object("<\\u002fscript><script src='https://evil.com/hacked.js'>")`,
        roundtrips: false,
      },
    },
    {
      name: `custom string`,
      value: `Hello!`,
      options: { custom: customString },
      expected: { source: `'Hello!'` },
    },
    {
      name: `custom string affects boxed string`,
      value: new String(`Hello!`),
      options: { custom: customString },
      expected: { source: `Object('Hello!')` },
    },
    {
      name: `omit string from array`,
      value: [`hello`, 1],
      options: { custom: value => (value === `hello` ? null : undefined) },
      expected: {
        source: `[,1]`,
        roundtrips: false,
      },
    },
    {
      name: `omit string cascades to boxed string`,
      value: [new String(`hello`), 1],
      options: { custom: value => (value === `hello` ? null : undefined) },
      expected: {
        source: `[,1]`,
        roundtrips: false,
      },
    },
  ],

  Symbol: [
    {
      name: `async dispose symbol`,
      value: Symbol.asyncDispose,
      expected: { source: `Symbol.asyncDispose` },
    },
    {
      name: `async iterator symbol`,
      value: Symbol.asyncIterator,
      expected: { source: `Symbol.asyncIterator` },
    },
    {
      name: `dispose symbol`,
      value: Symbol.dispose,
      expected: { source: `Symbol.dispose` },
    },
    {
      name: `instanceof symbol`,
      value: Symbol.hasInstance,
      expected: { source: `Symbol.hasInstance` },
    },
    {
      name: `is concat spreadable symbol`,
      value: Symbol.isConcatSpreadable,
      expected: { source: `Symbol.isConcatSpreadable` },
    },
    {
      name: `iterator symbol`,
      value: Symbol.iterator,
      expected: { source: `Symbol.iterator` },
    },
    {
      name: `match symbol`,
      value: Symbol.match,
      expected: { source: `Symbol.match` },
    },
    {
      name: `match all symbol`,
      value: Symbol.matchAll,
      expected: { source: `Symbol.matchAll` },
    },
    {
      name: `replace symbol`,
      value: Symbol.replace,
      expected: { source: `Symbol.replace` },
    },
    {
      name: `search symbol`,
      value: Symbol.search,
      expected: { source: `Symbol.search` },
    },
    {
      name: `species symbol`,
      value: Symbol.species,
      expected: { source: `Symbol.species` },
    },
    {
      name: `split symbol`,
      value: Symbol.split,
      expected: { source: `Symbol.split` },
    },
    {
      name: `to primitive symbol`,
      value: Symbol.toPrimitive,
      expected: { source: `Symbol.toPrimitive` },
    },
    {
      name: `to string tag symbol`,
      value: Symbol.toStringTag,
      expected: { source: `Symbol.toStringTag` },
    },
    {
      name: `unscopables symbol`,
      value: Symbol.unscopables,
      expected: { source: `Symbol.unscopables` },
    },
    {
      name: `global symbol registry symbol`,
      value: Symbol.for(`howdy`),
      expected: { source: `Symbol.for("howdy")` },
    },
    {
      name: `global symbol registry symbol with closing script tag`,
      value: Symbol.for(`</script>`),
      expected: { source: `Symbol.for("<\\u002fscript>")` },
    },
    {
      name: `unique symbol`,
      // eslint-disable-next-line symbol-description
      value: Symbol(),
      expected: {
        error: `Unsupported: Symbol`,
      },
    },
    {
      name: `unique symbol with description`,
      value: Symbol(`howdy`),
      expected: {
        error: `Unsupported: Symbol`,
      },
    },
    {
      name: `polluted symbol`,
      value: evilSymbol,
      expected: {
        error: `Unsupported: Symbol`,
      },
      compare: false,
    },
    {
      name: `custom symbol`,
      value: Symbol(`hi`),
      options: { custom: customSymbol },
      expected: {
        source: `Symbol("hi")`,
        roundtrips: false,
      },
    },
    {
      name: `custom string does not affect symbol`,
      value: Symbol.for(`hi`),
      options: { custom: customString },
      expected: { source: `Symbol.for("hi")` },
    },
    {
      name: `custom string does not affect symbol when string is sibling`,
      value: [Symbol.for(`hi`), `hi`],
      options: { custom: customString },
      expected: { source: `[Symbol.for("hi"),'hi']` },
    },
    {
      name: `omit string does not affect symbol`,
      value: Symbol.for(`hi`),
      options: { custom: value => (value === `hi` ? null : undefined) },
      expected: { source: `Symbol.for("hi")` },
    },
    {
      name: `omit string does not affect symbol when string is sibling`,
      value: [Symbol.for(`hi`), `hi`],
      options: { custom: value => (value === `hi` ? null : undefined) },
      expected: {
        source: `[Symbol.for("hi"),,]`,
        roundtrips: false,
      },
    },
  ],

  Array: [
    {
      name: `empty array`,
      value: [],
      expected: { source: `[]` },
    },
    {
      name: `non-empty array`,
      value: [1, 2, 3],
      expected: { source: `[1,2,3]` },
    },
    {
      name: `sparse array with all empty slots`,
      value: [, , ,],
      expected: { source: `[,,,]` },
    },
    {
      name: `sparse array with leading empty slots`,
      value: [, 1, 2, 3],
      expected: { source: `[,1,2,3]` },
    },
    {
      name: `sparse array with trailing empty slots`,
      value: [1, 2, 3, ,],
      expected: { source: `[1,2,3,,]` },
    },
    {
      name: `sparse array with leading and trailing empty slots`,
      value: [, 1, 2, 3, ,],
      expected: { source: `[,1,2,3,,]` },
    },
    {
      name: `sparse array with middle empty slots`,
      value: [1, , , , , 2],
      expected: { source: `[1,,,,,2]` },
    },
    {
      name: `small empty sparse array`,
      value: Array(27),
      expected: { source: `Array(27)` },
    },
    {
      name: `small sparse array with trailing empty slots`,
      value: (() => {
        const array: unknown[] = Array(27)
        array[4] = 42
        return array
      })(),
      expected: { source: `[,,,,42,,,,,,,,,,,,,,,,,,,,,,,]` },
    },
    {
      name: `small sparse array with no trailing empty slots`,
      value: (() => {
        const array: unknown[] = Array(27)
        array[26] = 42
        return array
      })(),
      expected: { source: `Object.assign([],{26:42})` },
    },
    {
      name: `medium sparse array with trailing empty slots`,
      value: (() => {
        const array: unknown[] = Array(50)
        array[4] = 42
        return array
      })(),
      expected: { source: `Object.assign(Array(50),{4:42})` },
    },
    {
      name: `medium sparse array with no trailing empty slots`,
      value: (() => {
        const array: unknown[] = Array(50)
        array[49] = 42
        return array
      })(),
      expected: { source: `Object.assign([],{49:42})` },
    },
    {
      name: `large empty sparse array`,
      value: Array(1000),
      expected: { source: `Array(1000)` },
    },
    {
      name: `large sparse array with non-trailing value`,
      value: (() => {
        const array: unknown[] = Array(100)
        array[4] = 42
        return array
      })(),
      expected: { source: `Object.assign(Array(100),{4:42})` },
    },
    {
      name: `large sparse array with trailing value`,
      value: (() => {
        const array: unknown[] = Array(100)
        array[99] = 42
        return array
      })(),
      expected: { source: `Object.assign([],{99:42})` },
    },
    {
      name: `extremely sparse array with non-trailing value`,
      value: (() => {
        const value: unknown[] = Array(100)
        value[50] = 1
        return value
      })(),
      expected: { source: `Object.assign(Array(100),{50:1})` },
    },
    {
      name: `extremely sparse array with trailing value`,
      value: (() => {
        const value: unknown[] = []
        value[50] = 1
        return value
      })(),
      expected: { source: `Object.assign([],{50:1})` },
    },
    {
      name: `extremely sparse array with multiple values`,
      value: (() => {
        const value: unknown[] = []
        value[10] = `a`
        value[50] = `b`
        value[1000] = `c`
        return value
      })(),
      expected: { source: `Object.assign([],{10:"a",50:"b",1000:"c"})` },
    },
    {
      name: `polluted array`,
      value: (() => {
        const value = Object.create(Array.prototype) as Record<
          PropertyKey,
          unknown
        >
        value[Symbol.toStringTag] = `Array`
        Object.defineProperty(value, `length`, {
          value: Number.MAX_SAFE_INTEGER,
        })
        return value
      })(),
      expected: {
        source: `Array(9007199254740991)`,
        roundtrips: false,
      },
    },
    {
      name: `custom array`,
      value: [1, 2, 3],
      options: {
        custom: (value, uneval) =>
          Array.isArray(value)
            ? `[${value.map(uneval).join(`, `)}]`
            : undefined,
      },
      expected: { source: `[1, 2, 3]` },
    },
    {
      name: `custom element affects array`,
      value: [1, 2, 3],
      options: { custom: customNumber },
      expected: { source: `[1.0,2.0,3.0]` },
    },
    {
      name: `omit array element`,
      value: [1, 2, 3],
      options: { custom: value => (value === 2 ? null : undefined) },
      expected: {
        source: `[1,,3]`,
        roundtrips: false,
      },
    },
    {
      name: `omit trailing array element`,
      value: [1, 2, 3],
      options: { custom: value => (value === 3 ? null : undefined) },
      expected: {
        source: `[1,2,,]`,
        roundtrips: false,
      },
    },
    {
      name: `omit element from sparse array using Object.assign representation`,
      value: (() => {
        const array: unknown[] = Array(100)
        array[50] = 42
        return array
      })(),
      options: { custom: value => (value === 42 ? null : undefined) },
      expected: {
        source: `Array(100)`,
        roundtrips: false,
      },
    },
  ],

  Object: [
    {
      name: `empty object`,
      value: {},
      expected: { source: `{}` },
    },
    {
      name: `object with single character property`,
      value: { a: 2 },
      expected: { source: `{a:2}` },
    },
    {
      name: `object with string property`,
      value: { ab: 2 },
      expected: { source: `{ab:2}` },
    },
    {
      name: `object with string with spaces property`,
      value: { 'a b c': 2 },
      expected: { source: `{"a b c":2}` },
    },
    {
      name: `object with string with underscores property`,
      value: { __a__: 2 },
      expected: { source: `{__a__:2}` },
    },
    {
      name: `object with string with dollar signs property`,
      value: { $a$: 2 },
      expected: { source: `{$a$:2}` },
    },
    {
      name: `object with closing script tag property`,
      value: { [`</script>`]: 2 },
      expected: { source: `{"<\\u002fscript>":2}` },
    },
    {
      name: `object with zero property`,
      value: { 0: 2 },
      expected: { source: `{0:2}` },
    },
    {
      name: `object with multiple zeros property`,
      value: { '00': 2 },
      expected: { source: `{"00":2}` },
    },
    {
      name: `object with integer property`,
      value: { 1: 2 },
      expected: { source: `{1:2}` },
    },
    {
      name: `object with integer property with matching value`,
      value: { 1: 1 },
      expected: { source: `{1:1}` },
    },
    {
      name: `object with string positive integer property`,
      value: { '1': 2 },
      expected: { source: `{1:2}` },
    },
    {
      name: `object with string negative integer property`,
      value: { '-1': 2 },
      expected: { source: `{"-1":2}` },
    },
    {
      name: `object with string positive decimal property`,
      value: { '1.2': 2 },
      expected: { source: `{"1.2":2}` },
    },
    {
      name: `object with string negative decimal property`,
      value: { '-1.2': 2 },
      expected: { source: `{"-1.2":2}` },
    },
    {
      name: `object with large safe integer property`,
      value: { 1_000_000_000_000_000: 2 },
      expected: { source: `{1000000000000000:2}` },
    },
    {
      name: `object with non-safe integer property`,
      value: { '10000000000000000000000000000000000000000': 2 },
      expected: { source: `{"10000000000000000000000000000000000000000":2}` },
    },
    {
      name: `object with symbol property`,
      value: { [Symbol.toStringTag]: `hi` },
      expected: { source: `{[Symbol.toStringTag]:"hi"}` },
    },
    {
      name: `null prototype empty object`,
      value: Object.create(null),
      expected: { source: `Object.setPrototypeOf({},null)` },
    },
    {
      name: `null prototype non-empty object`,
      value: Object.setPrototypeOf({ a: 2 }, null),
      expected: { source: `Object.setPrototypeOf({a:2},null)` },
    },
    {
      name: `object with null __proto__ property`,
      value: { __proto__: null },
      expected: { source: `Object.setPrototypeOf({},null)` },
    },
    {
      name: `object with null own __proto__ property`,
      value: Object.defineProperty({}, `__proto__`, {
        value: null,
        configurable: true,
        enumerable: true,
        writable: true,
      }),
      expected: { source: `{["__proto__"]:null}` },
    },
    {
      name: `object with own constructor property`,
      value: { constructor: { name: `RegExp` } },
      expected: { source: `{constructor:{name:"RegExp"}}` },
    },
    {
      name: `object with copy of default prototype`,
      value: Object.create(
        Object.fromEntries(
          Object.getOwnPropertyNames(Object.prototype).map(key => [
            key,
            (Object.prototype as Record<string, unknown>)[key],
          ]),
        ),
      ),
      expected: { source: `{}` },
    },
    {
      name: `object with near copy of default prototype`,
      value: Object.create(
        Object.fromEntries(
          Object.getOwnPropertyNames(Object.prototype)
            .slice(1)
            .map(key => {
              const value = (Object.prototype as Record<string, unknown>)[key]
              return [key, typeof value === `function` ? `function` : value]
            }),
        ),
      ),
      expected: {
        source: `Object.setPrototypeOf({},{__defineGetter__:"function",__defineSetter__:"function",hasOwnProperty:"function",__lookupGetter__:"function",__lookupSetter__:"function",isPrototypeOf:"function",propertyIsEnumerable:"function",toString:"function",valueOf:"function",["__proto__"]:null,toLocaleString:"function"})`,
        roundtrips: false,
      },
    },
    {
      name: `non-enumerable non-configurable non-writable property`,
      value: Object.defineProperty({}, `a`, { value: 1 }),
      expected: { source: `Object.defineProperties({},{a:{value:1}})` },
    },
    {
      name: `enumerable non-configurable non-writable property`,
      value: Object.defineProperty({}, `a`, { value: 1, enumerable: true }),
      expected: {
        source: `Object.defineProperties({},{a:{value:1,enumerable:!0}})`,
      },
    },
    {
      name: `non-enumerable configurable non-writable property`,
      value: Object.defineProperty({}, `a`, { value: 1, configurable: true }),
      expected: {
        source: `Object.defineProperties({},{a:{value:1,configurable:!0}})`,
      },
    },
    {
      name: `non-enumerable non-configurable writable property`,
      value: Object.defineProperty({}, `a`, { value: 1, writable: true }),
      expected: {
        source: `Object.defineProperties({},{a:{value:1,writable:!0}})`,
      },
    },
    {
      name: `enumerable configurable non-writable property`,
      value: Object.defineProperty({}, `a`, {
        value: 1,
        enumerable: true,
        configurable: true,
      }),
      expected: {
        source: `Object.defineProperties({},{a:{value:1,configurable:!0,enumerable:!0}})`,
      },
    },
    {
      name: `enumerable non-configurable writable property`,
      value: Object.defineProperty({}, `a`, {
        value: 1,
        enumerable: true,
        writable: true,
      }),
      expected: {
        source: `Object.defineProperties({},{a:{value:1,enumerable:!0,writable:!0}})`,
      },
    },
    {
      name: `enumerable configurable non-writable property`,
      value: Object.defineProperty({}, `a`, {
        value: 1,
        enumerable: true,
        configurable: true,
      }),
      expected: {
        source: `Object.defineProperties({},{a:{value:1,configurable:!0,enumerable:!0}})`,
      },
    },
    {
      name: `enumerable configurable writable property`,
      value: Object.defineProperty({}, `a`, {
        value: 1,
        enumerable: true,
        configurable: true,
        writable: true,
      }),
      expected: { source: `{a:1}` },
    },
    {
      name: `regular then non-regular property`,
      value: Object.defineProperty({ a: 1 }, `b`, { value: 2 }),
      expected: { source: `Object.defineProperties({a:1},{b:{value:2}})` },
    },
    {
      name: `non-regular then regular property`,
      value: Object.defineProperties(
        {},
        {
          a: { value: 1 },
          b: { value: 2, enumerable: true, configurable: true, writable: true },
        },
      ),
      expected: {
        source: `Object.defineProperties({},{a:{value:1},b:{value:2,configurable:!0,enumerable:!0,writable:!0}})`,
      },
    },
    {
      name: `non-enumerable symbol property`,
      value: Object.defineProperty({}, Symbol.toStringTag, { value: `hi` }),
      expected: {
        source: `Object.defineProperties({},{[Symbol.toStringTag]:{value:"hi"}})`,
      },
    },
    {
      name: `non-enumerable __proto__ property`,
      value: Object.defineProperty({}, `__proto__`, { value: null }),
      expected: {
        source: `Object.defineProperties({},{["__proto__"]:{value:null}})`,
      },
    },
    {
      name: `omit value from non-regular property descriptor`,
      value: Object.defineProperty({}, `a`, { value: 42 }),
      options: { custom: value => (value === 42 ? null : undefined) },
      expected: {
        source: `Object.defineProperties({},{a:{}})`,
        roundtrips: false,
      },
    },
    {
      name: `accessor property with undefined getter`,
      value: Object.defineProperty({}, `a`, { get: undefined }),
      expected: { source: `Object.defineProperties({},{a:{get:void 0}})` },
    },
    {
      name: `accessor property with undefined setter`,
      value: Object.defineProperty({}, `a`, { set: undefined }),
      expected: { source: `Object.defineProperties({},{a:{get:void 0}})` },
    },
    {
      name: `accessor property with undefined getter and setter`,
      value: Object.defineProperty({}, `a`, { get: undefined, set: undefined }),
      expected: { source: `Object.defineProperties({},{a:{get:void 0}})` },
    },
    {
      name: `only non-regular properties`,
      value: Object.defineProperties(
        {},
        { a: { value: 1, writable: true }, b: { value: 2, enumerable: true } },
      ),
      expected: {
        source: `Object.defineProperties({},{a:{value:1,writable:!0},b:{value:2,enumerable:!0}})`,
      },
    },
    {
      name: `non-regular property with null prototype`,
      value: Object.setPrototypeOf(
        Object.defineProperty({}, `a`, { value: 1 }),
        null,
      ),
      expected: {
        source: `Object.setPrototypeOf(Object.defineProperties({},{a:{value:1}}),null)`,
      },
    },
    {
      name: `custom object`,
      value: { a: 1, b: 2, c: 3 },
      options: {
        custom: (value, uneval) =>
          value !== null && typeof value === `object`
            ? `{ ${Object.entries(value)
                .map(([key, value]) => `[${uneval(key)}]: ${uneval(value)}`)
                .join(`, `)} }`
            : undefined,
      },
      expected: { source: `{ ["a"]: 1, ["b"]: 2, ["c"]: 3 }` },
    },
    {
      name: `custom string does not affect object keys`,
      value: { a: 1, b: 2, c: 3, 'x y z': 4 },
      options: { custom: customString },
      expected: { source: `{a:1,b:2,c:3,"x y z":4}` },
    },
    {
      name: `custom string does not affect object keys when string is sibling`,
      value: [{ a: 1, b: 2, c: 3, 'x y z': 4 }, `x y z`],
      options: { custom: customString },
      expected: { source: `[{a:1,b:2,c:3,"x y z":4},'x y z']` },
    },
    {
      name: `custom __proto__ string does not affect object keys`,
      value: { a: 1, b: 2, c: 3, [`__proto__`]: 4 },
      options: { custom: customString },
      expected: { source: `{a:1,b:2,c:3,["__proto__"]:4}` },
    },
    {
      name: `custom __proto__ string does not affect object keys when string is sibling`,
      value: [{ a: 1, b: 2, c: 3, [`__proto__`]: 4 }, `__proto__`],
      options: { custom: customString },
      expected: { source: `[{a:1,b:2,c:3,["__proto__"]:4},'__proto__']` },
    },
    {
      name: `omit string does not affect object keys`,
      value: { a: 1, b: 2, c: 3, 'x y z': 4 },
      options: { custom: value => (value === `x y z` ? null : undefined) },
      expected: { source: `{a:1,b:2,c:3,"x y z":4}` },
    },
    {
      name: `omit string does not affect object keys when string is sibling`,
      value: [{ a: 1, b: 2, c: 3, 'x y z': 4 }, `x y z`],
      options: { custom: value => (value === `x y z` ? null : undefined) },
      expected: {
        source: `[{a:1,b:2,c:3,"x y z":4},,]`,
        roundtrips: false,
      },
    },
    {
      name: `omit __proto__ string does not affect object keys`,
      value: { a: 1, b: 2, c: 3, [`__proto__`]: 4 },
      options: { custom: value => (value === `__proto__` ? null : undefined) },
      expected: { source: `{a:1,b:2,c:3,["__proto__"]:4}` },
    },
    {
      name: `omit __proto__ string does not affect object keys when string is sibling`,
      value: [{ a: 1, b: 2, c: 3, [`__proto__`]: 4 }, `__proto__`],
      options: { custom: value => (value === `__proto__` ? null : undefined) },
      expected: {
        source: `[{a:1,b:2,c:3,["__proto__"]:4},,]`,
        roundtrips: false,
      },
    },
    {
      name: `custom number does not affect object keys`,
      value: { 42: 4, a: 1, b: 2, c: 3 },
      options: { custom: customNumber },
      expected: { source: `{42:4.0,a:1.0,b:2.0,c:3.0}` },
    },
    {
      name: `custom number does not affect object keys when number is sibling`,
      value: [{ 42: 4, a: 1, b: 2, c: 3 }, 42],
      options: { custom: customNumber },
      expected: { source: `[{42:4.0,a:1.0,b:2.0,c:3.0},42.0]` },
    },
    {
      name: `omit number does not affect object keys`,
      value: { 42: 4, a: 1, b: 2, c: 3 },
      options: { custom: value => (value === 42 ? null : undefined) },
      expected: { source: `{42:4,a:1,b:2,c:3}` },
    },
    {
      name: `omit number does not affect object keys when number is sibling`,
      value: [{ 42: 4, a: 1, b: 2, c: 3 }, 42],
      options: { custom: value => (value === 42 ? null : undefined) },
      expected: {
        source: `[{42:4,a:1,b:2,c:3},,]`,
        roundtrips: false,
      },
    },
    {
      name: `custom symbol affects object keys`,
      value: { a: 1, [Symbol.for(`hi`)]: 2 },
      options: { custom: customSymbol },
      expected: {
        source: `{a:1,[Symbol("hi")]:2}`,
        roundtrips: false,
      },
    },
    {
      name: `custom value affects object values`,
      value: { a: 1, b: 2, c: 3 },
      options: { custom: customNumber },
      expected: { source: `{a:1.0,b:2.0,c:3.0}` },
    },
    {
      name: `omit object property value`,
      value: { a: 1, b: 2, c: 3 },
      options: { custom: value => (value === 2 ? null : undefined) },
      expected: {
        source: `{a:1,c:3}`,
        roundtrips: false,
      },
    },
    {
      name: `omit object from array`,
      value: [1, { a: 1 }, 3],
      options: {
        custom: value =>
          typeof value === `object` && value !== null && `a` in value
            ? null
            : undefined,
      },
      expected: {
        source: `[1,,3]`,
        roundtrips: false,
      },
    },
    {
      name: `omit symbol key from object`,
      value: (() => {
        const sym = Symbol.for(`omitMe`)
        return { a: 1, [sym]: 2, b: 3 }
      })(),
      options: {
        custom: value => (value === Symbol.for(`omitMe`) ? null : undefined),
      },
      expected: {
        source: `{a:1,b:3}`,
        roundtrips: false,
      },
    },
  ],

  Set: [
    {
      name: `empty Set`,
      value: new Set(),
      expected: { source: `new Set` },
    },
    {
      name: `empty Set from empty array`,
      value: new Set([]),
      expected: { source: `new Set` },
    },
    {
      name: `non-empty Set`,
      value: new Set([1, 2, 3]),
      expected: { source: `new Set([1,2,3])` },
    },
    {
      name: `polluted Set`,
      value: (() => {
        const value = Object.create(Set.prototype) as Set<unknown>
        Object.defineProperty(value, Symbol.iterator, {
          *value() {
            yield `</script><script src='https://evil.com/hacked.js'>`
          },
          configurable: true,
        })
        return value
      })(),
      expected: {
        source: `new Set(["<\\u002fscript><script src='https://evil.com/hacked.js'>"])`,
        roundtrips: false,
      },
    },
    {
      name: `custom Set`,
      value: new Set([1, 2, 3]),
      options: {
        custom: (value, uneval) =>
          value instanceof Set
            ? `((set=new Set())=>set${Array.from(
                value,
                value => `.add(${uneval(value)})`,
              ).join(``)})()`
            : undefined,
      },
      expected: { source: `((set=new Set())=>set.add(1).add(2).add(3))()` },
    },
    {
      name: `custom member affects Set`,
      value: new Set([1, 2, 3]),
      options: { custom: customNumber },
      expected: { source: `new Set([1.0,2.0,3.0])` },
    },
    {
      name: `omit Set member`,
      value: new Set([1, 2, 3]),
      options: { custom: value => (value === 2 ? null : undefined) },
      expected: {
        source: `new Set([1,3])`,
        roundtrips: false,
      },
    },
  ],

  Map: [
    { name: `empty Map`, value: new Map(), expected: { source: `new Map` } },
    {
      name: `empty Map from empty array`,
      value: new Map([]),
      expected: { source: `new Map` },
    },
    {
      name: `non-empty Map`,
      value: new Map([
        [1, 2],
        [3, 4],
      ]),
      expected: { source: `new Map([[1,2],[3,4]])` },
    },
    {
      name: `polluted Map`,
      value: (() => {
        const value = Object.create(Map.prototype) as Map<unknown, unknown>
        Object.defineProperty(value, Symbol.iterator, {
          *value() {
            yield [`key`, `</script><script src='https://evil.com/hacked.js'>`]
          },
          configurable: true,
        })
        return value
      })(),
      expected: {
        source: `new Map([["key","<\\u002fscript><script src='https://evil.com/hacked.js'>"]])`,
        roundtrips: false,
      },
    },
    {
      name: `custom Map`,
      value: new Map([
        [1, 2],
        [3, 4],
      ]),
      options: {
        custom: (value, uneval) =>
          value instanceof Map
            ? `((map=new Map())=>map${Array.from(
                value,
                ([key, value]) => `.set(${uneval(key)},${uneval(value)})`,
              ).join(``)})()`
            : undefined,
      },
      expected: { source: `((map=new Map())=>map.set(1,2).set(3,4))()` },
    },
    {
      name: `custom key affects Map keys`,
      value: new Map([
        [1, `a`],
        [2, `b`],
      ]),
      options: { custom: customNumber },
      expected: { source: `new Map([[1.0,"a"],[2.0,"b"]])` },
    },
    {
      name: `custom value affects Map value`,
      value: new Map([
        [`a`, 1],
        [`b`, 2],
      ]),
      options: { custom: customNumber },
      expected: { source: `new Map([["a",1.0],["b",2.0]])` },
    },
    {
      name: `omit Map value drops entry`,
      value: new Map<unknown, unknown>([
        [`a`, 1],
        [`b`, 2],
        [`c`, 3],
      ]),
      options: { custom: value => (value === 2 ? null : undefined) },
      expected: {
        source: `new Map([["a",1],["c",3]])`,
        roundtrips: false,
      },
    },
    {
      name: `omit Map key drops entry`,
      value: new Map<unknown, unknown>([
        [1, `a`],
        [2, `b`],
        [3, `c`],
      ]),
      options: { custom: value => (value === 2 ? null : undefined) },
      expected: {
        source: `new Map([[1,"a"],[3,"c"]])`,
        roundtrips: false,
      },
    },
  ],

  RegExp: [
    {
      name: `RegExp literal without flags`,
      value: /abc/,
      expected: { source: `/abc/` },
    },
    {
      name: `RegExp constructor without flags`,
      value: new RegExp(`abc`),
      expected: { source: `/abc/` },
    },
    {
      name: `RegExp literal with flags`,
      value: /abc/iu,
      expected: { source: `/abc/iu` },
    },
    {
      name: `RegExp constructor with flags`,
      value: new RegExp(`abc`, `iu`),
      expected: { source: `/abc/iu` },
    },
    {
      name: `RegExp with empty string`,
      value: new RegExp(``),
      expected: { source: `/(?:)/` },
    },
    {
      name: `RegExp literal with spaces`,
      value: /a b c/,
      expected: { source: `/a b c/` },
    },
    {
      name: `RegExp constructor with spaces`,
      value: new RegExp(`a b c`),
      expected: { source: `/a b c/` },
    },
    {
      name: `RegExp literal with forward slash`,
      value: /\//,
      expected: { source: `/\\//` },
    },
    {
      name: `RegExp constructor with forward slash`,
      value: new RegExp(`/`),
      expected: { source: `/\\//` },
    },
    {
      name: `RegExp literal with backlash slash`,
      value: /\\/,
      expected: { source: `/\\\\/` },
    },
    {
      name: `RegExp constructor with backlash slash`,
      value: new RegExp(`\\\\`),
      expected: { source: `/\\\\/` },
    },
    {
      name: `RegExp literal with null terminator`,
      value: /\0/,
      expected: { source: `/\\0/` },
    },
    {
      name: `RegExp constructor with null terminator`,
      value: new RegExp(`\0`),
      expected: { source: `new RegExp("\\0")` },
    },
    {
      name: `RegExp literal with newline`,
      value: /\n/,
      expected: { source: `/\\n/` },
    },
    {
      name: `RegExp constructor with newline`,
      value: new RegExp(`\n`),
      expected: { source: `/\\n/` },
    },
    {
      name: `RegExp literal with carriage return`,
      value: /\r/,
      expected: { source: `/\\r/` },
    },
    {
      name: `RegExp constructor with carriage return`,
      value: new RegExp(`\r`),
      expected: { source: `/\\r/` },
    },
    {
      name: `RegExp literal with tab`,
      value: /\t/,
      expected: { source: `/\\t/` },
    },
    {
      name: `RegExp constructor with tab`,
      value: new RegExp(`\t`),
      expected: { source: `new RegExp("\\t")` },
    },
    {
      name: `RegExp literal with backspace`,
      value: /\b/,
      expected: { source: `/\\b/` },
    },
    {
      name: `RegExp constructor with backspace`,
      value: new RegExp(`\b`),
      expected: { source: `new RegExp("\\b")` },
    },
    {
      name: `RegExp literal with form feed`,
      value: /\f/,
      expected: { source: `/\\f/` },
    },
    {
      name: `RegExp constructor with form feed`,
      value: new RegExp(`\f`),
      expected: { source: `new RegExp("\\f")` },
    },
    {
      name: `RegExp literal with vertical tabulator`,
      value: /\v/,
      expected: { source: `/\\v/` },
    },
    {
      name: `RegExp constructor with vertical tabulator`,
      value: new RegExp(`\v`),
      expected: { source: `new RegExp("\\v")` },
    },
    {
      name: `RegExp literal with line separator`,
      value: /\u2028/,
      expected: { source: `/\\u2028/` },
    },
    {
      name: `RegExp constructor with line separator`,
      value: new RegExp(`\u2028`),
      expected: { source: `/\\u2028/` },
    },
    {
      name: `RegExp literal with multiple line separators`,
      // eslint-disable-next-line unicorn/better-regex
      value: /\u2028\u2028/,
      expected: { source: `/\\u2028\\u2028/` },
    },
    {
      name: `RegExp constructor with multiple line separators`,
      value: new RegExp(`\u2028\u2028`),
      expected: { source: `/\\u2028\\u2028/` },
    },
    {
      name: `RegExp literal with paragraph separator`,
      value: /\u2029/,
      expected: { source: `/\\u2029/` },
    },
    {
      name: `RegExp constructor with paragraph separator`,
      value: new RegExp(`\u2029`),
      expected: { source: `/\\u2029/` },
    },
    {
      name: `RegExp literal with multiple paragraph separators`,
      // eslint-disable-next-line unicorn/better-regex
      value: /\u2029\u2029/,
      expected: { source: `/\\u2029\\u2029/` },
    },
    {
      name: `RegExp constructor with multiple paragraph separators`,
      value: new RegExp(`\u2029\u2029`),
      expected: { source: `/\\u2029\\u2029/` },
    },
    {
      name: `RegExp literal with closing script tag`,
      value: /<\/script>/,
      expected: { source: `/<\\/script>/` },
    },
    {
      name: `RegExp constructor with closing script tag`,
      value: new RegExp(`</script>`),
      expected: { source: `/<\\/script>/` },
    },
    {
      name: `RegExp literal with closing script tag with whitespace`,
      // eslint-disable-next-line no-regex-spaces
      value: /<\/script   >/,
      expected: { source: `/<\\/script   >/` },
    },
    {
      name: `RegExp constructor with closing script tag with whitespace`,
      value: new RegExp(`</script   >`),
      expected: { source: `/<\\/script   >/` },
    },
    {
      name: `RegExp literal with unpaired low surrogate`,
      value: /\uDC00/,
      expected: { source: `/\\uDC00/` },
    },
    {
      name: `RegExp constructor with unpaired low surrogate`,
      value: new RegExp(`\uDC00`),
      expected: { source: `new RegExp("\\udc00")` },
    },
    {
      name: `RegExp literal with unpaired high surrogate`,
      value: /\uD800/,
      expected: { source: `/\\uD800/` },
    },
    {
      name: `RegExp constructor with unpaired high surrogate`,
      value: new RegExp(`\uD800`),
      expected: { source: `new RegExp("\\ud800")` },
    },
    {
      name: `RegExp literal with unpaired low surrogate in middle`,
      value: /a\uDC00b/,
      expected: { source: `/a\\uDC00b/` },
    },
    {
      name: `RegExp constructor with unpaired low surrogate in middle`,
      value: new RegExp(`a\uDC00b`),
      expected: { source: `new RegExp("a\\udc00b")` },
    },
    {
      name: `RegExp literal with unpaired high surrogate in middle`,
      value: /a\uD800b/,
      expected: { source: `/a\\uD800b/` },
    },
    {
      name: `RegExp constructor with unpaired high surrogate in middle`,
      value: new RegExp(`a\uD800b`),
      expected: { source: `new RegExp("a\\ud800b")` },
    },
    {
      name: `RegExp literal with multiple unpaired surrogates`,
      value: /\uD800\uDBFF/,
      expected: { source: `/\\uD800\\uDBFF/` },
    },
    {
      name: `RegExp constructor with multiple unpaired surrogates`,
      value: new RegExp(`\uD800\uDBFF`),
      expected: { source: `new RegExp("\\ud800\\udbff")` },
    },
    {
      name: `RegExp literal with surrogate pair`,
      value: /\uD83D\uDE00/,
      expected: { source: `/\\uD83D\\uDE00/` },
    },
    {
      name: `RegExp constructor with surrogate pair`,
      value: new RegExp(`\uD83D\uDE00`),
      expected: { source: `/😀/` },
    },
    {
      name: `RegExp literal with emoji`,
      value: /😀/,
      expected: { source: `/😀/` },
    },
    {
      name: `RegExp constructor with emoji`,
      value: new RegExp(`😀`),
      expected: { source: `/😀/` },
    },
    {
      name: `script polluted RegExp source`,
      value: Object.defineProperty(/a/, `source`, {
        value: `</script><script src='https://evil.com/hacked.js'>`,
      }),
      expected: {
        source: `new RegExp("<\\u002fscript><script src='https://evil.com/hacked.js'>")`,
        roundtrips: false,
      },
    },
    {
      name: `console.log polluted RegExp source`,
      value: [
        1,
        Object.defineProperty(/a/, `source`, {
          value: `a/, console.log('pwned'), /a`,
        }),
      ],
      expected: {
        source: `[1,new RegExp("a/, console.log('pwned'), /a")]`,
        roundtrips: false,
      },
    },
    {
      name: `polluted RegExp source with leading slash`,
      value: Object.defineProperty(/a/, `source`, { value: `/inject` }),
      expected: {
        source: `new RegExp("/inject")`,
        roundtrips: false,
      },
    },
    {
      name: `polluted RegExp source with trailing slash`,
      value: Object.defineProperty(/a/, `source`, { value: `inject/` }),
      expected: {
        source: `new RegExp("inject/")`,
        roundtrips: false,
      },
    },
    {
      name: `polluted RegExp source with multiple slashes`,
      value: Object.defineProperty(/a/, `source`, { value: `a/b/c` }),
      expected: {
        source: `new RegExp("a/b/c")`,
        roundtrips: false,
      },
    },
    {
      // Even number of backslashes before a slash means the slash is unescaped.
      // A real RegExp with a slash would have an odd number (e.g. `\/`).
      name: `polluted RegExp source with even backslashes before slash`,
      value: Object.defineProperty(/a/, `source`, { value: `\\\\/inject` }),
      expected: {
        source: `new RegExp("\\\\\\\\/inject")`,
        roundtrips: false,
      },
    },
    {
      name: `polluted RegExp flags`,
      value: Object.defineProperty(/abc/, `flags`, {
        value: `+fetch('https://evil.com/hacked.js')`,
      }),
      expected: {
        source: `new RegExp("abc","+fetch('https://evil.com/hacked.js')")`,
        roundtrips: false,
      },
    },
    {
      name: `custom RegExp`,
      value: /abc/,
      options: {
        custom: (value, uneval) =>
          value instanceof RegExp
            ? `new RegExp(${uneval(value.source)})`
            : undefined,
      },
      expected: { source: `new RegExp("abc")` },
    },
    {
      name: `custom string does not affect RegExp literal`,
      value: /abc/,
      options: { custom: customString },
      expected: { source: `/abc/` },
    },
    {
      name: `custom string does not affect RegExp literal when string is sibling`,
      value: [/abc/, `abc`],
      options: { custom: customString },
      expected: { source: `[/abc/,'abc']` },
    },
    {
      name: `custom string does not affect RegExp constructor`,
      value: new RegExp(`\v`),
      options: { custom: customString },
      expected: { source: `new RegExp("\\v")` },
    },
    {
      name: `custom string does not affect RegExp constructor when string is sibling`,
      value: [new RegExp(`\v`), `\v`],
      options: { custom: customString },
      expected: { source: `[new RegExp("\\v"),'\\u000b']` },
    },
    {
      name: `omit string does not affect RegExp literal`,
      value: /abc/,
      options: { custom: value => (value === `abc` ? null : undefined) },
      expected: { source: `/abc/` },
    },
    {
      name: `omit string does not affect RegExp literal when string is sibling`,
      value: [/abc/, `abc`],
      options: { custom: value => (value === `abc` ? null : undefined) },
      expected: {
        source: `[/abc/,,]`,
        roundtrips: false,
      },
    },
    {
      name: `omit string does not affect RegExp constructor`,
      value: new RegExp(`\v`),
      options: { custom: value => (value === `\v` ? null : undefined) },
      expected: { source: `new RegExp("\\v")` },
    },
    {
      name: `omit string does not affect RegExp constructor when string is sibling`,
      value: [new RegExp(`\v`), `\v`],
      options: { custom: value => (value === `\v` ? null : undefined) },
      expected: {
        source: `[new RegExp("\\v"),,]`,
        roundtrips: false,
      },
    },
    {
      name: `omit RegExp from container`,
      value: [/test/, 1],
      options: {
        custom: value => (value instanceof RegExp ? null : undefined),
      },
      expected: {
        source: `[,1]`,
        roundtrips: false,
      },
    },
  ],

  Date: [
    {
      name: `valid Date`,
      value: new Date(42),
      expected: { source: `new Date(42)` },
    },
    {
      name: `invalid Date`,
      value: new Date(`oh no!`),
      expected: { source: `new Date(NaN)` },
    },
    {
      name: `polluted Date`,
      value: (() => {
        const value = new Date(42)
        value.valueOf = () =>
          // @ts-expect-error Purposefully using the wrong type.
          `</script><script src='https://evil.com/hacked.js'>`
        return value
      })(),
      expected: {
        source: `new Date(NaN)`,
        roundtrips: false,
      },
    },
    {
      name: `custom Date`,
      value: new Date(42),
      options: {
        custom: (value, uneval) =>
          value instanceof Date
            ? `new Date(${uneval(value.toISOString())})`
            : undefined,
      },
      expected: { source: `new Date("1970-01-01T00:00:00.042Z")` },
    },
    {
      name: `custom number does not affect Date`,
      value: new Date(42),
      options: { custom: customNumber },
      expected: { source: `new Date(42)` },
    },
    {
      name: `custom number does not affect Date when number is sibling`,
      value: [new Date(42), 42],
      options: { custom: customNumber },
      expected: { source: `[new Date(42),42.0]` },
    },
    {
      name: `omit number does not affect Date`,
      value: new Date(42),
      options: { custom: value => (value === 42 ? null : undefined) },
      expected: { source: `new Date(42)` },
    },
    {
      name: `omit number does not affect Date when number is sibling`,
      value: [new Date(42), 42],
      options: { custom: value => (value === 42 ? null : undefined) },
      expected: {
        source: `[new Date(42),,]`,
        roundtrips: false,
      },
    },
    {
      name: `omit Date from container`,
      value: [new Date(0), 1],
      options: {
        custom: value => (value instanceof Date ? null : undefined),
      },
      expected: {
        source: `[,1]`,
        roundtrips: false,
      },
    },
  ],

  Temporal: [
    {
      name: `Temporal.Instant`,
      value: Temporal.Instant.from(`2024-12-25T00:00:00Z`),
      expected: { source: `Temporal.Instant.from("2024-12-25T00:00:00Z")` },
    },
    {
      name: `Temporal.Instant epoch`,
      value: Temporal.Instant.from(`1970-01-01T00:00:00Z`),
      expected: { source: `Temporal.Instant.from("1970-01-01T00:00:00Z")` },
    },
    {
      name: `custom Temporal.Instant`,
      value: Temporal.Instant.from(`1970-01-01T00:00:00Z`),
      options: {
        custom: (value, uneval) =>
          value instanceof Temporal.Instant
            ? `Temporal.Instant.fromEpochNanoseconds(${uneval(
                value.epochNanoseconds,
              )})`
            : undefined,
      },
      expected: { source: `Temporal.Instant.fromEpochNanoseconds(0n)` },
    },
    {
      name: `custom string does not affect Temporal.Instant`,
      value: Temporal.Instant.from(`2024-12-25T00:00:00Z`),
      options: { custom: customString },
      expected: { source: `Temporal.Instant.from("2024-12-25T00:00:00Z")` },
    },
    {
      name: `custom string does not affect Temporal.Instant when string is sibling`,
      value: [
        Temporal.Instant.from(`2024-12-25T00:00:00Z`),
        `2024-12-25T00:00:00Z`,
      ],
      options: { custom: customString },
      expected: {
        source: `[Temporal.Instant.from("2024-12-25T00:00:00Z"),'2024-12-25T00:00:00Z']`,
      },
    },
    {
      name: `omit string does not affect Temporal.Instant`,
      value: Temporal.Instant.from(`2024-12-25T00:00:00Z`),
      options: {
        custom: value => (value === `2024-12-25T00:00:00Z` ? null : undefined),
      },
      expected: { source: `Temporal.Instant.from("2024-12-25T00:00:00Z")` },
    },
    {
      name: `omit string does not affect Temporal.Instant when string is sibling`,
      value: [
        Temporal.Instant.from(`2024-12-25T00:00:00Z`),
        `2024-12-25T00:00:00Z`,
      ],
      options: {
        custom: value => (value === `2024-12-25T00:00:00Z` ? null : undefined),
      },
      expected: {
        source: `[Temporal.Instant.from("2024-12-25T00:00:00Z"),,]`,
        roundtrips: false,
      },
    },
    {
      name: `Temporal.PlainDate`,
      value: Temporal.PlainDate.from(`2024-12-25`),
      expected: { source: `Temporal.PlainDate.from("2024-12-25")` },
    },
    {
      name: `custom Temporal.PlainDate`,
      value: Temporal.PlainDate.from(`2024-12-25`),
      options: {
        custom: (value, uneval) =>
          value instanceof Temporal.PlainDate
            ? `Temporal.PlainDate.from(${uneval({
                year: value.year,
                month: value.month,
                day: value.day,
              })})`
            : undefined,
      },
      expected: {
        source: `Temporal.PlainDate.from({year:2024,month:12,day:25})`,
      },
    },
    {
      name: `custom string does not affect Temporal.PlainDate`,
      value: Temporal.PlainDate.from(`2024-12-25`),
      options: { custom: customString },
      expected: { source: `Temporal.PlainDate.from("2024-12-25")` },
    },
    {
      name: `custom string does not affect Temporal.PlainDate when string is sibling`,
      value: [Temporal.PlainDate.from(`2024-12-25`), `2024-12-25`],
      options: { custom: customString },
      expected: {
        source: `[Temporal.PlainDate.from("2024-12-25"),'2024-12-25']`,
      },
    },
    {
      name: `omit string does not affect Temporal.PlainDate`,
      value: Temporal.PlainDate.from(`2024-12-25`),
      options: { custom: value => (value === `2024-12-25` ? null : undefined) },
      expected: { source: `Temporal.PlainDate.from("2024-12-25")` },
    },
    {
      name: `omit string does not affect Temporal.PlainDate when string is sibling`,
      value: [Temporal.PlainDate.from(`2024-12-25`), `2024-12-25`],
      options: { custom: value => (value === `2024-12-25` ? null : undefined) },
      expected: {
        source: `[Temporal.PlainDate.from("2024-12-25"),,]`,
        roundtrips: false,
      },
    },
    {
      name: `Temporal.PlainTime`,
      value: Temporal.PlainTime.from(`13:45:30`),
      expected: { source: `Temporal.PlainTime.from("13:45:30")` },
    },
    {
      name: `Temporal.PlainTime with nanoseconds`,
      value: Temporal.PlainTime.from(`13:45:30.123456789`),
      expected: { source: `Temporal.PlainTime.from("13:45:30.123456789")` },
    },
    {
      name: `custom Temporal.PlainTime`,
      value: Temporal.PlainTime.from(`13:45:30`),
      options: {
        custom: (value, uneval) =>
          value instanceof Temporal.PlainTime
            ? `Temporal.PlainTime.from(${uneval({
                hour: value.hour,
                minute: value.minute,
                second: value.second,
              })})`
            : undefined,
      },
      expected: {
        source: `Temporal.PlainTime.from({hour:13,minute:45,second:30})`,
      },
    },
    {
      name: `custom string does not affect Temporal.PlainTime`,
      value: Temporal.PlainTime.from(`13:45:30`),
      options: { custom: customString },
      expected: { source: `Temporal.PlainTime.from("13:45:30")` },
    },
    {
      name: `custom string does not affect Temporal.PlainTime when string is sibling`,
      value: [Temporal.PlainTime.from(`13:45:30`), `13:45:30`],
      options: { custom: customString },
      expected: { source: `[Temporal.PlainTime.from("13:45:30"),'13:45:30']` },
    },
    {
      name: `omit string does not affect Temporal.PlainTime`,
      value: Temporal.PlainTime.from(`13:45:30`),
      options: { custom: value => (value === `13:45:30` ? null : undefined) },
      expected: { source: `Temporal.PlainTime.from("13:45:30")` },
    },
    {
      name: `omit string does not affect Temporal.PlainTime when string is sibling`,
      value: [Temporal.PlainTime.from(`13:45:30`), `13:45:30`],
      options: { custom: value => (value === `13:45:30` ? null : undefined) },
      expected: {
        source: `[Temporal.PlainTime.from("13:45:30"),,]`,
        roundtrips: false,
      },
    },
    {
      name: `Temporal.PlainDateTime`,
      value: Temporal.PlainDateTime.from(`2024-12-25T13:45:30`),
      expected: {
        source: `Temporal.PlainDateTime.from("2024-12-25T13:45:30")`,
      },
    },
    {
      name: `custom Temporal.PlainDateTime`,
      value: Temporal.PlainDateTime.from(`2024-12-25T13:45:30`),
      options: {
        custom: (value, uneval) =>
          value instanceof Temporal.PlainDateTime
            ? `Temporal.PlainDateTime.from(${uneval({
                year: value.year,
                month: value.month,
                day: value.day,
                hour: value.hour,
                minute: value.minute,
                second: value.second,
              })})`
            : undefined,
      },
      expected: {
        source: `Temporal.PlainDateTime.from({year:2024,month:12,day:25,hour:13,minute:45,second:30})`,
      },
    },
    {
      name: `custom string does not affect Temporal.PlainDateTime`,
      value: Temporal.PlainDateTime.from(`2024-12-25T13:45:30`),
      options: { custom: customString },
      expected: {
        source: `Temporal.PlainDateTime.from("2024-12-25T13:45:30")`,
      },
    },
    {
      name: `custom string does not affect Temporal.PlainDateTime when string is sibling`,
      value: [
        Temporal.PlainDateTime.from(`2024-12-25T13:45:30`),
        `2024-12-25T13:45:30`,
      ],
      options: { custom: customString },
      expected: {
        source: `[Temporal.PlainDateTime.from("2024-12-25T13:45:30"),'2024-12-25T13:45:30']`,
      },
    },
    {
      name: `omit string does not affect Temporal.PlainDateTime`,
      value: Temporal.PlainDateTime.from(`2024-12-25T13:45:30`),
      options: {
        custom: value => (value === `2024-12-25T13:45:30` ? null : undefined),
      },
      expected: {
        source: `Temporal.PlainDateTime.from("2024-12-25T13:45:30")`,
      },
    },
    {
      name: `omit string does not affect Temporal.PlainDateTime when string is sibling`,
      value: [
        Temporal.PlainDateTime.from(`2024-12-25T13:45:30`),
        `2024-12-25T13:45:30`,
      ],
      options: {
        custom: value => (value === `2024-12-25T13:45:30` ? null : undefined),
      },
      expected: {
        source: `[Temporal.PlainDateTime.from("2024-12-25T13:45:30"),,]`,
        roundtrips: false,
      },
    },
    {
      name: `Temporal.PlainYearMonth`,
      value: Temporal.PlainYearMonth.from(`2024-12`),
      expected: { source: `Temporal.PlainYearMonth.from("2024-12")` },
    },
    {
      name: `custom Temporal.PlainYearMonth`,
      value: Temporal.PlainYearMonth.from(`2024-12`),
      options: {
        custom: (value, uneval) =>
          value instanceof Temporal.PlainYearMonth
            ? `Temporal.PlainYearMonth.from(${uneval({
                year: value.year,
                month: value.month,
              })})`
            : undefined,
      },
      expected: {
        source: `Temporal.PlainYearMonth.from({year:2024,month:12})`,
      },
    },
    {
      name: `custom string does not affect Temporal.PlainYearMonth`,
      value: Temporal.PlainYearMonth.from(`2024-12`),
      options: { custom: customString },
      expected: { source: `Temporal.PlainYearMonth.from("2024-12")` },
    },
    {
      name: `custom string does not affect Temporal.PlainYearMonth when string is sibling`,
      value: [Temporal.PlainYearMonth.from(`2024-12`), `2024-12`],
      options: { custom: customString },
      expected: {
        source: `[Temporal.PlainYearMonth.from("2024-12"),'2024-12']`,
      },
    },
    {
      name: `omit string does not affect Temporal.PlainYearMonth`,
      value: Temporal.PlainYearMonth.from(`2024-12`),
      options: { custom: value => (value === `2024-12` ? null : undefined) },
      expected: { source: `Temporal.PlainYearMonth.from("2024-12")` },
    },
    {
      name: `omit string does not affect Temporal.PlainYearMonth when string is sibling`,
      value: [Temporal.PlainYearMonth.from(`2024-12`), `2024-12`],
      options: { custom: value => (value === `2024-12` ? null : undefined) },
      expected: {
        source: `[Temporal.PlainYearMonth.from("2024-12"),,]`,
        roundtrips: false,
      },
    },
    {
      name: `Temporal.PlainMonthDay`,
      value: Temporal.PlainMonthDay.from(`12-25`),
      expected: { source: `Temporal.PlainMonthDay.from("12-25")` },
    },
    {
      name: `custom Temporal.PlainMonthDay`,
      value: Temporal.PlainMonthDay.from(`12-25`),
      options: {
        custom: (value, uneval) =>
          value instanceof Temporal.PlainMonthDay
            ? `Temporal.PlainMonthDay.from(${uneval({
                monthCode: value.monthCode,
                day: value.day,
              })})`
            : undefined,
      },
      expected: {
        source: `Temporal.PlainMonthDay.from({monthCode:"M12",day:25})`,
      },
    },
    {
      name: `custom string does not affect Temporal.PlainMonthDay`,
      value: Temporal.PlainMonthDay.from(`12-25`),
      options: { custom: customString },
      expected: { source: `Temporal.PlainMonthDay.from("12-25")` },
    },
    {
      name: `custom string does not affect Temporal.PlainMonthDay when string is sibling`,
      value: [Temporal.PlainMonthDay.from(`12-25`), `12-25`],
      options: { custom: customString },
      expected: { source: `[Temporal.PlainMonthDay.from("12-25"),'12-25']` },
    },
    {
      name: `omit string does not affect Temporal.PlainMonthDay`,
      value: Temporal.PlainMonthDay.from(`12-25`),
      options: { custom: value => (value === `12-25` ? null : undefined) },
      expected: { source: `Temporal.PlainMonthDay.from("12-25")` },
    },
    {
      name: `omit string does not affect Temporal.PlainMonthDay when string is sibling`,
      value: [Temporal.PlainMonthDay.from(`12-25`), `12-25`],
      options: { custom: value => (value === `12-25` ? null : undefined) },
      expected: {
        source: `[Temporal.PlainMonthDay.from("12-25"),,]`,
        roundtrips: false,
      },
    },
    {
      name: `Temporal.ZonedDateTime`,
      value: Temporal.ZonedDateTime.from(
        `2024-12-25T13:45:30-05:00[America/New_York]`,
      ),
      expected: {
        source: `new Temporal.ZonedDateTime(1735152330000000000n,"America/New_York")`,
      },
    },
    {
      name: `Temporal.ZonedDateTime at minimum epoch boundary`,
      value: new Temporal.ZonedDateTime(
        -8_640_000_000_000_000_000_000n,
        `Europe/London`,
      ),
      expected: {
        source: `new Temporal.ZonedDateTime(-8640000000000000000000n,"Europe/London")`,
      },
    },
    {
      name: `custom Temporal.ZonedDateTime`,
      value: Temporal.ZonedDateTime.from(
        `2024-12-25T13:45:30-05:00[America/New_York]`,
      ),
      options: {
        custom: (value, uneval) =>
          value instanceof Temporal.ZonedDateTime
            ? `Temporal.ZonedDateTime.from(${uneval({
                year: value.year,
                month: value.month,
                day: value.day,
                hour: value.hour,
                minute: value.minute,
                second: value.second,
                offset: value.offset,
                timeZone: value.timeZoneId,
              })})`
            : undefined,
      },
      expected: {
        source: `Temporal.ZonedDateTime.from({year:2024,month:12,day:25,hour:13,minute:45,second:30,offset:"-05:00",timeZone:"America/New_York"})`,
      },
    },
    {
      name: `custom string does not affect Temporal.ZonedDateTime`,
      value: Temporal.ZonedDateTime.from(
        `2024-12-25T13:45:30-05:00[America/New_York]`,
      ),
      options: { custom: customString },
      expected: {
        source: `new Temporal.ZonedDateTime(1735152330000000000n,"America/New_York")`,
      },
    },
    {
      name: `custom string does not affect Temporal.ZonedDateTime when string is sibling`,
      value: [
        Temporal.ZonedDateTime.from(
          `2024-12-25T13:45:30-05:00[America/New_York]`,
        ),
        `America/New_York`,
      ],
      options: { custom: customString },
      expected: {
        source: `[new Temporal.ZonedDateTime(1735152330000000000n,"America/New_York"),'America/New_York']`,
      },
    },
    {
      name: `omit string does not affect Temporal.ZonedDateTime`,
      value: Temporal.ZonedDateTime.from(
        `2024-12-25T13:45:30-05:00[America/New_York]`,
      ),
      options: {
        custom: value => (value === `America/New_York` ? null : undefined),
      },
      expected: {
        source: `new Temporal.ZonedDateTime(1735152330000000000n,"America/New_York")`,
      },
    },
    {
      name: `omit string does not affect Temporal.ZonedDateTime when string is sibling`,
      value: [
        Temporal.ZonedDateTime.from(
          `2024-12-25T13:45:30-05:00[America/New_York]`,
        ),
        `America/New_York`,
      ],
      options: {
        custom: value => (value === `America/New_York` ? null : undefined),
      },
      expected: {
        source: `[new Temporal.ZonedDateTime(1735152330000000000n,"America/New_York"),,]`,
        roundtrips: false,
      },
    },
    {
      name: `custom bigint does not affect Temporal.ZonedDateTime`,
      value: Temporal.ZonedDateTime.from(
        `2024-12-25T13:45:30-05:00[America/New_York]`,
      ),
      options: { custom: customBigInt },
      expected: {
        source: `new Temporal.ZonedDateTime(1735152330000000000n,"America/New_York")`,
      },
    },
    {
      name: `custom bigint does not affect Temporal.ZonedDateTime when bigint is sibling`,
      value: [
        Temporal.ZonedDateTime.from(
          `2024-12-25T13:45:30-05:00[America/New_York]`,
        ),
        1_735_152_330_000_000_000n,
      ],
      options: { custom: customBigInt },
      expected: {
        source: `[new Temporal.ZonedDateTime(1735152330000000000n,"America/New_York"),BigInt("1735152330000000000")]`,
      },
    },
    {
      name: `omit bigint does not affect Temporal.ZonedDateTime`,
      value: Temporal.ZonedDateTime.from(
        `2024-12-25T13:45:30-05:00[America/New_York]`,
      ),
      options: {
        custom: value =>
          value === 1_735_152_330_000_000_000n ? null : undefined,
      },
      expected: {
        source: `new Temporal.ZonedDateTime(1735152330000000000n,"America/New_York")`,
      },
    },
    {
      name: `omit bigint does not affect Temporal.ZonedDateTime when bigint is sibling`,
      value: [
        Temporal.ZonedDateTime.from(
          `2024-12-25T13:45:30-05:00[America/New_York]`,
        ),
        1_735_152_330_000_000_000n,
      ],
      options: {
        custom: value =>
          value === 1_735_152_330_000_000_000n ? null : undefined,
      },
      expected: {
        source: `[new Temporal.ZonedDateTime(1735152330000000000n,"America/New_York"),,]`,
        roundtrips: false,
      },
    },
    {
      name: `Temporal.Duration`,
      value: Temporal.Duration.from(`P1Y2M3DT4H5M6S`),
      expected: { source: `Temporal.Duration.from("P1Y2M3DT4H5M6S")` },
    },
    {
      name: `Temporal.Duration zero`,
      value: new Temporal.Duration(),
      expected: { source: `Temporal.Duration.from("PT0S")` },
    },
    {
      name: `custom Temporal.Duration`,
      value: Temporal.Duration.from(`P1Y2M3DT4H5M6S`),
      options: {
        custom: (value, uneval) =>
          value instanceof Temporal.Duration
            ? `Temporal.Duration.from(${uneval({
                years: value.years,
                months: value.months,
                days: value.days,
                hours: value.hours,
                minutes: value.minutes,
                seconds: value.seconds,
              })})`
            : undefined,
      },
      expected: {
        source: `Temporal.Duration.from({years:1,months:2,days:3,hours:4,minutes:5,seconds:6})`,
      },
    },
    {
      name: `custom string does not affect Temporal.Duration`,
      value: Temporal.Duration.from(`P1Y2M3DT4H5M6S`),
      options: { custom: customString },
      expected: { source: `Temporal.Duration.from("P1Y2M3DT4H5M6S")` },
    },
    {
      name: `custom string does not affect Temporal.Duration when string is sibling`,
      value: [Temporal.Duration.from(`P1Y2M3DT4H5M6S`), `P1Y2M3DT4H5M6S`],
      options: { custom: customString },
      expected: {
        source: `[Temporal.Duration.from("P1Y2M3DT4H5M6S"),'P1Y2M3DT4H5M6S']`,
      },
    },
    {
      name: `omit string does not affect Temporal.Duration`,
      value: Temporal.Duration.from(`P1Y2M3DT4H5M6S`),
      options: {
        custom: value => (value === `P1Y2M3DT4H5M6S` ? null : undefined),
      },
      expected: { source: `Temporal.Duration.from("P1Y2M3DT4H5M6S")` },
    },
    {
      name: `omit string does not affect Temporal.Duration when string is sibling`,
      value: [Temporal.Duration.from(`P1Y2M3DT4H5M6S`), `P1Y2M3DT4H5M6S`],
      options: {
        custom: value => (value === `P1Y2M3DT4H5M6S` ? null : undefined),
      },
      expected: {
        source: `[Temporal.Duration.from("P1Y2M3DT4H5M6S"),,]`,
        roundtrips: false,
      },
    },
    {
      name: `omit Temporal.Instant from container`,
      value: [Temporal.Instant.from(`2024-12-25T00:00:00Z`), 1],
      options: {
        custom: value => (value instanceof Temporal.Instant ? null : undefined),
      },
      expected: {
        source: `[,1]`,
        roundtrips: false,
      },
    },
  ],

  URL: [
    {
      name: `URL`,
      value: new URL(`https://tomeraberba.ch`),
      expected: { source: `new URL("https://tomeraberba.ch/")` },
    },
    {
      name: `polluted URL`,
      value: (() => {
        const value = new URL(`https://example.com`)
        Object.defineProperty(value, `href`, {
          value: `</script><script src='https://evil.com/hacked.js'>`,
        })
        return value
      })(),
      expected: {
        source: `new URL("https://example.com/")`,
        roundtrips: false,
      },
    },
    {
      name: `custom URL`,
      value: new URL(`https://tomeraberba.ch`),
      options: {
        custom: (value, uneval) =>
          value instanceof URL
            ? `new URL(${uneval(value.pathname)},${uneval(value.origin)})`
            : undefined,
      },
      expected: { source: `new URL("/","https://tomeraberba.ch")` },
    },
    {
      name: `custom string does not affect URL`,
      value: new URL(`https://tomeraberba.ch`),
      options: { custom: customString },
      expected: { source: `new URL("https://tomeraberba.ch/")` },
    },
    {
      name: `custom string does not affect URL when string is sibling`,
      value: [new URL(`https://tomeraberba.ch`), `https://tomeraberba.ch/`],
      options: { custom: customString },
      expected: {
        source: `[new URL("https://tomeraberba.ch/"),'https://tomeraberba.ch/']`,
      },
    },
    {
      name: `omit string does not affect URL`,
      value: new URL(`https://tomeraberba.ch`),
      options: {
        custom: value =>
          value === `https://tomeraberba.ch/` ? null : undefined,
      },
      expected: { source: `new URL("https://tomeraberba.ch/")` },
    },
    {
      name: `omit string does not affect URL when string is sibling`,
      value: [new URL(`https://tomeraberba.ch`), `https://tomeraberba.ch/`],
      options: {
        custom: value =>
          value === `https://tomeraberba.ch/` ? null : undefined,
      },
      expected: {
        source: `[new URL("https://tomeraberba.ch/"),,]`,
        roundtrips: false,
      },
    },
    {
      name: `omit URL from container`,
      value: [new URL(`https://example.com`), 1],
      options: {
        custom: value => (value instanceof URL ? null : undefined),
      },
      expected: {
        source: `[,1]`,
        roundtrips: false,
      },
    },
  ],

  URLSearchParams: [
    {
      name: `empty URLSearchParams`,
      value: new URLSearchParams(),
      expected: { source: `new URLSearchParams` },
    },
    {
      name: `URLSearchParams with one entry`,
      value: new URLSearchParams([[`a`, `b`]]),
      expected: { source: `new URLSearchParams("a=b")` },
    },
    {
      name: `URLSearchParams with two entries`,
      value: new URLSearchParams([
        [`a`, `b`],
        [`c`, `d`],
      ]),
      expected: { source: `new URLSearchParams("a=b&c=d")` },
    },
    {
      name: `URLSearchParams with repeated key`,
      value: new URLSearchParams([
        [`a`, `b`],
        [`a`, `c`],
      ]),
      expected: { source: `new URLSearchParams("a=b&a=c")` },
    },
    {
      name: `polluted URLSearchParams`,
      value: (() => {
        const value = new URLSearchParams(`a=1`)
        value.toString = () =>
          `</script><script src='https://evil.com/hacked.js'>`
        return value
      })(),
      expected: {
        source: `new URLSearchParams("<\\u002fscript><script src='https://evil.com/hacked.js'>")`,
        roundtrips: false,
      },
    },
    {
      name: `custom URLSearchParams`,
      value: new URLSearchParams([[`a`, `b`]]),
      options: {
        custom: (value, uneval) =>
          value instanceof URLSearchParams
            ? `new URLSearchParams(${uneval([...value])})`
            : undefined,
      },
      expected: { source: `new URLSearchParams([["a","b"]])` },
    },
    {
      name: `custom string does not affect URLSearchParams`,
      value: new URLSearchParams([[`a`, `b`]]),
      options: { custom: customString },
      expected: { source: `new URLSearchParams("a=b")` },
    },
    {
      name: `custom string does not affect URLSearchParams when string is sibling`,
      value: [new URLSearchParams([[`a`, `b`]]), `a=b`],
      options: { custom: customString },
      expected: { source: `[new URLSearchParams("a=b"),'a=b']` },
    },
    {
      name: `omit string does not affect URLSearchParams`,
      value: new URLSearchParams([[`a`, `b`]]),
      options: { custom: value => (value === `a=b` ? null : undefined) },
      expected: { source: `new URLSearchParams("a=b")` },
    },
    {
      name: `omit string does not affect URLSearchParams when string is sibling`,
      value: [new URLSearchParams([[`a`, `b`]]), `a=b`],
      options: { custom: value => (value === `a=b` ? null : undefined) },
      expected: {
        source: `[new URLSearchParams("a=b"),,]`,
        roundtrips: false,
      },
    },
    {
      name: `omit URLSearchParams from container`,
      value: [new URLSearchParams(`a=1`), 1],
      options: {
        custom: value => (value instanceof URLSearchParams ? null : undefined),
      },
      expected: {
        source: `[,1]`,
        roundtrips: false,
      },
    },
  ],

  ArrayBuffer: [
    {
      name: `empty non-resizable ArrayBuffer`,
      value: new ArrayBuffer(),
      expected: { source: `new ArrayBuffer` },
    },
    {
      name: `detached empty non-resizable ArrayBuffer`,
      value: (() => {
        const buffer = new ArrayBuffer()
        buffer.transfer()
        return buffer
      })(),
      expected: { source: `(a=>(a.transfer(),a))(new ArrayBuffer)` },
    },
    {
      name: `empty resizable full capacity ArrayBuffer`,
      value: new ArrayBuffer(0, { maxByteLength: 0 }),
      expected: { source: `new ArrayBuffer(0,{maxByteLength:0})` },
    },
    {
      name: `detached empty resizable full capacity ArrayBuffer`,
      value: (() => {
        const buffer = new ArrayBuffer(0, { maxByteLength: 0 })
        buffer.transfer()
        return buffer
      })(),
      expected: {
        source: `(a=>(a.transfer(),a))(new ArrayBuffer(0,{maxByteLength:0}))`,
      },
    },
    {
      name: `empty resizable ArrayBuffer`,
      value: new ArrayBuffer(0, { maxByteLength: 3 }),
      expected: { source: `new ArrayBuffer(0,{maxByteLength:3})` },
    },
    {
      name: `detached empty resizable ArrayBuffer`,
      value: (() => {
        const buffer = new ArrayBuffer(0, { maxByteLength: 3 })
        buffer.transfer()
        return buffer
      })(),
      expected: {
        source: `(a=>(a.transfer(),a))(new ArrayBuffer(0,{maxByteLength:0}))`,
      },
    },
    {
      name: `non-empty non-resizable uninitialized ArrayBuffer`,
      value: new ArrayBuffer(8),
      expected: { source: `new ArrayBuffer(8)` },
    },
    {
      name: `detached non-empty non-resizable uninitialized ArrayBuffer`,
      value: (() => {
        const buffer = new ArrayBuffer(8)
        buffer.transfer()
        return buffer
      })(),
      expected: { source: `(a=>(a.transfer(),a))(new ArrayBuffer)` },
    },
    {
      name: `non-empty non-resizable ArrayBuffer initialized with trailing zeros`,
      value: new Uint8Array([1, 2, 3, 0, 0, 0, 0, 0]).buffer,
      expected: { source: `Uint8Array.of(1,2,3,0,0,0,0,0).buffer` },
    },
    {
      name: `detached non-empty non-resizable ArrayBuffer initialized with trailing zeros`,
      value: (() => {
        const { buffer } = new Uint8Array([1, 2, 3, 0, 0, 0, 0, 0])
        buffer.transfer()
        return buffer
      })(),
      expected: { source: `(a=>(a.transfer(),a))(new ArrayBuffer)` },
    },
    {
      name: `non-empty non-resizable ArrayBuffer initialized with leading and trailing zeros`,
      value: new Uint8Array([0, 2, 3, 0, 0, 0, 0, 0]).buffer,
      expected: { source: `Uint8Array.of(0,2,3,0,0,0,0,0).buffer` },
    },
    {
      name: `detached non-empty non-resizable ArrayBuffer initialized with leading and trailing zeros`,
      value: (() => {
        const { buffer } = new Uint8Array([0, 2, 3, 0, 0, 0, 0, 0])
        buffer.transfer()
        return buffer
      })(),
      expected: { source: `(a=>(a.transfer(),a))(new ArrayBuffer)` },
    },
    {
      name: `non-empty non-resizable ArrayBuffer initialized with leading zeros`,
      value: new Uint8Array([0, 0, 0, 0, 0, 1, 2, 3]).buffer,
      expected: { source: `Uint8Array.of(0,0,0,0,0,1,2,3).buffer` },
    },
    {
      name: `detached non-empty non-resizable ArrayBuffer initialized with leading zeros`,
      value: (() => {
        const { buffer } = new Uint8Array([0, 0, 0, 0, 0, 1, 2, 3])
        buffer.transfer()
        return buffer
      })(),
      expected: { source: `(a=>(a.transfer(),a))(new ArrayBuffer)` },
    },
    {
      name: `non-empty resizable full capacity uninitialized ArrayBuffer`,
      value: new ArrayBuffer(8, { maxByteLength: 8 }),
      expected: { source: `new ArrayBuffer(8,{maxByteLength:8})` },
    },
    {
      name: `detached non-empty resizable full capacity uninitialized ArrayBuffer`,
      value: (() => {
        const buffer = new ArrayBuffer(8, { maxByteLength: 8 })
        buffer.transfer()
        return buffer
      })(),
      expected: {
        source: `(a=>(a.transfer(),a))(new ArrayBuffer(0,{maxByteLength:0}))`,
      },
    },
    {
      name: `non-empty resizable full capacity ArrayBuffer initialized with trailing zeros`,
      value: (() => {
        const buffer = new ArrayBuffer(8, { maxByteLength: 8 })
        new Uint8Array(buffer).set([1, 2, 3])
        return buffer
      })(),
      expected: {
        source: `(a=>(new Uint8Array(a).set([1,2,3]),a))(new ArrayBuffer(8,{maxByteLength:8}))`,
      },
    },
    {
      name: `detached non-empty resizable full capacity ArrayBuffer initialized with trailing zeros`,
      value: (() => {
        const buffer = new ArrayBuffer(8, { maxByteLength: 8 })
        new Uint8Array(buffer).set([1, 2, 3])
        buffer.transfer()
        return buffer
      })(),
      expected: {
        source: `(a=>(a.transfer(),a))(new ArrayBuffer(0,{maxByteLength:0}))`,
      },
    },
    {
      name: `non-empty resizable full capacity ArrayBuffer initialized with leading and trailing zeros`,
      value: (() => {
        const buffer = new ArrayBuffer(8, { maxByteLength: 8 })
        new Uint8Array(buffer).set([0, 0, 1, 2, 3])
        return buffer
      })(),
      expected: {
        source: `(a=>(new Uint8Array(a).set([1,2,3],2),a))(new ArrayBuffer(8,{maxByteLength:8}))`,
      },
    },
    {
      name: `detached non-empty resizable full capacity ArrayBuffer initialized with leading and trailing zeros`,
      value: (() => {
        const buffer = new ArrayBuffer(8, { maxByteLength: 8 })
        new Uint8Array(buffer).set([0, 0, 1, 2, 3])
        buffer.transfer()
        return buffer
      })(),
      expected: {
        source: `(a=>(a.transfer(),a))(new ArrayBuffer(0,{maxByteLength:0}))`,
      },
    },
    {
      name: `non-empty resizable full capacity ArrayBuffer initialized with leading zeros`,
      value: (() => {
        const buffer = new ArrayBuffer(8, { maxByteLength: 8 })
        new Uint8Array(buffer).set([0, 0, 0, 0, 0, 1, 2, 3])
        return buffer
      })(),
      expected: {
        source: `(a=>(new Uint8Array(a).set([1,2,3],5),a))(new ArrayBuffer(8,{maxByteLength:8}))`,
      },
    },
    {
      name: `detached non-empty resizable full capacity ArrayBuffer initialized with leading zeros`,
      value: (() => {
        const buffer = new ArrayBuffer(8, { maxByteLength: 8 })
        new Uint8Array(buffer).set([0, 0, 0, 0, 0, 1, 2, 3])
        buffer.transfer()
        return buffer
      })(),
      expected: {
        source: `(a=>(a.transfer(),a))(new ArrayBuffer(0,{maxByteLength:0}))`,
      },
    },
    {
      name: `non-empty resizable uninitialized ArrayBuffer`,
      value: new ArrayBuffer(8, { maxByteLength: 10 }),
      expected: { source: `new ArrayBuffer(8,{maxByteLength:10})` },
    },
    {
      name: `detached non-empty resizable uninitialized ArrayBuffer`,
      value: (() => {
        const buffer = new ArrayBuffer(8, { maxByteLength: 10 })
        buffer.transfer()
        return buffer
      })(),
      expected: {
        source: `(a=>(a.transfer(),a))(new ArrayBuffer(0,{maxByteLength:0}))`,
      },
    },
    {
      name: `non-empty resizable ArrayBuffer initialized with trailing zeros`,
      value: (() => {
        const buffer = new ArrayBuffer(8, { maxByteLength: 10 })
        new Uint8Array(buffer).set([1, 2, 3])
        return buffer
      })(),
      expected: {
        source: `(a=>(new Uint8Array(a).set([1,2,3]),a))(new ArrayBuffer(8,{maxByteLength:10}))`,
      },
    },
    {
      name: `detached non-empty resizable ArrayBuffer initialized with trailing zeros`,
      value: (() => {
        const buffer = new ArrayBuffer(8, { maxByteLength: 10 })
        new Uint8Array(buffer).set([1, 2, 3])
        buffer.transfer()
        return buffer
      })(),
      expected: {
        source: `(a=>(a.transfer(),a))(new ArrayBuffer(0,{maxByteLength:0}))`,
      },
    },
    {
      name: `non-empty resizable ArrayBuffer initialized with leading and trailing zeros`,
      value: (() => {
        const buffer = new ArrayBuffer(8, { maxByteLength: 10 })
        new Uint8Array(buffer).set([0, 0, 1, 2, 3])
        return buffer
      })(),
      expected: {
        source: `(a=>(new Uint8Array(a).set([1,2,3],2),a))(new ArrayBuffer(8,{maxByteLength:10}))`,
      },
    },
    {
      name: `detached non-empty resizable ArrayBuffer initialized with leading and trailing zeros`,
      value: (() => {
        const buffer = new ArrayBuffer(8, { maxByteLength: 10 })
        new Uint8Array(buffer).set([0, 0, 1, 2, 3])
        buffer.transfer()
        return buffer
      })(),
      expected: {
        source: `(a=>(a.transfer(),a))(new ArrayBuffer(0,{maxByteLength:0}))`,
      },
    },
    {
      name: `non-empty resizable ArrayBuffer initialized with leading zeros`,
      value: (() => {
        const buffer = new ArrayBuffer(8, { maxByteLength: 10 })
        new Uint8Array(buffer).set([0, 0, 0, 0, 0, 1, 2, 3])
        return buffer
      })(),
      expected: {
        source: `(a=>(new Uint8Array(a).set([1,2,3],5),a))(new ArrayBuffer(8,{maxByteLength:10}))`,
      },
    },
    {
      name: `detached non-empty resizable ArrayBuffer initialized with leading zeros`,
      value: (() => {
        const buffer = new ArrayBuffer(8, { maxByteLength: 10 })
        new Uint8Array(buffer).set([0, 0, 0, 0, 0, 1, 2, 3])
        buffer.transfer()
        return buffer
      })(),
      expected: {
        source: `(a=>(a.transfer(),a))(new ArrayBuffer(0,{maxByteLength:0}))`,
      },
    },
    {
      name: `polluted ArrayBuffer resizable with all zeros`,
      value: (() => {
        const buffer = new ArrayBuffer(4)
        Object.defineProperty(buffer, `resizable`, { value: true })
        Object.defineProperty(buffer, `byteLength`, { value: `alert('XSS')` })
        Object.defineProperty(buffer, `maxByteLength`, {
          value: `0}); alert('XSS')//`,
        })
        return buffer
      })(),
      expected: {
        source: `new ArrayBuffer(NaN,{maxByteLength:NaN})`,
        roundtrips: false,
      },
    },
    {
      name: `polluted ArrayBuffer resizable with non-zero values`,
      value: (() => {
        const buffer = new ArrayBuffer(8, { maxByteLength: 10 })
        new Uint8Array(buffer).set([1, 2, 3])
        Object.defineProperty(buffer, `maxByteLength`, {
          value: `</script><script src='https://evil.com/hacked.js'>`,
        })
        return buffer
      })(),
      expected: {
        source: `(a=>(new Uint8Array(a).set([1,2,3]),a))(new ArrayBuffer(8,{maxByteLength:NaN}))`,
        roundtrips: false,
      },
    },
    {
      name: `custom ArrayBuffer`,
      value: new Uint8Array([1, 2, 3]).buffer,
      options: {
        custom: (value, uneval) =>
          value instanceof ArrayBuffer
            ? `new Uint8Array(${uneval([...new Uint8Array(value)])}).buffer`
            : undefined,
      },
      expected: { source: `new Uint8Array([1,2,3]).buffer` },
    },
    {
      name: `custom number does not affect ArrayBuffer`,
      value: new Uint8Array([0, 0, 0, 0, 0, 1, 2, 3]).buffer,
      options: { custom: customNumber },
      expected: { source: `Uint8Array.of(0,0,0,0,0,1,2,3).buffer` },
    },
    {
      name: `custom number does not affect ArrayBuffer when number is sibling`,
      value: [new Uint8Array([0, 0, 0, 0, 0, 1, 2, 3]).buffer, 0],
      options: { custom: customNumber },
      expected: { source: `[Uint8Array.of(0,0,0,0,0,1,2,3).buffer,0.0]` },
    },
    {
      name: `omit number does not affect ArrayBuffer`,
      value: new Uint8Array([0, 0, 0, 0, 0, 1, 2, 3]).buffer,
      options: { custom: value => (value === 0 ? null : undefined) },
      expected: { source: `Uint8Array.of(0,0,0,0,0,1,2,3).buffer` },
    },
    {
      name: `omit number does not affect ArrayBuffer when number is sibling`,
      value: [new Uint8Array([0, 0, 0, 0, 0, 1, 2, 3]).buffer, 0],
      options: { custom: value => (value === 0 ? null : undefined) },
      expected: {
        source: `[Uint8Array.of(0,0,0,0,0,1,2,3).buffer,,]`,
        roundtrips: false,
      },
    },
    {
      name: `omit ArrayBuffer from container`,
      value: [new ArrayBuffer(4), 1],
      options: {
        custom: value => (value instanceof ArrayBuffer ? null : undefined),
      },
      expected: {
        source: `[,1]`,
        roundtrips: false,
      },
    },
  ],

  DataView: [
    {
      name: `empty non-resizable DataView`,
      value: new DataView(new ArrayBuffer()),
      expected: { source: `new DataView(new ArrayBuffer)` },
    },
    {
      name: `empty non-resizable DataView containing non-empty ArrayBuffer`,
      value: new DataView(new ArrayBuffer(1), 0, 0),
      expected: { source: `new DataView(new ArrayBuffer(1),0,0)` },
    },
    {
      name: `empty resizable full capacity DataView`,
      value: new DataView(new ArrayBuffer(0, { maxByteLength: 0 })),
      expected: {
        source: `new DataView(new ArrayBuffer(0,{maxByteLength:0}))`,
      },
    },
    {
      name: `empty resizable DataView`,
      value: new DataView(new ArrayBuffer(0, { maxByteLength: 3 })),
      expected: {
        source: `new DataView(new ArrayBuffer(0,{maxByteLength:3}))`,
      },
    },
    {
      name: `non-empty non-resizable uninitialized DataView`,
      value: new DataView(new ArrayBuffer(8)),
      expected: { source: `new DataView(new ArrayBuffer(8))` },
    },
    {
      name: `non-empty non-resizable DataView initialized with trailing zeros`,
      value: new DataView(new Uint8Array([1, 2, 3, 0, 0, 0, 0, 0]).buffer),
      expected: {
        source: `new DataView(Uint8Array.of(1,2,3,0,0,0,0,0).buffer)`,
      },
    },
    {
      name: `non-empty non-resizable DataView initialized with leading and trailing zeros`,
      value: new DataView(new Uint8Array([0, 2, 3, 0, 0, 0, 0, 0]).buffer),
      expected: {
        source: `new DataView(Uint8Array.of(0,2,3,0,0,0,0,0).buffer)`,
      },
    },
    {
      name: `non-empty non-resizable DataView initialized with leading zeros`,
      value: new DataView(new Uint8Array([0, 0, 0, 0, 0, 1, 2, 3]).buffer),
      expected: {
        source: `new DataView(Uint8Array.of(0,0,0,0,0,1,2,3).buffer)`,
      },
    },
    {
      name: `non-empty resizable full capacity uninitialized DataView`,
      value: new DataView(new ArrayBuffer(8, { maxByteLength: 8 })),
      expected: {
        source: `new DataView(new ArrayBuffer(8,{maxByteLength:8}))`,
      },
    },
    {
      name: `non-empty resizable full capacity DataView initialized with trailing zeros`,
      value: (() => {
        const arrayBuffer = new ArrayBuffer(8, { maxByteLength: 8 })
        new Uint8Array(arrayBuffer).set([1, 2, 3])
        return new DataView(arrayBuffer)
      })(),
      expected: {
        source: `(a=>(new Uint8Array(a).set([1,2,3]),new DataView(a)))(new ArrayBuffer(8,{maxByteLength:8}))`,
      },
    },
    {
      name: `non-empty resizable full capacity DataView initialized with leading and trailing zeros`,
      value: (() => {
        const arrayBuffer = new ArrayBuffer(8, { maxByteLength: 8 })
        new Uint8Array(arrayBuffer).set([0, 0, 1, 2, 3])
        return new DataView(arrayBuffer)
      })(),
      expected: {
        source: `(a=>(new Uint8Array(a).set([1,2,3],2),new DataView(a)))(new ArrayBuffer(8,{maxByteLength:8}))`,
      },
    },
    {
      name: `non-empty resizable full capacity DataView initialized with leading zeros`,
      value: (() => {
        const arrayBuffer = new ArrayBuffer(8, { maxByteLength: 8 })
        new Uint8Array(arrayBuffer).set([0, 0, 0, 0, 0, 1, 2, 3])
        return new DataView(arrayBuffer)
      })(),
      expected: {
        source: `(a=>(new Uint8Array(a).set([1,2,3],5),new DataView(a)))(new ArrayBuffer(8,{maxByteLength:8}))`,
      },
    },
    {
      name: `non-empty resizable uninitialized DataView`,
      value: new DataView(new ArrayBuffer(8, { maxByteLength: 10 })),
      expected: {
        source: `new DataView(new ArrayBuffer(8,{maxByteLength:10}))`,
      },
    },
    {
      name: `non-empty resizable DataView initialized with trailing zeros`,
      value: (() => {
        const arrayBuffer = new ArrayBuffer(8, { maxByteLength: 10 })
        new Uint8Array(arrayBuffer).set([1, 2, 3])
        return new DataView(arrayBuffer)
      })(),
      expected: {
        source: `(a=>(new Uint8Array(a).set([1,2,3]),new DataView(a)))(new ArrayBuffer(8,{maxByteLength:10}))`,
      },
    },
    {
      name: `non-empty resizable DataView initialized with leading and trailing zeros`,
      value: (() => {
        const arrayBuffer = new ArrayBuffer(8, { maxByteLength: 10 })
        new Uint8Array(arrayBuffer).set([0, 0, 1, 2, 3])
        return new DataView(arrayBuffer)
      })(),
      expected: {
        source: `(a=>(new Uint8Array(a).set([1,2,3],2),new DataView(a)))(new ArrayBuffer(8,{maxByteLength:10}))`,
      },
    },
    {
      name: `non-empty resizable DataView initialized with leading zeros`,
      value: (() => {
        const arrayBuffer = new ArrayBuffer(8, { maxByteLength: 10 })
        new Uint8Array(arrayBuffer).set([0, 0, 0, 0, 0, 1, 2, 3])
        return new DataView(arrayBuffer)
      })(),
      expected: {
        source: `(a=>(new Uint8Array(a).set([1,2,3],5),new DataView(a)))(new ArrayBuffer(8,{maxByteLength:10}))`,
      },
    },
    {
      name: `leading DataView view`,
      value: new DataView(new ArrayBuffer(4), 0, 3),
      expected: { source: `new DataView(new ArrayBuffer(4),0,3)` },
    },
    {
      name: `middle DataView view`,
      value: new DataView(new ArrayBuffer(4), 1, 2),
      expected: { source: `new DataView(new ArrayBuffer(4),1,2)` },
    },
    {
      name: `trailing DataView view`,
      value: new DataView(new ArrayBuffer(4), 1, 3),
      expected: { source: `new DataView(new ArrayBuffer(4),1)` },
    },
    {
      name: `polluted DataView byteOffset`,
      value: (() => {
        const buffer = new DataView(new ArrayBuffer(4), 1, 2)
        Object.defineProperty(buffer, `byteOffset`, {
          value: `</script><script src='https://evil.com/hacked.js'>`,
        })
        return buffer
      })(),
      expected: {
        source: `new DataView(new ArrayBuffer(4),NaN,2)`,
        roundtrips: false,
      },
    },
    {
      name: `custom DataView`,
      value: new DataView(new Uint8Array([1, 2, 3, 4]).buffer),
      options: {
        custom: (value, uneval) =>
          value instanceof DataView
            ? `new DataView(${uneval(new Uint16Array(value.buffer))})`
            : undefined,
      },
      expected: {
        source: `new DataView(Uint16Array.of(513,1027))`,
        roundtrips: false,
      },
    },
    {
      name: `custom number does not affect DataView`,
      value: new DataView(new Uint8Array([0, 0, 0, 0, 0, 1, 2, 3]).buffer),
      options: { custom: customNumber },
      expected: {
        source: `new DataView(Uint8Array.of(0,0,0,0,0,1,2,3).buffer)`,
      },
    },
    {
      name: `custom number does not affect DataView when number is sibling`,
      value: [new DataView(new Uint8Array([0, 0, 0, 0, 0, 1, 2, 3]).buffer), 0],
      options: { custom: customNumber },
      expected: {
        source: `[new DataView(Uint8Array.of(0,0,0,0,0,1,2,3).buffer),0.0]`,
      },
    },
    {
      name: `omit number does not affect DataView`,
      value: new DataView(new Uint8Array([0, 0, 0, 0, 0, 1, 2, 3]).buffer),
      options: { custom: value => (value === 0 ? null : undefined) },
      expected: {
        source: `new DataView(Uint8Array.of(0,0,0,0,0,1,2,3).buffer)`,
      },
    },
    {
      name: `omit number does not affect DataView when number is sibling`,
      value: [new DataView(new Uint8Array([0, 0, 0, 0, 0, 1, 2, 3]).buffer), 0],
      options: { custom: value => (value === 0 ? null : undefined) },
      expected: {
        source: `[new DataView(Uint8Array.of(0,0,0,0,0,1,2,3).buffer),,]`,
        roundtrips: false,
      },
    },
    {
      name: `custom ArrayBuffer affects DataView`,
      value: new DataView(new Uint8Array([1, 2, 3]).buffer),
      options: {
        custom: (value, uneval) =>
          value instanceof ArrayBuffer
            ? `new Uint8Array(${uneval([...new Uint8Array(value)])}).buffer`
            : undefined,
      },
      expected: { source: `new DataView(new Uint8Array([1,2,3]).buffer)` },
    },
    {
      name: `omit DataView from container`,
      value: [new DataView(new ArrayBuffer()), 1],
      options: {
        custom: value => (ArrayBuffer.isView(value) ? null : undefined),
      },
      expected: {
        source: `[,1]`,
        roundtrips: false,
      },
    },
  ],

  Buffer: [
    {
      name: `empty non-resizable Buffer`,
      value: Buffer.from([]),
      expected: { source: `Buffer.alloc(0)` },
    },
    {
      name: `empty non-resizable Buffer containing non-empty ArrayBuffer`,
      value: Buffer.from(new ArrayBuffer(1), 0, 0),
      expected: { source: `Buffer.from(new ArrayBuffer(1),0,0)` },
    },
    {
      name: `empty resizable full capacity Buffer`,
      value: Buffer.from(new ArrayBuffer(0, { maxByteLength: 0 })),
      expected: { source: `Buffer.from(new ArrayBuffer(0,{maxByteLength:0}))` },
    },
    {
      name: `empty resizable Buffer`,
      value: Buffer.from(new ArrayBuffer(0, { maxByteLength: 3 })),
      expected: { source: `Buffer.from(new ArrayBuffer(0,{maxByteLength:3}))` },
    },
    {
      name: `non-empty non-resizable uninitialized Buffer`,
      value: Buffer.from(new ArrayBuffer(8)),
      expected: { source: `Buffer.from(new ArrayBuffer(8))` },
    },
    {
      name: `non-empty non-resizable Buffer initialized with trailing zeros`,
      value: Buffer.from(new Uint8Array([1, 2, 3, 0, 0, 0, 0, 0]).buffer),
      expected: {
        source: `Buffer.from(Uint8Array.of(1,2,3,0,0,0,0,0).buffer)`,
      },
    },
    {
      name: `non-empty non-resizable Buffer initialized with leading and trailing zeros`,
      value: Buffer.from(new Uint8Array([0, 2, 3, 0, 0, 0, 0, 0]).buffer),
      expected: {
        source: `Buffer.from(Uint8Array.of(0,2,3,0,0,0,0,0).buffer)`,
      },
    },
    {
      name: `non-empty non-resizable Buffer initialized with leading zeros`,
      value: Buffer.from(new Uint8Array([0, 0, 0, 0, 0, 1, 2, 3]).buffer),
      expected: {
        source: `Buffer.from(Uint8Array.of(0,0,0,0,0,1,2,3).buffer)`,
      },
    },
    {
      name: `non-empty resizable full capacity uninitialized Buffer`,
      value: Buffer.from(new ArrayBuffer(8, { maxByteLength: 8 })),
      expected: { source: `Buffer.from(new ArrayBuffer(8,{maxByteLength:8}))` },
    },
    {
      name: `non-empty resizable full capacity Buffer initialized with trailing zeros`,
      value: (() => {
        const arrayBuffer = new ArrayBuffer(8, { maxByteLength: 8 })
        new Uint8Array(arrayBuffer).set([1, 2, 3])
        return Buffer.from(arrayBuffer)
      })(),
      expected: {
        source: `(a=>(new Uint8Array(a).set([1,2,3]),Buffer.from(a)))(new ArrayBuffer(8,{maxByteLength:8}))`,
      },
    },
    {
      name: `non-empty resizable full capacity Buffer initialized with leading and trailing zeros`,
      value: (() => {
        const arrayBuffer = new ArrayBuffer(8, { maxByteLength: 8 })
        new Uint8Array(arrayBuffer).set([0, 0, 1, 2, 3])
        return Buffer.from(arrayBuffer)
      })(),
      expected: {
        source: `(a=>(new Uint8Array(a).set([1,2,3],2),Buffer.from(a)))(new ArrayBuffer(8,{maxByteLength:8}))`,
      },
    },
    {
      name: `non-empty resizable full capacity Buffer initialized with leading zeros`,
      value: (() => {
        const arrayBuffer = new ArrayBuffer(8, { maxByteLength: 8 })
        new Uint8Array(arrayBuffer).set([0, 0, 0, 0, 0, 1, 2, 3])
        return Buffer.from(arrayBuffer)
      })(),
      expected: {
        source: `(a=>(new Uint8Array(a).set([1,2,3],5),Buffer.from(a)))(new ArrayBuffer(8,{maxByteLength:8}))`,
      },
    },
    {
      name: `non-empty resizable uninitialized Buffer`,
      value: Buffer.from(new ArrayBuffer(8, { maxByteLength: 10 })),
      expected: {
        source: `Buffer.from(new ArrayBuffer(8,{maxByteLength:10}))`,
      },
    },
    {
      name: `non-empty resizable Buffer initialized with trailing zeros`,
      value: (() => {
        const arrayBuffer = new ArrayBuffer(8, { maxByteLength: 10 })
        new Uint8Array(arrayBuffer).set([1, 2, 3])
        return Buffer.from(arrayBuffer)
      })(),
      expected: {
        source: `(a=>(new Uint8Array(a).set([1,2,3]),Buffer.from(a)))(new ArrayBuffer(8,{maxByteLength:10}))`,
      },
    },
    {
      name: `non-empty resizable Buffer initialized with leading and trailing zeros`,
      value: (() => {
        const arrayBuffer = new ArrayBuffer(8, { maxByteLength: 10 })
        new Uint8Array(arrayBuffer).set([0, 0, 1, 2, 3])
        return Buffer.from(arrayBuffer)
      })(),
      expected: {
        source: `(a=>(new Uint8Array(a).set([1,2,3],2),Buffer.from(a)))(new ArrayBuffer(8,{maxByteLength:10}))`,
      },
    },
    {
      name: `non-empty resizable Buffer initialized with leading zeros`,
      value: (() => {
        const arrayBuffer = new ArrayBuffer(8, { maxByteLength: 10 })
        new Uint8Array(arrayBuffer).set([0, 0, 0, 0, 0, 1, 2, 3])
        return Buffer.from(arrayBuffer)
      })(),
      expected: {
        source: `(a=>(new Uint8Array(a).set([1,2,3],5),Buffer.from(a)))(new ArrayBuffer(8,{maxByteLength:10}))`,
      },
    },
    {
      name: `leading Buffer view`,
      value: Buffer.from(new ArrayBuffer(4), 0, 3),
      expected: { source: `Buffer.from(new ArrayBuffer(4),0,3)` },
    },
    {
      name: `middle Buffer view`,
      value: Buffer.from(new ArrayBuffer(4), 1, 2),
      expected: { source: `Buffer.from(new ArrayBuffer(4),1,2)` },
    },
    {
      name: `trailing Buffer view`,
      value: Buffer.from(new ArrayBuffer(4), 1, 3),
      expected: { source: `Buffer.from(new ArrayBuffer(4),1)` },
    },
    {
      name: `polluted Buffer byteOffset`,
      value: (() => {
        const buffer = Buffer.from(new ArrayBuffer(4), 1, 2)
        Object.defineProperty(buffer, `byteOffset`, {
          value: `</script><script src='https://evil.com/hacked.js'>`,
        })
        return buffer
      })(),
      expected: {
        source: `Buffer.from(new ArrayBuffer(4),NaN,2)`,
        roundtrips: false,
      },
    },
    {
      name: `custom Buffer`,
      value: Buffer.from(new Uint8Array([1, 2, 3]).buffer),
      options: {
        custom: (value, uneval) =>
          Buffer.isBuffer(value)
            ? `Buffer.from(${uneval([...value])})`
            : undefined,
      },
      expected: {
        source: `Buffer.from([1,2,3])`,
        roundtrips: false,
      },
    },
    {
      name: `custom number does not affect Buffer`,
      value: Buffer.from(new Uint8Array([0, 0, 0, 0, 0, 1, 2, 3]).buffer),
      options: { custom: customNumber },
      expected: {
        source: `Buffer.from(Uint8Array.of(0,0,0,0,0,1,2,3).buffer)`,
      },
    },
    {
      name: `custom number does not affect Buffer when number is sibling`,
      value: [Buffer.from(new Uint8Array([0, 0, 0, 0, 0, 1, 2, 3]).buffer), 0],
      options: { custom: customNumber },
      expected: {
        source: `[Buffer.from(Uint8Array.of(0,0,0,0,0,1,2,3).buffer),0.0]`,
      },
    },
    {
      name: `omit number does not affect Buffer`,
      value: Buffer.from(new Uint8Array([0, 0, 0, 0, 0, 1, 2, 3]).buffer),
      options: { custom: value => (value === 0 ? null : undefined) },
      expected: {
        source: `Buffer.from(Uint8Array.of(0,0,0,0,0,1,2,3).buffer)`,
      },
    },
    {
      name: `omit number does not affect Buffer when number is sibling`,
      value: [Buffer.from(new Uint8Array([0, 0, 0, 0, 0, 1, 2, 3]).buffer), 0],
      options: { custom: value => (value === 0 ? null : undefined) },
      expected: {
        source: `[Buffer.from(Uint8Array.of(0,0,0,0,0,1,2,3).buffer),,]`,
        roundtrips: false,
      },
    },
    {
      name: `custom ArrayBuffer affects Buffer`,
      value: Buffer.from(new Uint8Array([1, 2, 3]).buffer),
      options: {
        custom: (value, uneval) =>
          value instanceof ArrayBuffer
            ? `new Uint8Array(${uneval([...new Uint8Array(value)])}).buffer`
            : undefined,
      },
      expected: { source: `Buffer.from(new Uint8Array([1,2,3]).buffer)` },
    },
    {
      name: `Buffer backed by pool-sized ArrayBuffer does not expose pool data`,
      value: (() => {
        const poolSizeBuffer = new ArrayBuffer(Buffer.poolSize)
        new Uint8Array(poolSizeBuffer).set([1, 2, 3], 5)
        return Buffer.from(poolSizeBuffer, 5, 3)
      })(),
      expected: {
        source: `Buffer.from(Uint8Array.of(1,2,3).buffer)`,
        roundtrips: false,
      },
    },
    {
      name: `zero-filled Buffer backed by pool-sized ArrayBuffer does not expose pool data`,
      value: (() => {
        const poolSizeBuffer = new ArrayBuffer(Buffer.poolSize)
        new Uint8Array(poolSizeBuffer).set([0xff, 0xff, 0xff])
        return Buffer.from(poolSizeBuffer, 5, 3)
      })(),
      expected: {
        source: `Buffer.from(new ArrayBuffer(3))`,
        roundtrips: false,
      },
    },
    {
      name: `Buffer backed by pool-sized ArrayBuffer with binding exposes full buffer`,
      value: (() => {
        const poolSizeBuffer = new ArrayBuffer(Buffer.poolSize)
        return [Buffer.from(poolSizeBuffer, 5, 3), poolSizeBuffer]
      })(),
      expected: {
        source: `(a=>[Buffer.from(a,5,3),a])(new ArrayBuffer(${Buffer.poolSize}))`,
      },
    },
    {
      name: `omit Buffer from container`,
      value: [Buffer.alloc(4), 1],
      options: {
        custom: value => (Buffer.isBuffer(value) ? null : undefined),
      },
      expected: {
        source: `[,1]`,
        roundtrips: false,
      },
    },
  ],

  Int8Array: [
    {
      name: `empty Int8Array`,
      value: new Int8Array(),
      expected: { source: `new Int8Array` },
    },
    {
      name: `non-empty uninitialized Int8Array`,
      value: new Int8Array(1024),
      expected: { source: `new Int8Array(1024)` },
    },
    {
      name: `non-empty initialized Int8Array`,
      value: new Int8Array([1, -2, 3, 4]),
      expected: { source: `Int8Array.of(1,-2,3,4)` },
    },
    {
      name: `leading Int8Array view`,
      value: new Int8Array(new ArrayBuffer(4), 0, 3),
      expected: { source: `new Int8Array(new ArrayBuffer(4),0,3)` },
    },
    {
      name: `middle Int8Array view`,
      value: new Int8Array(new ArrayBuffer(4), 1, 2),
      expected: { source: `new Int8Array(new ArrayBuffer(4),1,2)` },
    },
    {
      name: `trailing Int8Array view`,
      value: new Int8Array(new ArrayBuffer(4), 1, 3),
      expected: { source: `new Int8Array(new ArrayBuffer(4),1)` },
    },
    {
      name: `resizable Int8Array`,
      value: new Int8Array(new ArrayBuffer(0, { maxByteLength: 1 })),
      expected: {
        source: `new Int8Array(new ArrayBuffer(0,{maxByteLength:1}))`,
      },
    },
    {
      name: `Int8Array with shared buffer reference`,
      value: (() => {
        const buffer = new ArrayBuffer()
        return [new Int8Array(buffer), new Int8Array(buffer)]
      })(),
      expected: {
        source: `(a=>[new Int8Array(a),new Int8Array(a)])(new ArrayBuffer)`,
      },
    },
    {
      name: `detached Int8Array`,
      value: (() => {
        const typedArray = new Int8Array()
        typedArray.buffer.transfer()
        return typedArray
      })(),
      expected: {
        source: `(a=>(a.buffer.transfer(),a))(new Int8Array)`,
      },
    },
    {
      name: `polluted Int8Array byteOffset`,
      value: (() => {
        const array = new Int8Array(new ArrayBuffer(4), 1, 2)
        Object.defineProperty(array, `byteOffset`, {
          value: `</script><script src='https://evil.com/hacked.js'>`,
        })
        return array
      })(),
      expected: {
        source: `new Int8Array(new ArrayBuffer(4),NaN,2)`,
        roundtrips: false,
      },
    },
    {
      name: `polluted Int8Array subclass`,
      value: (() => {
        class Evil extends Int8Array {}
        Object.defineProperty(Evil, `name`, {
          value: `</script><script>alert(1)//`,
        })
        return new Evil(1)
      })(),
      expected: {
        source: `new Int8Array(1)`,
        roundtrips: false,
      },
    },
    {
      name: `custom Int8Array`,
      value: new Int8Array([1, -2, 3, 4]),
      options: {
        custom: (value, uneval) =>
          value instanceof Int8Array
            ? `new Int8Array(${uneval([...value])})`
            : undefined,
      },
      expected: { source: `new Int8Array([1,-2,3,4])` },
    },
    {
      name: `custom number does not affect Int8Array`,
      value: new Int8Array([0, 0, 0, 0, 0, 1, 2, 3]),
      options: { custom: customNumber },
      expected: { source: `Int8Array.of(0,0,0,0,0,1,2,3)` },
    },
    {
      name: `custom number does not affect Int8Array when number is sibling`,
      value: [new Int8Array([0, 0, 0, 0, 0, 1, 2, 3]), 0],
      options: { custom: customNumber },
      expected: { source: `[Int8Array.of(0,0,0,0,0,1,2,3),0.0]` },
    },
    {
      name: `omit number does not affect Int8Array`,
      value: new Int8Array([0, 0, 0, 0, 0, 1, 2, 3]),
      options: { custom: value => (value === 0 ? null : undefined) },
      expected: { source: `Int8Array.of(0,0,0,0,0,1,2,3)` },
    },
    {
      name: `omit number does not affect Int8Array when number is sibling`,
      value: [new Int8Array([0, 0, 0, 0, 0, 1, 2, 3]), 0],
      options: { custom: value => (value === 0 ? null : undefined) },
      expected: {
        source: `[Int8Array.of(0,0,0,0,0,1,2,3),,]`,
        roundtrips: false,
      },
    },
    {
      name: `custom ArrayBuffer affects Int8Array`,
      value: new Int8Array(new Uint8Array([1, 2, 3]).buffer),
      options: {
        custom: (value, uneval) =>
          value instanceof ArrayBuffer
            ? `new Uint8Array(${uneval([...new Uint8Array(value)])}).buffer`
            : undefined,
      },
      expected: { source: `new Int8Array(new Uint8Array([1,2,3]).buffer)` },
    },
    {
      name: `Int8Array view backed by pool-sized ArrayBuffer does not expose pool data`,
      value: (() => {
        const poolSizeBuffer = new ArrayBuffer(Buffer.poolSize)
        const arr = new Int8Array(poolSizeBuffer, 5, 3)
        arr[0] = 1
        arr[1] = 2
        arr[2] = 3
        return arr
      })(),
      expected: {
        source: `new Int8Array(Uint8Array.of(1,2,3).buffer)`,
        roundtrips: false,
      },
    },
    {
      name: `omit TypedArray from container`,
      value: [new Uint8Array([1, 2, 3]), 1],
      options: {
        custom: value =>
          value instanceof Uint8Array && !Buffer.isBuffer(value)
            ? null
            : undefined,
      },
      expected: {
        source: `[,1]`,
        roundtrips: false,
      },
    },
    {
      name: `omit ArrayBuffer cascades to TypedArray`,
      value: (() => {
        const buffer = new ArrayBuffer(4)
        return [new Uint8Array(buffer), 1]
      })(),
      options: {
        custom: value => (value instanceof ArrayBuffer ? null : undefined),
      },
      expected: {
        source: `[,1]`,
        roundtrips: false,
      },
    },
  ],

  Uint8Array: [
    {
      name: `empty Uint8Array`,
      value: new Uint8Array(),
      expected: { source: `new Uint8Array` },
    },
    {
      name: `non-empty uninitialized Uint8Array`,
      value: new Uint8Array(1024),
      expected: { source: `new Uint8Array(1024)` },
    },
    {
      name: `non-empty initialized Uint8Array`,
      value: new Uint8Array([1, 2, 3, 4]),
      expected: { source: `Uint8Array.of(1,2,3,4)` },
    },
    {
      name: `leading Uint8Array view`,
      value: new Uint8Array(new ArrayBuffer(4), 0, 3),
      expected: { source: `new Uint8Array(new ArrayBuffer(4),0,3)` },
    },
    {
      name: `middle Uint8Array view`,
      value: new Uint8Array(new ArrayBuffer(4), 1, 2),
      expected: { source: `new Uint8Array(new ArrayBuffer(4),1,2)` },
    },
    {
      name: `trailing Uint8Array view`,
      value: new Uint8Array(new ArrayBuffer(4), 1, 3),
      expected: { source: `new Uint8Array(new ArrayBuffer(4),1)` },
    },
    {
      name: `resizable Uint8Array`,
      value: new Uint8Array(new ArrayBuffer(0, { maxByteLength: 1 })),
      expected: {
        source: `new Uint8Array(new ArrayBuffer(0,{maxByteLength:1}))`,
      },
    },
    {
      name: `Uint8Array with shared buffer reference`,
      value: (() => {
        const buffer = new ArrayBuffer()
        return [new Uint8Array(buffer), new Uint8Array(buffer)]
      })(),
      expected: {
        source: `(a=>[new Uint8Array(a),new Uint8Array(a)])(new ArrayBuffer)`,
      },
    },
    {
      name: `detached Uint8Array`,
      value: (() => {
        const typedArray = new Uint8Array()
        typedArray.buffer.transfer()
        return typedArray
      })(),
      expected: {
        source: `(a=>(a.buffer.transfer(),a))(new Uint8Array)`,
      },
    },
    {
      name: `polluted Uint8Array byteOffset`,
      value: (() => {
        const array = new Uint8Array(new ArrayBuffer(4), 1, 2)
        Object.defineProperty(array, `byteOffset`, {
          value: `</script><script src='https://evil.com/hacked.js'>`,
        })
        return array
      })(),
      expected: {
        source: `new Uint8Array(new ArrayBuffer(4),NaN,2)`,
        roundtrips: false,
      },
    },
    {
      name: `polluted Uint8Array subclass`,
      value: (() => {
        class Evil extends Uint8Array {}
        Object.defineProperty(Evil, `name`, {
          value: `</script><script>alert(1)//`,
        })
        return new Evil(1)
      })(),
      expected: {
        source: `new Uint8Array(1)`,
        roundtrips: false,
      },
    },
    {
      name: `custom Uint8Array`,
      value: new Uint8Array([1, 2, 3, 4]),
      options: {
        custom: (value, uneval) =>
          value instanceof Uint8Array
            ? `new Uint8Array(${uneval([...value])})`
            : undefined,
      },
      expected: { source: `new Uint8Array([1,2,3,4])` },
    },
    {
      name: `custom number does not affect Uint8Array`,
      value: new Uint8Array([0, 0, 0, 0, 0, 1, 2, 3]),
      options: { custom: customNumber },
      expected: { source: `Uint8Array.of(0,0,0,0,0,1,2,3)` },
    },
    {
      name: `custom number does not affect Uint8Array when number is sibling`,
      value: [new Uint8Array([0, 0, 0, 0, 0, 1, 2, 3]), 0],
      options: { custom: customNumber },
      expected: { source: `[Uint8Array.of(0,0,0,0,0,1,2,3),0.0]` },
    },
    {
      name: `omit number does not affect Uint8Array`,
      value: new Uint8Array([0, 0, 0, 0, 0, 1, 2, 3]),
      options: { custom: value => (value === 0 ? null : undefined) },
      expected: { source: `Uint8Array.of(0,0,0,0,0,1,2,3)` },
    },
    {
      name: `omit number does not affect Uint8Array when number is sibling`,
      value: [new Uint8Array([0, 0, 0, 0, 0, 1, 2, 3]), 0],
      options: { custom: value => (value === 0 ? null : undefined) },
      expected: {
        source: `[Uint8Array.of(0,0,0,0,0,1,2,3),,]`,
        roundtrips: false,
      },
    },
    {
      name: `custom ArrayBuffer affects Uint8Array`,
      value: new Uint8Array(new Uint8Array([1, 2, 3]).buffer),
      options: {
        custom: (value, uneval) =>
          value instanceof ArrayBuffer
            ? `new Uint8Array(${uneval([...new Uint8Array(value)])}).buffer`
            : undefined,
      },
      expected: { source: `new Uint8Array(new Uint8Array([1,2,3]).buffer)` },
    },
    {
      name: `Uint8Array view backed by pool-sized ArrayBuffer does not expose pool data`,
      value: (() => {
        const poolSizeBuffer = new ArrayBuffer(Buffer.poolSize)
        new Uint8Array(poolSizeBuffer).set([1, 2, 3], 5)
        return new Uint8Array(poolSizeBuffer, 5, 3)
      })(),
      expected: {
        source: `new Uint8Array(Uint8Array.of(1,2,3).buffer)`,
        roundtrips: false,
      },
    },
  ],

  Uint8ClampedArray: [
    {
      name: `empty Uint8ClampedArray`,
      value: new Uint8ClampedArray(),
      expected: { source: `new Uint8ClampedArray` },
    },
    {
      name: `non-empty uninitialized Uint8ClampedArray`,
      value: new Uint8ClampedArray(1024),
      expected: { source: `new Uint8ClampedArray(1024)` },
    },
    {
      name: `non-empty initialized Uint8ClampedArray`,
      value: new Uint8ClampedArray([1, 2, 3, 4]),
      expected: { source: `Uint8ClampedArray.of(1,2,3,4)` },
    },
    {
      name: `leading Uint8ClampedArray view`,
      value: new Uint8ClampedArray(new ArrayBuffer(4), 0, 3),
      expected: { source: `new Uint8ClampedArray(new ArrayBuffer(4),0,3)` },
    },
    {
      name: `middle Uint8ClampedArray view`,
      value: new Uint8ClampedArray(new ArrayBuffer(4), 1, 2),
      expected: { source: `new Uint8ClampedArray(new ArrayBuffer(4),1,2)` },
    },
    {
      name: `trailing Uint8ClampedArray view`,
      value: new Uint8ClampedArray(new ArrayBuffer(4), 1, 3),
      expected: { source: `new Uint8ClampedArray(new ArrayBuffer(4),1)` },
    },
    {
      name: `resizable Uint8ClampedArray`,
      value: new Uint8ClampedArray(new ArrayBuffer(0, { maxByteLength: 1 })),
      expected: {
        source: `new Uint8ClampedArray(new ArrayBuffer(0,{maxByteLength:1}))`,
      },
    },
    {
      name: `Uint8ClampedArray with shared buffer reference`,
      value: (() => {
        const buffer = new ArrayBuffer()
        return [new Uint8ClampedArray(buffer), new Uint8ClampedArray(buffer)]
      })(),
      expected: {
        source: `(a=>[new Uint8ClampedArray(a),new Uint8ClampedArray(a)])(new ArrayBuffer)`,
      },
    },
    {
      name: `detached Uint8ClampedArray`,
      value: (() => {
        const typedArray = new Uint8ClampedArray()
        typedArray.buffer.transfer()
        return typedArray
      })(),
      expected: {
        source: `(a=>(a.buffer.transfer(),a))(new Uint8ClampedArray)`,
      },
    },
    {
      name: `polluted Uint8ClampedArray byteOffset`,
      value: (() => {
        const array = new Uint8ClampedArray(new ArrayBuffer(4), 1, 2)
        Object.defineProperty(array, `byteOffset`, {
          value: `</script><script src='https://evil.com/hacked.js'>`,
        })
        return array
      })(),
      expected: {
        source: `new Uint8ClampedArray(new ArrayBuffer(4),NaN,2)`,
        roundtrips: false,
      },
    },
    {
      name: `polluted Uint8ClampedArray subclass`,
      value: (() => {
        class Evil extends Uint8ClampedArray {}
        Object.defineProperty(Evil, `name`, {
          value: `</script><script>alert(1)//`,
        })
        return new Evil(1)
      })(),
      expected: {
        source: `new Uint8ClampedArray(1)`,
        roundtrips: false,
      },
    },
    {
      name: `custom Uint8ClampedArray`,
      value: new Uint8ClampedArray([1, 2, 3, 4]),
      options: {
        custom: (value, uneval) =>
          value instanceof Uint8ClampedArray
            ? `new Uint8ClampedArray(${uneval([...value])})`
            : undefined,
      },
      expected: { source: `new Uint8ClampedArray([1,2,3,4])` },
    },
    {
      name: `custom number does not affect Uint8ClampedArray`,
      value: new Uint8ClampedArray([0, 0, 0, 0, 0, 1, 2, 3]),
      options: { custom: customNumber },
      expected: { source: `Uint8ClampedArray.of(0,0,0,0,0,1,2,3)` },
    },
    {
      name: `custom number does not affect Uint8ClampedArray when number is sibling`,
      value: [new Uint8ClampedArray([0, 0, 0, 0, 0, 1, 2, 3]), 0],
      options: { custom: customNumber },
      expected: { source: `[Uint8ClampedArray.of(0,0,0,0,0,1,2,3),0.0]` },
    },
    {
      name: `omit number does not affect Uint8ClampedArray`,
      value: new Uint8ClampedArray([0, 0, 0, 0, 0, 1, 2, 3]),
      options: { custom: value => (value === 0 ? null : undefined) },
      expected: { source: `Uint8ClampedArray.of(0,0,0,0,0,1,2,3)` },
    },
    {
      name: `omit number does not affect Uint8ClampedArray when number is sibling`,
      value: [new Uint8ClampedArray([0, 0, 0, 0, 0, 1, 2, 3]), 0],
      options: { custom: value => (value === 0 ? null : undefined) },
      expected: {
        source: `[Uint8ClampedArray.of(0,0,0,0,0,1,2,3),,]`,
        roundtrips: false,
      },
    },
    {
      name: `custom ArrayBuffer affects Uint8ClampedArray`,
      value: new Uint8ClampedArray(new Uint8Array([1, 2, 3]).buffer),
      options: {
        custom: (value, uneval) =>
          value instanceof ArrayBuffer
            ? `new Uint8Array(${uneval([...new Uint8Array(value)])}).buffer`
            : undefined,
      },
      expected: {
        source: `new Uint8ClampedArray(new Uint8Array([1,2,3]).buffer)`,
      },
    },
    {
      name: `Uint8ClampedArray view backed by pool-sized ArrayBuffer does not expose pool data`,
      value: (() => {
        const poolSizeBuffer = new ArrayBuffer(Buffer.poolSize)
        const arr = new Uint8ClampedArray(poolSizeBuffer, 5, 3)
        arr[0] = 1
        arr[1] = 2
        arr[2] = 3
        return arr
      })(),
      expected: {
        source: `new Uint8ClampedArray(Uint8Array.of(1,2,3).buffer)`,
        roundtrips: false,
      },
    },
  ],

  Int16Array: [
    {
      name: `empty Int16Array`,
      value: new Int16Array(),
      expected: { source: `new Int16Array` },
    },
    {
      name: `non-empty uninitialized Int16Array`,
      value: new Int16Array(1024),
      expected: { source: `new Int16Array(1024)` },
    },
    {
      name: `non-empty initialized Int16Array`,
      value: new Int16Array([1, -2, 3, 4]),
      expected: { source: `Int16Array.of(1,-2,3,4)` },
    },
    {
      name: `leading Int16Array view`,
      value: new Int16Array(new ArrayBuffer(8), 0, 2),
      expected: { source: `new Int16Array(new ArrayBuffer(8),0,2)` },
    },
    {
      name: `middle Int16Array view`,
      value: new Int16Array(new ArrayBuffer(8), 2, 2),
      expected: { source: `new Int16Array(new ArrayBuffer(8),2,2)` },
    },
    {
      name: `trailing Int16Array view`,
      value: new Int16Array(new ArrayBuffer(8), 4, 2),
      expected: { source: `new Int16Array(new ArrayBuffer(8),4)` },
    },
    {
      name: `resizable Int16Array`,
      value: new Int16Array(new ArrayBuffer(0, { maxByteLength: 1 })),
      expected: {
        source: `new Int16Array(new ArrayBuffer(0,{maxByteLength:1}))`,
      },
    },
    {
      name: `Int16Array with shared buffer reference`,
      value: (() => {
        const buffer = new ArrayBuffer()
        return [new Int16Array(buffer), new Int16Array(buffer)]
      })(),
      expected: {
        source: `(a=>[new Int16Array(a),new Int16Array(a)])(new ArrayBuffer)`,
      },
    },
    {
      name: `detached Int16Array`,
      value: (() => {
        const typedArray = new Int16Array()
        typedArray.buffer.transfer()
        return typedArray
      })(),
      expected: {
        source: `(a=>(a.buffer.transfer(),a))(new Int16Array)`,
      },
    },
    {
      name: `polluted Int16Array byteOffset`,
      value: (() => {
        const array = new Int16Array(new ArrayBuffer(8), 2, 2)
        Object.defineProperty(array, `byteOffset`, {
          value: `</script><script src='https://evil.com/hacked.js'>`,
        })
        return array
      })(),
      expected: {
        source: `new Int16Array(new ArrayBuffer(8),NaN,2)`,
        roundtrips: false,
      },
    },
    {
      name: `polluted Int16Array subclass`,
      value: (() => {
        class Evil extends Int16Array {}
        Object.defineProperty(Evil, `name`, {
          value: `</script><script>alert(1)//`,
        })
        return new Evil(1)
      })(),
      expected: {
        source: `new Int16Array(1)`,
        roundtrips: false,
      },
    },
    {
      name: `custom Int16Array`,
      value: new Int16Array([1, -2, 3, 4]),
      options: {
        custom: (value, uneval) =>
          value instanceof Int16Array
            ? `new Int16Array(${uneval([...value])})`
            : undefined,
      },
      expected: { source: `new Int16Array([1,-2,3,4])` },
    },
    {
      name: `custom number does not affect Int16Array`,
      value: new Int16Array([0, 0, 0, 0, 0, 1, 2, 3]),
      options: { custom: customNumber },
      expected: { source: `Int16Array.of(0,0,0,0,0,1,2,3)` },
    },
    {
      name: `custom number does not affect Int16Array when number is sibling`,
      value: [new Int16Array([0, 0, 0, 0, 0, 1, 2, 3]), 0],
      options: { custom: customNumber },
      expected: { source: `[Int16Array.of(0,0,0,0,0,1,2,3),0.0]` },
    },
    {
      name: `omit number does not affect Int16Array`,
      value: new Int16Array([0, 0, 0, 0, 0, 1, 2, 3]),
      options: { custom: value => (value === 0 ? null : undefined) },
      expected: { source: `Int16Array.of(0,0,0,0,0,1,2,3)` },
    },
    {
      name: `omit number does not affect Int16Array when number is sibling`,
      value: [new Int16Array([0, 0, 0, 0, 0, 1, 2, 3]), 0],
      options: { custom: value => (value === 0 ? null : undefined) },
      expected: {
        source: `[Int16Array.of(0,0,0,0,0,1,2,3),,]`,
        roundtrips: false,
      },
    },
    {
      name: `custom ArrayBuffer affects Int16Array`,
      value: new Int16Array(new Uint8Array([1, 0, 2, 0, 3, 0]).buffer),
      options: {
        custom: (value, uneval) =>
          value instanceof ArrayBuffer
            ? `new Uint8Array(${uneval([...new Uint8Array(value)])}).buffer`
            : undefined,
      },
      expected: {
        source: `new Int16Array(new Uint8Array([1,0,2,0,3,0]).buffer)`,
      },
    },
    {
      name: `Int16Array view backed by pool-sized ArrayBuffer does not expose pool data`,
      value: (() => {
        const poolSizeBuffer = new ArrayBuffer(Buffer.poolSize)
        const arr = new Int16Array(poolSizeBuffer, 10, 3)
        arr[0] = 1
        arr[1] = 2
        arr[2] = 3
        return arr
      })(),
      expected: {
        source: `new Int16Array(Uint8Array.of(1,0,2,0,3,0).buffer)`,
        roundtrips: false,
      },
    },
  ],

  Uint16Array: [
    {
      name: `empty Uint16Array`,
      value: new Uint16Array(),
      expected: { source: `new Uint16Array` },
    },
    {
      name: `non-empty uninitialized Uint16Array`,
      value: new Uint16Array(1024),
      expected: { source: `new Uint16Array(1024)` },
    },
    {
      name: `non-empty initialized Uint16Array`,
      value: new Uint16Array([1, 2, 3, 4]),
      expected: { source: `Uint16Array.of(1,2,3,4)` },
    },
    {
      name: `leading Uint16Array view`,
      value: new Uint16Array(new ArrayBuffer(8), 0, 2),
      expected: { source: `new Uint16Array(new ArrayBuffer(8),0,2)` },
    },
    {
      name: `middle Uint16Array view`,
      value: new Uint16Array(new ArrayBuffer(8), 2, 2),
      expected: { source: `new Uint16Array(new ArrayBuffer(8),2,2)` },
    },
    {
      name: `trailing Uint16Array view`,
      value: new Uint16Array(new ArrayBuffer(8), 4, 2),
      expected: { source: `new Uint16Array(new ArrayBuffer(8),4)` },
    },
    {
      name: `resizable Uint16Array`,
      value: new Uint16Array(new ArrayBuffer(0, { maxByteLength: 1 })),
      expected: {
        source: `new Uint16Array(new ArrayBuffer(0,{maxByteLength:1}))`,
      },
    },
    {
      name: `Uint16Array with shared buffer reference`,
      value: (() => {
        const buffer = new ArrayBuffer()
        return [new Uint16Array(buffer), new Uint16Array(buffer)]
      })(),
      expected: {
        source: `(a=>[new Uint16Array(a),new Uint16Array(a)])(new ArrayBuffer)`,
      },
    },
    {
      name: `detached Uint16Array`,
      value: (() => {
        const typedArray = new Uint16Array()
        typedArray.buffer.transfer()
        return typedArray
      })(),
      expected: {
        source: `(a=>(a.buffer.transfer(),a))(new Uint16Array)`,
      },
    },
    {
      name: `polluted Uint16Array byteOffset`,
      value: (() => {
        const array = new Uint16Array(new ArrayBuffer(8), 2, 2)
        Object.defineProperty(array, `byteOffset`, {
          value: `</script><script src='https://evil.com/hacked.js'>`,
        })
        return array
      })(),
      expected: {
        source: `new Uint16Array(new ArrayBuffer(8),NaN,2)`,
        roundtrips: false,
      },
    },
    {
      name: `polluted Uint16Array subclass`,
      value: (() => {
        class Evil extends Uint16Array {}
        Object.defineProperty(Evil, `name`, {
          value: `</script><script>alert(1)//`,
        })
        return new Evil(1)
      })(),
      expected: {
        source: `new Uint16Array(1)`,
        roundtrips: false,
      },
    },
    {
      name: `custom Uint16Array`,
      value: new Uint16Array([1, 2, 3, 4]),
      options: {
        custom: (value, uneval) =>
          value instanceof Uint16Array
            ? `new Uint16Array(${uneval([...value])})`
            : undefined,
      },
      expected: { source: `new Uint16Array([1,2,3,4])` },
    },
    {
      name: `custom number does not affect Uint16Array`,
      value: new Uint16Array([0, 0, 0, 0, 0, 1, 2, 3]),
      options: { custom: customNumber },
      expected: { source: `Uint16Array.of(0,0,0,0,0,1,2,3)` },
    },
    {
      name: `custom number does not affect Uint16Array when number is sibling`,
      value: [new Uint16Array([0, 0, 0, 0, 0, 1, 2, 3]), 0],
      options: { custom: customNumber },
      expected: { source: `[Uint16Array.of(0,0,0,0,0,1,2,3),0.0]` },
    },
    {
      name: `omit number does not affect Uint16Array`,
      value: new Uint16Array([0, 0, 0, 0, 0, 1, 2, 3]),
      options: { custom: value => (value === 0 ? null : undefined) },
      expected: { source: `Uint16Array.of(0,0,0,0,0,1,2,3)` },
    },
    {
      name: `omit number does not affect Uint16Array when number is sibling`,
      value: [new Uint16Array([0, 0, 0, 0, 0, 1, 2, 3]), 0],
      options: { custom: value => (value === 0 ? null : undefined) },
      expected: {
        source: `[Uint16Array.of(0,0,0,0,0,1,2,3),,]`,
        roundtrips: false,
      },
    },
    {
      name: `custom ArrayBuffer affects Uint16Array`,
      value: new Uint16Array(new Uint8Array([1, 0, 2, 0, 3, 0]).buffer),
      options: {
        custom: (value, uneval) =>
          value instanceof ArrayBuffer
            ? `new Uint8Array(${uneval([...new Uint8Array(value)])}).buffer`
            : undefined,
      },
      expected: {
        source: `new Uint16Array(new Uint8Array([1,0,2,0,3,0]).buffer)`,
      },
    },
    {
      name: `Uint16Array view backed by pool-sized ArrayBuffer does not expose pool data`,
      value: (() => {
        const poolSizeBuffer = new ArrayBuffer(Buffer.poolSize)
        const arr = new Uint16Array(poolSizeBuffer, 10, 3)
        arr[0] = 1
        arr[1] = 2
        arr[2] = 3
        return arr
      })(),
      expected: {
        source: `new Uint16Array(Uint8Array.of(1,0,2,0,3,0).buffer)`,
        roundtrips: false,
      },
    },
  ],

  Int32Array: [
    {
      name: `empty Int32Array`,
      value: new Int32Array(),
      expected: { source: `new Int32Array` },
    },
    {
      name: `non-empty uninitialized Int32Array`,
      value: new Int32Array(1024),
      expected: { source: `new Int32Array(1024)` },
    },
    {
      name: `non-empty initialized Int32Array`,
      value: new Int32Array([1, -2, 3, 4]),
      expected: { source: `Int32Array.of(1,-2,3,4)` },
    },
    {
      name: `leading Int32Array view`,
      value: new Int32Array(new ArrayBuffer(16), 0, 2),
      expected: { source: `new Int32Array(new ArrayBuffer(16),0,2)` },
    },
    {
      name: `middle Int32Array view`,
      value: new Int32Array(new ArrayBuffer(16), 4, 2),
      expected: { source: `new Int32Array(new ArrayBuffer(16),4,2)` },
    },
    {
      name: `trailing Int32Array view`,
      value: new Int32Array(new ArrayBuffer(16), 8, 2),
      expected: { source: `new Int32Array(new ArrayBuffer(16),8)` },
    },
    {
      name: `resizable Int32Array`,
      value: new Int32Array(new ArrayBuffer(0, { maxByteLength: 1 })),
      expected: {
        source: `new Int32Array(new ArrayBuffer(0,{maxByteLength:1}))`,
      },
    },
    {
      name: `Int32Array with shared buffer reference`,
      value: (() => {
        const buffer = new ArrayBuffer()
        return [new Int32Array(buffer), new Int32Array(buffer)]
      })(),
      expected: {
        source: `(a=>[new Int32Array(a),new Int32Array(a)])(new ArrayBuffer)`,
      },
    },
    {
      name: `detached Int32Array`,
      value: (() => {
        const typedArray = new Int32Array()
        typedArray.buffer.transfer()
        return typedArray
      })(),
      expected: {
        source: `(a=>(a.buffer.transfer(),a))(new Int32Array)`,
      },
    },
    {
      name: `polluted Int32Array byteOffset`,
      value: (() => {
        const array = new Int32Array(new ArrayBuffer(16), 4, 2)
        Object.defineProperty(array, `byteOffset`, {
          value: `</script><script src='https://evil.com/hacked.js'>`,
        })
        return array
      })(),
      expected: {
        source: `new Int32Array(new ArrayBuffer(16),NaN,2)`,
        roundtrips: false,
      },
    },
    {
      name: `polluted Int32Array subclass`,
      value: (() => {
        class Evil extends Int32Array {}
        Object.defineProperty(Evil, `name`, {
          value: `</script><script>alert(1)//`,
        })
        return new Evil(1)
      })(),
      expected: {
        source: `new Int32Array(1)`,
        roundtrips: false,
      },
    },
    {
      name: `custom Int32Array`,
      value: new Int32Array([1, -2, 3, 4]),
      options: {
        custom: (value, uneval) =>
          value instanceof Int32Array
            ? `new Int32Array(${uneval([...value])})`
            : undefined,
      },
      expected: { source: `new Int32Array([1,-2,3,4])` },
    },
    {
      name: `custom number does not affect Int32Array`,
      value: new Int32Array([0, 0, 0, 0, 0, 1, 2, 3]),
      options: { custom: customNumber },
      expected: { source: `Int32Array.of(0,0,0,0,0,1,2,3)` },
    },
    {
      name: `custom number does not affect Int32Array when number is sibling`,
      value: [new Int32Array([0, 0, 0, 0, 0, 1, 2, 3]), 0],
      options: { custom: customNumber },
      expected: { source: `[Int32Array.of(0,0,0,0,0,1,2,3),0.0]` },
    },
    {
      name: `omit number does not affect Int32Array`,
      value: new Int32Array([0, 0, 0, 0, 0, 1, 2, 3]),
      options: { custom: value => (value === 0 ? null : undefined) },
      expected: { source: `Int32Array.of(0,0,0,0,0,1,2,3)` },
    },
    {
      name: `omit number does not affect Int32Array when number is sibling`,
      value: [new Int32Array([0, 0, 0, 0, 0, 1, 2, 3]), 0],
      options: { custom: value => (value === 0 ? null : undefined) },
      expected: {
        source: `[Int32Array.of(0,0,0,0,0,1,2,3),,]`,
        roundtrips: false,
      },
    },
    {
      name: `custom ArrayBuffer affects Int32Array`,
      value: new Int32Array(
        new Uint8Array([1, 0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 0]).buffer,
      ),
      options: {
        custom: (value, uneval) =>
          value instanceof ArrayBuffer
            ? `new Uint8Array(${uneval([...new Uint8Array(value)])}).buffer`
            : undefined,
      },
      expected: {
        source: `new Int32Array(new Uint8Array([1,0,0,0,2,0,0,0,3,0,0,0]).buffer)`,
      },
    },
    {
      name: `Int32Array view backed by pool-sized ArrayBuffer does not expose pool data`,
      value: (() => {
        const poolSizeBuffer = new ArrayBuffer(Buffer.poolSize)
        const arr = new Int32Array(poolSizeBuffer, 20, 3)
        arr[0] = 1
        arr[1] = 2
        arr[2] = 3
        return arr
      })(),
      expected: {
        source: `new Int32Array(Uint8Array.of(1,0,0,0,2,0,0,0,3,0,0,0).buffer)`,
        roundtrips: false,
      },
    },
  ],

  Uint32Array: [
    {
      name: `empty Uint32Array`,
      value: new Uint32Array(),
      expected: { source: `new Uint32Array` },
    },
    {
      name: `non-empty uninitialized Uint32Array`,
      value: new Uint32Array(1024),
      expected: { source: `new Uint32Array(1024)` },
    },
    {
      name: `non-empty initialized Uint32Array`,
      value: new Uint32Array([1, 2, 3, 4]),
      expected: { source: `Uint32Array.of(1,2,3,4)` },
    },
    {
      name: `leading Uint32Array view`,
      value: new Uint32Array(new ArrayBuffer(16), 0, 2),
      expected: { source: `new Uint32Array(new ArrayBuffer(16),0,2)` },
    },
    {
      name: `middle Uint32Array view`,
      value: new Uint32Array(new ArrayBuffer(16), 4, 2),
      expected: { source: `new Uint32Array(new ArrayBuffer(16),4,2)` },
    },
    {
      name: `trailing Uint32Array view`,
      value: new Uint32Array(new ArrayBuffer(16), 8, 2),
      expected: { source: `new Uint32Array(new ArrayBuffer(16),8)` },
    },
    {
      name: `resizable Uint32Array`,
      value: new Uint32Array(new ArrayBuffer(0, { maxByteLength: 1 })),
      expected: {
        source: `new Uint32Array(new ArrayBuffer(0,{maxByteLength:1}))`,
      },
    },
    {
      name: `Uint32Array with shared buffer reference`,
      value: (() => {
        const buffer = new ArrayBuffer()
        return [new Uint32Array(buffer), new Uint32Array(buffer)]
      })(),
      expected: {
        source: `(a=>[new Uint32Array(a),new Uint32Array(a)])(new ArrayBuffer)`,
      },
    },
    {
      name: `detached Uint32Array`,
      value: (() => {
        const typedArray = new Uint32Array()
        typedArray.buffer.transfer()
        return typedArray
      })(),
      expected: {
        source: `(a=>(a.buffer.transfer(),a))(new Uint32Array)`,
      },
    },
    {
      name: `polluted Uint32Array byteOffset`,
      value: (() => {
        const array = new Uint32Array(new ArrayBuffer(16), 4, 2)
        Object.defineProperty(array, `byteOffset`, {
          value: `</script><script src='https://evil.com/hacked.js'>`,
        })
        return array
      })(),
      expected: {
        source: `new Uint32Array(new ArrayBuffer(16),NaN,2)`,
        roundtrips: false,
      },
    },
    {
      name: `polluted Uint32Array subclass`,
      value: (() => {
        class Evil extends Uint32Array {}
        Object.defineProperty(Evil, `name`, {
          value: `</script><script>alert(1)//`,
        })
        return new Evil(1)
      })(),
      expected: {
        source: `new Uint32Array(1)`,
        roundtrips: false,
      },
    },
    {
      name: `custom Uint32Array`,
      value: new Uint32Array([1, 2, 3, 4]),
      options: {
        custom: (value, uneval) =>
          value instanceof Uint32Array
            ? `new Uint32Array(${uneval([...value])})`
            : undefined,
      },
      expected: { source: `new Uint32Array([1,2,3,4])` },
    },
    {
      name: `custom number does not affect Uint32Array`,
      value: new Uint32Array([0, 0, 0, 0, 0, 1, 2, 3]),
      options: { custom: customNumber },
      expected: { source: `Uint32Array.of(0,0,0,0,0,1,2,3)` },
    },
    {
      name: `custom number does not affect Uint32Array when number is sibling`,
      value: [new Uint32Array([0, 0, 0, 0, 0, 1, 2, 3]), 0],
      options: { custom: customNumber },
      expected: { source: `[Uint32Array.of(0,0,0,0,0,1,2,3),0.0]` },
    },
    {
      name: `omit number does not affect Uint32Array`,
      value: new Uint32Array([0, 0, 0, 0, 0, 1, 2, 3]),
      options: { custom: value => (value === 0 ? null : undefined) },
      expected: { source: `Uint32Array.of(0,0,0,0,0,1,2,3)` },
    },
    {
      name: `omit number does not affect Uint32Array when number is sibling`,
      value: [new Uint32Array([0, 0, 0, 0, 0, 1, 2, 3]), 0],
      options: { custom: value => (value === 0 ? null : undefined) },
      expected: {
        source: `[Uint32Array.of(0,0,0,0,0,1,2,3),,]`,
        roundtrips: false,
      },
    },
    {
      name: `custom ArrayBuffer affects Uint32Array`,
      value: new Uint32Array(
        new Uint8Array([1, 0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 0]).buffer,
      ),
      options: {
        custom: (value, uneval) =>
          value instanceof ArrayBuffer
            ? `new Uint8Array(${uneval([...new Uint8Array(value)])}).buffer`
            : undefined,
      },
      expected: {
        source: `new Uint32Array(new Uint8Array([1,0,0,0,2,0,0,0,3,0,0,0]).buffer)`,
      },
    },
    {
      name: `Uint32Array view backed by pool-sized ArrayBuffer does not expose pool data`,
      value: (() => {
        const poolSizeBuffer = new ArrayBuffer(Buffer.poolSize)
        const arr = new Uint32Array(poolSizeBuffer, 20, 3)
        arr[0] = 1
        arr[1] = 2
        arr[2] = 3
        return arr
      })(),
      expected: {
        source: `new Uint32Array(Uint8Array.of(1,0,0,0,2,0,0,0,3,0,0,0).buffer)`,
        roundtrips: false,
      },
    },
  ],

  Float16Array: [
    ...(typeof Float16Array === `undefined`
      ? []
      : ([
          {
            name: `empty Float16Array`,
            value: new Float16Array(),
            expected: { source: `new Float16Array` },
          },
          {
            name: `non-empty uninitialized Float16Array`,
            value: new Float16Array(1024),
            expected: { source: `new Float16Array(1024)` },
          },
          {
            name: `non-empty initialized Float16Array`,
            value: new Float16Array([1, -2, 3.140_625, 4]),
            expected: { source: `Float16Array.of(1,-2,3.140625,4)` },
          },
          {
            name: `middle Float16Array view`,
            value: new Float16Array(new ArrayBuffer(8), 2, 2),
            expected: { source: `new Float16Array(new ArrayBuffer(8),2,2)` },
          },
          {
            name: `trailing Float16Array view`,
            value: new Float16Array(new ArrayBuffer(8), 4, 2),
            expected: { source: `new Float16Array(new ArrayBuffer(8),4)` },
          },
          {
            name: `resizable Float16Array`,
            value: new Float16Array(new ArrayBuffer(0, { maxByteLength: 1 })),
            expected: {
              source: `new Float16Array(new ArrayBuffer(0,{maxByteLength:1}))`,
            },
          },
          {
            name: `resizable Float16Array`,
            value: new Float16Array(new ArrayBuffer(0, { maxByteLength: 1 })),
            expected: {
              source: `new Float16Array(new ArrayBuffer(0,{maxByteLength:1}))`,
            },
          },
          {
            name: `Float16Array with shared buffer reference`,
            value: (() => {
              const buffer = new ArrayBuffer()
              return [new Float16Array(buffer), new Float16Array(buffer)]
            })(),
            expected: {
              source: `(a=>[new Float16Array(a),new Float16Array(a)])(new ArrayBuffer)`,
            },
          },
          {
            name: `Float16Array from NaN`,
            value: new Float16Array([Number.NaN]),
            expected: { source: `Float16Array.of(NaN)` },
          },
          {
            name: `Float16Array from non-canonical NaN`,
            value: new Float16Array(new Uint8Array([0, 125]).buffer),
            expected: {
              source: `new Float16Array(Uint8Array.of(0,125).buffer)`,
            },
          },
          {
            name: `detached Float16Array`,
            value: (() => {
              const typedArray = new Float16Array()
              typedArray.buffer.transfer()
              return typedArray
            })(),
            expected: {
              source: `(a=>(a.buffer.transfer(),a))(new Float16Array)`,
            },
          },
          {
            name: `polluted Float16Array byteOffset`,
            value: (() => {
              const array = new Float16Array(new ArrayBuffer(8), 2, 2)
              Object.defineProperty(array, `byteOffset`, {
                value: `</script><script src='https://evil.com/hacked.js'>`,
              })
              return array
            })(),
            expected: {
              source: `new Float16Array(new ArrayBuffer(8),NaN,2)`,
              roundtrips: false,
            },
          },
          {
            name: `polluted Float16Array subclass`,
            value: (() => {
              class Evil extends Float16Array {}
              Object.defineProperty(Evil, `name`, {
                value: `</script><script>alert(1)//`,
              })
              return new Evil(1)
            })(),
            expected: {
              source: `new Float16Array(1)`,
              roundtrips: false,
            },
          },
          {
            name: `custom Float16Array`,
            value: new Float16Array([1, 2, 3]),
            options: {
              custom: (value, uneval) =>
                value instanceof Float16Array
                  ? `new Float16Array(${uneval([...value])})`
                  : undefined,
            },
            expected: { source: `new Float16Array([1,2,3])` },
          },
          {
            name: `custom number does not affect Float16Array`,
            value: new Float16Array([0, 0, 0, 0, 0, 1, 2, 3]),
            options: { custom: customNumber },
            expected: { source: `Float16Array.of(0,0,0,0,0,1,2,3)` },
          },
          {
            name: `custom number does not affect Float16Array when number is sibling`,
            value: [new Float16Array([0, 0, 0, 0, 0, 1, 2, 3]), 0],
            options: { custom: customNumber },
            expected: { source: `[Float16Array.of(0,0,0,0,0,1,2,3),0.0]` },
          },
          {
            name: `omit number does not affect Float16Array`,
            value: new Float16Array([0, 0, 0, 0, 0, 1, 2, 3]),
            options: { custom: value => (value === 0 ? null : undefined) },
            expected: { source: `Float16Array.of(0,0,0,0,0,1,2,3)` },
          },
          {
            name: `omit number does not affect Float16Array when number is sibling`,
            value: [new Float16Array([0, 0, 0, 0, 0, 1, 2, 3]), 0],
            options: { custom: value => (value === 0 ? null : undefined) },
            expected: {
              source: `[Float16Array.of(0,0,0,0,0,1,2,3),,]`,
              roundtrips: false,
            },
          },
          {
            name: `custom ArrayBuffer affects Float16Array`,
            value: new Float16Array(
              new Uint8Array([0, 60, 0, 64, 0, 68]).buffer,
            ),
            options: {
              custom: (value, uneval) =>
                value instanceof ArrayBuffer
                  ? `new Uint8Array(${uneval([...new Uint8Array(value)])}).buffer`
                  : undefined,
            },
            expected: {
              source: `new Float16Array(new Uint8Array([0,60,0,64,0,68]).buffer)`,
            },
          },
          {
            name: `Float16Array view backed by pool-sized ArrayBuffer does not expose pool data`,
            value: (() => {
              const poolSizeBuffer = new ArrayBuffer(Buffer.poolSize)
              const arr = new Float16Array(poolSizeBuffer, 10, 3)
              arr[0] = 1
              arr[1] = 2
              arr[2] = 3
              return arr
            })(),
            expected: {
              source: `new Float16Array(Uint8Array.of(0,60,0,64,0,66).buffer)`,
              roundtrips: false,
            },
          },
        ] satisfies Case[])),
  ],

  Float32Array: [
    {
      name: `empty Float32Array`,
      value: new Float32Array(),
      expected: { source: `new Float32Array` },
    },
    {
      name: `non-empty uninitialized Float32Array`,
      value: new Float32Array(1024),
      expected: { source: `new Float32Array(1024)` },
    },
    {
      name: `non-empty initialized Float32Array`,
      value: new Float32Array([1, -2, 3.140_000_104_904_175, 4]),
      expected: { source: `Float32Array.of(1,-2,3.140000104904175,4)` },
    },
    {
      name: `leading Float32Array view`,
      value: new Float32Array(new ArrayBuffer(16), 0, 2),
      expected: { source: `new Float32Array(new ArrayBuffer(16),0,2)` },
    },
    {
      name: `middle Float32Array view`,
      value: new Float32Array(new ArrayBuffer(16), 4, 2),
      expected: { source: `new Float32Array(new ArrayBuffer(16),4,2)` },
    },
    {
      name: `trailing Float32Array view`,
      value: new Float32Array(new ArrayBuffer(16), 8, 2),
      expected: { source: `new Float32Array(new ArrayBuffer(16),8)` },
    },
    {
      name: `resizable Float32Array`,
      value: new Float32Array(new ArrayBuffer(0, { maxByteLength: 1 })),
      expected: {
        source: `new Float32Array(new ArrayBuffer(0,{maxByteLength:1}))`,
      },
    },
    {
      name: `Float32Array with shared buffer reference`,
      value: (() => {
        const buffer = new ArrayBuffer()
        return [new Float32Array(buffer), new Float32Array(buffer)]
      })(),
      expected: {
        source: `(a=>[new Float32Array(a),new Float32Array(a)])(new ArrayBuffer)`,
      },
    },
    {
      name: `Float32Array from NaN`,
      value: new Float32Array([Number.NaN]),
      expected: { source: `Float32Array.of(NaN)` },
    },
    {
      name: `Float32Array from non-canonical NaN`,
      value: new Float32Array(new Uint8Array([0, 0, 255, 127]).buffer),
      expected: {
        source: `new Float32Array(Uint8Array.of(0,0,255,127).buffer)`,
      },
    },
    {
      name: `detached Float32Array`,
      value: (() => {
        const typedArray = new Float32Array()
        typedArray.buffer.transfer()
        return typedArray
      })(),
      expected: {
        source: `(a=>(a.buffer.transfer(),a))(new Float32Array)`,
      },
    },
    {
      name: `polluted Float32Array byteOffset`,
      value: (() => {
        const array = new Float32Array(new ArrayBuffer(16), 4, 2)
        Object.defineProperty(array, `byteOffset`, {
          value: `</script><script src='https://evil.com/hacked.js'>`,
        })
        return array
      })(),
      expected: {
        source: `new Float32Array(new ArrayBuffer(16),NaN,2)`,
        roundtrips: false,
      },
    },
    {
      name: `polluted Float32Array subclass`,
      value: (() => {
        class Evil extends Float32Array {}
        Object.defineProperty(Evil, `name`, {
          value: `</script><script>alert(1)//`,
        })
        return new Evil(1)
      })(),
      expected: {
        source: `new Float32Array(1)`,
        roundtrips: false,
      },
    },
    {
      name: `custom Float32Array`,
      value: new Float32Array([1, -2, 3, 4]),
      options: {
        custom: (value, uneval) =>
          value instanceof Float32Array
            ? `new Float32Array(${uneval([...value])})`
            : undefined,
      },
      expected: { source: `new Float32Array([1,-2,3,4])` },
    },
    {
      name: `custom number does not affect Float32Array`,
      value: new Float32Array([0, 0, 0, 0, 0, 1, 2, 3]),
      options: { custom: customNumber },
      expected: { source: `Float32Array.of(0,0,0,0,0,1,2,3)` },
    },
    {
      name: `custom number does not affect Float32Array when number is sibling`,
      value: [new Float32Array([0, 0, 0, 0, 0, 1, 2, 3]), 0],
      options: { custom: customNumber },
      expected: { source: `[Float32Array.of(0,0,0,0,0,1,2,3),0.0]` },
    },
    {
      name: `omit number does not affect Float32Array`,
      value: new Float32Array([0, 0, 0, 0, 0, 1, 2, 3]),
      options: { custom: value => (value === 0 ? null : undefined) },
      expected: { source: `Float32Array.of(0,0,0,0,0,1,2,3)` },
    },
    {
      name: `omit number does not affect Float32Array when number is sibling`,
      value: [new Float32Array([0, 0, 0, 0, 0, 1, 2, 3]), 0],
      options: { custom: value => (value === 0 ? null : undefined) },
      expected: {
        source: `[Float32Array.of(0,0,0,0,0,1,2,3),,]`,
        roundtrips: false,
      },
    },
    {
      name: `custom ArrayBuffer affects Float32Array`,
      value: new Float32Array(new Uint8Array([0, 0, 255, 127]).buffer),
      options: {
        custom: (value, uneval) =>
          value instanceof ArrayBuffer
            ? `new Uint8Array(${uneval([...new Uint8Array(value)])}).buffer`
            : undefined,
      },
      expected: {
        source: `new Float32Array(new Uint8Array([0,0,255,127]).buffer)`,
      },
    },
    {
      name: `Float32Array view backed by pool-sized ArrayBuffer does not expose pool data`,
      value: (() => {
        const poolSizeBuffer = new ArrayBuffer(Buffer.poolSize)
        const arr = new Float32Array(poolSizeBuffer, 20, 3)
        arr[0] = 1
        arr[1] = 2
        arr[2] = 3
        return arr
      })(),
      expected: {
        source: `new Float32Array(Uint8Array.of(0,0,128,63,0,0,0,64,0,0,64,64).buffer)`,
        roundtrips: false,
      },
    },
  ],

  Float64Array: [
    {
      name: `empty Float64Array`,
      value: new Float64Array(),
      expected: { source: `new Float64Array` },
    },
    {
      name: `non-empty uninitialized Float64Array`,
      value: new Float64Array(1024),
      expected: { source: `new Float64Array(1024)` },
    },
    {
      name: `non-empty initialized Float64Array`,
      value: new Float64Array([1, -2, 3.14, 4]),
      expected: { source: `Float64Array.of(1,-2,3.14,4)` },
    },
    {
      name: `leading Float64Array view`,
      value: new Float64Array(new ArrayBuffer(32), 0, 2),
      expected: { source: `new Float64Array(new ArrayBuffer(32),0,2)` },
    },
    {
      name: `middle Float64Array view`,
      value: new Float64Array(new ArrayBuffer(32), 8, 2),
      expected: { source: `new Float64Array(new ArrayBuffer(32),8,2)` },
    },
    {
      name: `trailing Float64Array view`,
      value: new Float64Array(new ArrayBuffer(32), 16, 2),
      expected: { source: `new Float64Array(new ArrayBuffer(32),16)` },
    },
    {
      name: `resizable Float64Array`,
      value: new Float64Array(new ArrayBuffer(0, { maxByteLength: 1 })),
      expected: {
        source: `new Float64Array(new ArrayBuffer(0,{maxByteLength:1}))`,
      },
    },
    {
      name: `Float64Array with shared buffer reference`,
      value: (() => {
        const buffer = new ArrayBuffer()
        return [new Float64Array(buffer), new Float64Array(buffer)]
      })(),
      expected: {
        source: `(a=>[new Float64Array(a),new Float64Array(a)])(new ArrayBuffer)`,
      },
    },
    {
      name: `Float64Array from NaN`,
      value: new Float64Array([Number.NaN]),
      expected: { source: `Float64Array.of(NaN)` },
    },
    {
      name: `Float64Array from non-canonical NaN`,
      value: new Float64Array(
        new Uint8Array([0, 0, 0, 0, 0, 0, 255, 127]).buffer,
      ),
      expected: {
        source: `new Float64Array(Uint8Array.of(0,0,0,0,0,0,255,127).buffer)`,
      },
    },
    {
      name: `detached Float64Array`,
      value: (() => {
        const typedArray = new Float64Array()
        typedArray.buffer.transfer()
        return typedArray
      })(),
      expected: {
        source: `(a=>(a.buffer.transfer(),a))(new Float64Array)`,
      },
    },
    {
      name: `polluted Float64Array byteOffset`,
      value: (() => {
        const array = new Float64Array(new ArrayBuffer(32), 8, 2)
        Object.defineProperty(array, `byteOffset`, {
          value: `</script><script src='https://evil.com/hacked.js'>`,
        })
        return array
      })(),
      expected: {
        source: `new Float64Array(new ArrayBuffer(32),NaN,2)`,
        roundtrips: false,
      },
    },
    {
      name: `polluted Float64Array subclass`,
      value: (() => {
        class Evil extends Float64Array {}
        Object.defineProperty(Evil, `name`, {
          value: `</script><script>alert(1)//`,
        })
        return new Evil(1)
      })(),
      expected: {
        source: `new Float64Array(1)`,
        roundtrips: false,
      },
    },
    {
      name: `custom Float64Array`,
      value: new Float64Array([1, -2, 3.14, 4]),
      options: {
        custom: (value, uneval) =>
          value instanceof Float64Array
            ? `new Float64Array(${uneval([...value])})`
            : undefined,
      },
      expected: { source: `new Float64Array([1,-2,3.14,4])` },
    },
    {
      name: `custom number does not affect Float64Array`,
      value: new Float64Array([0, 0, 0, 0, 0, 1, 2, 3]),
      options: { custom: customNumber },
      expected: { source: `Float64Array.of(0,0,0,0,0,1,2,3)` },
    },
    {
      name: `custom number does not affect Float64Array when number is sibling`,
      value: [new Float64Array([0, 0, 0, 0, 0, 1, 2, 3]), 0],
      options: { custom: customNumber },
      expected: { source: `[Float64Array.of(0,0,0,0,0,1,2,3),0.0]` },
    },
    {
      name: `omit number does not affect Float64Array`,
      value: new Float64Array([0, 0, 0, 0, 0, 1, 2, 3]),
      options: { custom: value => (value === 0 ? null : undefined) },
      expected: { source: `Float64Array.of(0,0,0,0,0,1,2,3)` },
    },
    {
      name: `omit number does not affect Float64Array when number is sibling`,
      value: [new Float64Array([0, 0, 0, 0, 0, 1, 2, 3]), 0],
      options: { custom: value => (value === 0 ? null : undefined) },
      expected: {
        source: `[Float64Array.of(0,0,0,0,0,1,2,3),,]`,
        roundtrips: false,
      },
    },
    {
      name: `custom ArrayBuffer affects Float64Array`,
      value: new Float64Array(
        new Uint8Array([0, 0, 0, 0, 0, 0, 255, 127]).buffer,
      ),
      options: {
        custom: (value, uneval) =>
          value instanceof ArrayBuffer
            ? `new Uint8Array(${uneval([...new Uint8Array(value)])}).buffer`
            : undefined,
      },
      expected: {
        source: `new Float64Array(new Uint8Array([0,0,0,0,0,0,255,127]).buffer)`,
      },
    },
    {
      name: `Float64Array view backed by pool-sized ArrayBuffer does not expose pool data`,
      value: (() => {
        const poolSizeBuffer = new ArrayBuffer(Buffer.poolSize)
        const arr = new Float64Array(poolSizeBuffer, 40, 3)
        arr[0] = 1
        arr[1] = 2
        arr[2] = 3
        return arr
      })(),
      expected: {
        source: `new Float64Array(Uint8Array.of(0,0,0,0,0,0,240,63,0,0,0,0,0,0,0,64,0,0,0,0,0,0,8,64).buffer)`,
        roundtrips: false,
      },
    },
  ],

  BigInt64Array: [
    {
      name: `empty BigInt64Array`,
      value: new BigInt64Array(),
      expected: { source: `new BigInt64Array` },
    },
    {
      name: `non-empty uninitialized BigInt64Array`,
      value: new BigInt64Array(1024),
      expected: { source: `new BigInt64Array(1024)` },
    },
    {
      name: `non-empty initialized BigInt64Array`,
      value: new BigInt64Array([1n, -2n, 3n, 4n]),
      expected: { source: `BigInt64Array.of(1n,-2n,3n,4n)` },
    },
    {
      name: `leading BigInt64Array view`,
      value: new BigInt64Array(new ArrayBuffer(32), 0, 2),
      expected: { source: `new BigInt64Array(new ArrayBuffer(32),0,2)` },
    },
    {
      name: `middle BigInt64Array view`,
      value: new BigInt64Array(new ArrayBuffer(32), 8, 2),
      expected: { source: `new BigInt64Array(new ArrayBuffer(32),8,2)` },
    },
    {
      name: `trailing BigInt64Array view`,
      value: new BigInt64Array(new ArrayBuffer(32), 16, 2),
      expected: { source: `new BigInt64Array(new ArrayBuffer(32),16)` },
    },
    {
      name: `resizable BigInt64Array`,
      value: new BigInt64Array(new ArrayBuffer(0, { maxByteLength: 1 })),
      expected: {
        source: `new BigInt64Array(new ArrayBuffer(0,{maxByteLength:1}))`,
      },
    },
    {
      name: `BigInt64Array with shared buffer reference`,
      value: (() => {
        const buffer = new ArrayBuffer()
        return [new BigInt64Array(buffer), new BigInt64Array(buffer)]
      })(),
      expected: {
        source: `(a=>[new BigInt64Array(a),new BigInt64Array(a)])(new ArrayBuffer)`,
      },
    },
    {
      name: `detached BigInt64Array`,
      value: (() => {
        const typedArray = new BigInt64Array()
        typedArray.buffer.transfer()
        return typedArray
      })(),
      expected: {
        source: `(a=>(a.buffer.transfer(),a))(new BigInt64Array)`,
      },
    },
    {
      name: `polluted BigInt64Array byteOffset`,
      value: (() => {
        const array = new BigInt64Array(new ArrayBuffer(32), 8, 2)
        Object.defineProperty(array, `byteOffset`, {
          value: `</script><script src='https://evil.com/hacked.js'>`,
        })
        return array
      })(),
      expected: {
        source: `new BigInt64Array(new ArrayBuffer(32),NaN,2)`,
        roundtrips: false,
      },
    },
    {
      name: `polluted BigInt64Array subclass`,
      value: (() => {
        class Evil extends BigInt64Array {}
        Object.defineProperty(Evil, `name`, {
          value: `</script><script>alert(1)//`,
        })
        return new Evil(1)
      })(),
      expected: {
        source: `new BigInt64Array(1)`,
        roundtrips: false,
      },
    },
    {
      name: `custom BigInt64Array`,
      value: new BigInt64Array([1n, -2n, 3n, 4n]),
      options: {
        custom: (value, uneval) =>
          value instanceof BigInt64Array
            ? `new BigInt64Array(${uneval([...value])})`
            : undefined,
      },
      expected: { source: `new BigInt64Array([1n,-2n,3n,4n])` },
    },
    {
      name: `custom bigint does not affect BigInt64Array`,
      value: new BigInt64Array([0n, 0n, 0n, 0n, 0n, 1n, 2n, 3n]),
      options: { custom: customBigInt },
      expected: { source: `BigInt64Array.of(0n,0n,0n,0n,0n,1n,2n,3n)` },
    },
    {
      name: `custom bigint does not affect BigInt64Array when bigint is sibling`,
      value: [new BigInt64Array([0n, 0n, 0n, 0n, 0n, 1n, 2n, 3n]), 0n],
      options: { custom: customBigInt },
      expected: {
        source: `[BigInt64Array.of(0n,0n,0n,0n,0n,1n,2n,3n),BigInt("0")]`,
      },
    },
    {
      name: `omit bigint does not affect BigInt64Array`,
      value: new BigInt64Array([0n, 0n, 0n, 0n, 0n, 1n, 2n, 3n]),
      options: { custom: value => (value === 0n ? null : undefined) },
      expected: { source: `BigInt64Array.of(0n,0n,0n,0n,0n,1n,2n,3n)` },
    },
    {
      name: `omit bigint does not affect BigInt64Array when bigint is sibling`,
      value: [new BigInt64Array([0n, 0n, 0n, 0n, 0n, 1n, 2n, 3n]), 0n],
      options: { custom: value => (value === 0n ? null : undefined) },
      expected: {
        source: `[BigInt64Array.of(0n,0n,0n,0n,0n,1n,2n,3n),,]`,
        roundtrips: false,
      },
    },
    {
      name: `custom ArrayBuffer affects BigInt64Array`,
      value: new BigInt64Array(
        new Uint8Array([1, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0]).buffer,
        0,
        1,
      ),
      options: {
        custom: (value, uneval) =>
          value instanceof ArrayBuffer
            ? `new Uint8Array(${uneval([...new Uint8Array(value)])}).buffer`
            : undefined,
      },
      expected: {
        source: `new BigInt64Array(new Uint8Array([1,0,0,0,0,0,0,0,2,0,0,0,0,0,0,0]).buffer,0,1)`,
      },
    },
    {
      name: `BigInt64Array view backed by pool-sized ArrayBuffer does not expose pool data`,
      value: (() => {
        const poolSizeBuffer = new ArrayBuffer(Buffer.poolSize)
        const arr = new BigInt64Array(poolSizeBuffer, 40, 3)
        arr[0] = 1n
        arr[1] = 2n
        arr[2] = 3n
        return arr
      })(),
      expected: {
        source: `new BigInt64Array(Uint8Array.of(1,0,0,0,0,0,0,0,2,0,0,0,0,0,0,0,3,0,0,0,0,0,0,0).buffer)`,
        roundtrips: false,
      },
    },
  ],

  BigUint64Array: [
    {
      name: `empty BigUint64Array`,
      value: new BigUint64Array(),
      expected: { source: `new BigUint64Array` },
    },
    {
      name: `non-empty uninitialized BigUint64Array`,
      value: new BigUint64Array(1024),
      expected: { source: `new BigUint64Array(1024)` },
    },
    {
      name: `non-empty initialized BigUint64Array`,
      value: new BigUint64Array([1n, 2n, 3n, 4n]),
      expected: { source: `BigUint64Array.of(1n,2n,3n,4n)` },
    },
    {
      name: `leading BigUint64Array view`,
      value: new BigUint64Array(new ArrayBuffer(32), 0, 2),
      expected: { source: `new BigUint64Array(new ArrayBuffer(32),0,2)` },
    },
    {
      name: `middle BigUint64Array view`,
      value: new BigUint64Array(new ArrayBuffer(32), 8, 2),
      expected: { source: `new BigUint64Array(new ArrayBuffer(32),8,2)` },
    },
    {
      name: `trailing BigUint64Array view`,
      value: new BigUint64Array(new ArrayBuffer(32), 16, 2),
      expected: { source: `new BigUint64Array(new ArrayBuffer(32),16)` },
    },
    {
      name: `resizable BigUint64Array`,
      value: new BigUint64Array(new ArrayBuffer(0, { maxByteLength: 1 })),
      expected: {
        source: `new BigUint64Array(new ArrayBuffer(0,{maxByteLength:1}))`,
      },
    },
    {
      name: `BigUint64Array with shared buffer reference`,
      value: (() => {
        const buffer = new ArrayBuffer()
        return [new BigUint64Array(buffer), new BigUint64Array(buffer)]
      })(),
      expected: {
        source: `(a=>[new BigUint64Array(a),new BigUint64Array(a)])(new ArrayBuffer)`,
      },
    },
    {
      name: `detached BigUint64Array`,
      value: (() => {
        const typedArray = new BigUint64Array()
        typedArray.buffer.transfer()
        return typedArray
      })(),
      expected: {
        source: `(a=>(a.buffer.transfer(),a))(new BigUint64Array)`,
      },
    },
    {
      name: `polluted BigUint64Array byteOffset`,
      value: (() => {
        const array = new BigUint64Array(new ArrayBuffer(32), 8, 2)
        Object.defineProperty(array, `byteOffset`, {
          value: `</script><script src='https://evil.com/hacked.js'>`,
        })
        return array
      })(),
      expected: {
        source: `new BigUint64Array(new ArrayBuffer(32),NaN,2)`,
        roundtrips: false,
      },
    },
    {
      name: `polluted BigUint64Array subclass`,
      value: (() => {
        class Evil extends BigUint64Array {}
        Object.defineProperty(Evil, `name`, {
          value: `</script><script>alert(1)//`,
        })
        return new Evil(1)
      })(),
      expected: {
        source: `new BigUint64Array(1)`,
        roundtrips: false,
      },
    },
    {
      name: `custom BigUint64Array`,
      value: new BigUint64Array([1n, 2n, 3n, 4n]),
      options: {
        custom: (value, uneval) =>
          value instanceof BigUint64Array
            ? `new BigUint64Array(${uneval([...value])})`
            : undefined,
      },
      expected: { source: `new BigUint64Array([1n,2n,3n,4n])` },
    },
    {
      name: `custom bigint does not affect BigUint64Array`,
      value: new BigUint64Array([0n, 0n, 0n, 0n, 0n, 1n, 2n, 3n]),
      options: { custom: customBigInt },
      expected: { source: `BigUint64Array.of(0n,0n,0n,0n,0n,1n,2n,3n)` },
    },
    {
      name: `custom bigint does not affect BigUint64Array when bigint is sibling`,
      value: [new BigUint64Array([0n, 0n, 0n, 0n, 0n, 1n, 2n, 3n]), 0n],
      options: { custom: customBigInt },
      expected: {
        source: `[BigUint64Array.of(0n,0n,0n,0n,0n,1n,2n,3n),BigInt("0")]`,
      },
    },
    {
      name: `omit bigint does not affect BigUint64Array`,
      value: new BigUint64Array([0n, 0n, 0n, 0n, 0n, 1n, 2n, 3n]),
      options: { custom: value => (value === 0n ? null : undefined) },
      expected: { source: `BigUint64Array.of(0n,0n,0n,0n,0n,1n,2n,3n)` },
    },
    {
      name: `omit bigint does not affect BigUint64Array when bigint is sibling`,
      value: [new BigUint64Array([0n, 0n, 0n, 0n, 0n, 1n, 2n, 3n]), 0n],
      options: { custom: value => (value === 0n ? null : undefined) },
      expected: {
        source: `[BigUint64Array.of(0n,0n,0n,0n,0n,1n,2n,3n),,]`,
        roundtrips: false,
      },
    },
    {
      name: `custom ArrayBuffer affects BigUint64Array`,
      value: new BigUint64Array(
        new Uint8Array([1, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0]).buffer,
        0,
        1,
      ),
      options: {
        custom: (value, uneval) =>
          value instanceof ArrayBuffer
            ? `new Uint8Array(${uneval([...new Uint8Array(value)])}).buffer`
            : undefined,
      },
      expected: {
        source: `new BigUint64Array(new Uint8Array([1,0,0,0,0,0,0,0,2,0,0,0,0,0,0,0]).buffer,0,1)`,
      },
    },
    {
      name: `BigUint64Array view backed by pool-sized ArrayBuffer does not expose pool data`,
      value: (() => {
        const poolSizeBuffer = new ArrayBuffer(Buffer.poolSize)
        const arr = new BigUint64Array(poolSizeBuffer, 40, 3)
        arr[0] = 1n
        arr[1] = 2n
        arr[2] = 3n
        return arr
      })(),
      expected: {
        source: `new BigUint64Array(Uint8Array.of(1,0,0,0,0,0,0,0,2,0,0,0,0,0,0,0,3,0,0,0,0,0,0,0).buffer)`,
        roundtrips: false,
      },
    },
  ],

  'Shared/circular reference': [
    {
      name: `shared object reference`,
      value: (() => {
        const object = {}
        return { a: object, b: object }
      })(),
      expected: { source: `(a=>({a,b:a}))({})` },
    },
    {
      name: `many shared object references`,
      value: (() => {
        const objects = Array.from({ length: 100 }, () => ({}))
        return [...objects, ...objects]
      })(),
      expected: {
        source: `((a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z,A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z,$aa,$ab,$ac,$ad,$ae,$af,$ag,$ah,$ai,$aj,$ak,$al,$am,$an,$ao,$ap,$aq,$ar,$as,$at,$au,$av,$aw,$ax,$ay,$az,$aA,$aB,$aC,$aD,$aE,$aF,$aG,$aH,$aI,$aJ,$aK,$aL,$aM,$aN,$aO,$aP,$aQ,$aR,$aS,$aT,$aU,$aV)=>[a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z,A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z,$aa,$ab,$ac,$ad,$ae,$af,$ag,$ah,$ai,$aj,$ak,$al,$am,$an,$ao,$ap,$aq,$ar,$as,$at,$au,$av,$aw,$ax,$ay,$az,$aA,$aB,$aC,$aD,$aE,$aF,$aG,$aH,$aI,$aJ,$aK,$aL,$aM,$aN,$aO,$aP,$aQ,$aR,$aS,$aT,$aU,$aV,a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z,A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z,$aa,$ab,$ac,$ad,$ae,$af,$ag,$ah,$ai,$aj,$ak,$al,$am,$an,$ao,$ap,$aq,$ar,$as,$at,$au,$av,$aw,$ax,$ay,$az,$aA,$aB,$aC,$aD,$aE,$aF,$aG,$aH,$aI,$aJ,$aK,$aL,$aM,$aN,$aO,$aP,$aQ,$aR,$aS,$aT,$aU,$aV])({},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{})`,
      },
    },
    {
      name: `directly circular object`,
      value: (() => {
        const circular: { ref?: unknown } = {}
        circular.ref = circular
        return circular
      })(),
      expected: { source: `(a=>a.ref=a)({})` },
    },
    {
      name: `object containing directly circular object`,
      value: (() => {
        const circular: { ref?: unknown } = {}
        circular.ref = circular
        return { circular }
      })(),
      expected: { source: `(a=>(a.ref=a,{circular:a}))({})` },
    },
    {
      name: `object containing directly circular object on property with same name as binding`,
      value: (() => {
        const circular: { ref?: unknown } = {}
        circular.ref = circular
        return { a: circular }
      })(),
      expected: { source: `(a=>(a.ref=a,{a}))({})` },
    },
    {
      name: `mutually circular object`,
      value: (() => {
        const circular1: { ref?: unknown } = {}
        const circular2 = { ref: circular1 }
        circular1.ref = circular2
        return circular1
      })(),
      expected: { source: `((b,a={ref:b})=>b.ref=a)({})` },
    },
    {
      name: `object containing mutually circular object`,
      value: (() => {
        const circular1: { ref?: unknown } = {}
        const circular2 = { ref: circular1 }
        circular1.ref = circular2
        return { circular: circular1 }
      })(),
      expected: { source: `((b,a={ref:b})=>(b.ref=a,{circular:a}))({})` },
    },
    {
      name: `object containing both mutually circular objects`,
      value: (() => {
        const circular1: { ref?: unknown } = {}
        const circular2 = { ref: circular1 }
        circular1.ref = circular2
        return { a: circular1, b: circular2 }
      })(),
      expected: { source: `((b,a={ref:b})=>(b.ref=a,{a,b}))({})` },
    },
    {
      name: `circular object through string property with spaces`,
      value: (() => {
        const circular: { 'a b c'?: unknown } = {}
        circular[`a b c`] = circular
        return circular
      })(),
      expected: { source: `(a=>a["a b c"]=a)({})` },
    },
    {
      name: `circular object through symbol property`,
      value: (() => {
        const circular: Record<PropertyKey, unknown> = {}
        circular[Symbol.hasInstance] = circular
        return circular
      })(),
      expected: { source: `(a=>a[Symbol.hasInstance]=a)({})` },
    },
    {
      name: `circular array`,
      value: (() => {
        const circular: unknown[] = []
        circular.push(circular)
        return circular
      })(),
      expected: { source: `(a=>a[0]=a)([])` },
    },
    {
      name: `mutually circular array`,
      value: (() => {
        const circular1: unknown[] = []
        const circular2: unknown[] = []
        circular2.push(circular1, circular2)
        circular1.push(circular2)
        return circular1
      })(),
      expected: { source: `((b,a=[b])=>(b[0]=a,b[1]=b,a))([,])` },
    },
    {
      name: `circular sparse array`,
      value: (() => {
        const circular: unknown[] = Array(100)
        circular[40] = circular
        return circular
      })(),
      expected: { source: `(a=>a[40]=a)(Array(100))` },
    },
    {
      name: `circular sparse array with some non-circular values`,
      value: (() => {
        const circular: unknown[] = Array(100)
        circular[40] = circular
        circular[50] = 42
        return circular
      })(),
      expected: { source: `(a=>a[40]=a)(Object.assign(Array(100),{50:42}))` },
    },
    {
      name: `circular own __proto__`,
      value: (() => {
        const circular = {}
        return Object.defineProperty(circular, `__proto__`, {
          value: circular,
          configurable: true,
          enumerable: true,
          writable: true,
        })
      })(),
      expected: {
        source: `(a=>Object.defineProperty(a,"__proto__",{value:a,configurable:!0,enumerable:!0,writable:!0}))({})`,
      },
    },
    {
      name: `circular property preserves order with non-circular properties after`,
      value: (() => {
        const obj: Record<string, unknown> = { a: 1 }
        obj.self = obj
        obj.b = 2
        return obj
      })(),
      expected: { source: `(a=>a.self=a)({a:1,self:null,b:2})` },
    },
    {
      name: `multiple circular properties with non-circular properties between`,
      value: (() => {
        const obj: Record<string, unknown> = {}
        obj.ref1 = obj
        obj.middle = 42
        obj.ref2 = obj
        obj.end = 99
        return obj
      })(),
      expected: {
        source: `(a=>(a.ref1=a,a.ref2=a))({ref1:null,middle:42,ref2:null,end:99})`,
      },
    },
    {
      name: `trailing circular property does not get placeholder`,
      value: (() => {
        const obj: Record<string, unknown> = { a: 1 }
        obj.self = obj
        return obj
      })(),
      expected: { source: `(a=>a.self=a)({a:1})` },
    },
    {
      name: `non-regular circular descriptor preserves order before non-circular descriptor`,
      value: (() => {
        const obj = {}
        Object.defineProperty(obj, `circ`, { value: obj })
        Object.defineProperty(obj, `other`, { value: 42 })
        return obj
      })(),
      expected: {
        source: `(a=>Object.defineProperty(a,"circ",{value:a,configurable:!1}))(Object.defineProperties({},{circ:{configurable:!0},other:{value:42}}))`,
      },
    },
    {
      name: `trailing non-regular circular descriptor does not get placeholder`,
      value: (() => {
        const obj = {}
        Object.defineProperty(obj, `other`, { value: 42 })
        Object.defineProperty(obj, `circ`, { value: obj })
        return obj
      })(),
      expected: {
        source: `(a=>Object.defineProperty(a,"circ",{value:a}))(Object.defineProperties({},{other:{value:42}}))`,
      },
    },
    {
      name: `regular circular property preserves order before non-regular non-circular`,
      value: (() => {
        const obj: Record<string, unknown> = {}
        obj.circ = obj
        Object.defineProperty(obj, `other`, { value: 42 })
        return obj
      })(),
      expected: {
        source: `(a=>a.circ=a)(Object.defineProperties({circ:null},{other:{value:42}}))`,
      },
    },
    {
      name: `non-regular non-circular then trailing regular circular`,
      value: (() => {
        const obj: Record<string, unknown> = {}
        Object.defineProperty(obj, `other`, { value: 42 })
        obj.circ = obj
        return obj
      })(),
      expected: {
        source: `(a=>Object.defineProperty(a,"circ",{value:a,configurable:!0,enumerable:!0,writable:!0}))(Object.defineProperties({},{other:{value:42}}))`,
      },
    },
    {
      name: `configurable circular descriptor preserves order before non-circular descriptor`,
      value: (() => {
        const obj = {}
        Object.defineProperty(obj, `circ`, { value: obj, configurable: true })
        Object.defineProperty(obj, `other`, { value: 42 })
        return obj
      })(),
      expected: {
        source: `(a=>Object.defineProperty(a,"circ",{value:a,configurable:!0}))(Object.defineProperties({},{circ:{configurable:!0},other:{value:42}}))`,
      },
    },
    {
      name: `writable circular descriptor preserves order before non-circular descriptor`,
      value: (() => {
        const obj = {}
        Object.defineProperty(obj, `circ`, { value: obj, writable: true })
        Object.defineProperty(obj, `other`, { value: 42 })
        return obj
      })(),
      expected: {
        source: `(a=>Object.defineProperty(a,"circ",{value:a,writable:!0,configurable:!1}))(Object.defineProperties({},{circ:{configurable:!0},other:{value:42}}))`,
      },
    },
    {
      name: `prototype containing circular reference`,
      value: (() => {
        const circular1 = {}
        const circular2 = { ref: circular1 }
        return Object.setPrototypeOf(circular1, circular2) as unknown
      })(),
      expected: { source: `((b,a=Object.setPrototypeOf({},b))=>b.ref=a)({})` },
    },
    {
      name: `directly circular set`,
      value: (() => {
        const circular = new Set()
        circular.add(circular)
        return circular
      })(),
      expected: { source: `(a=>a.add(a))(new Set)` },
    },
    {
      name: `set containing value with circular reference`,
      value: (() => {
        const circular = new Set()
        circular.add({ '': circular })
        return circular
      })(),
      expected: { source: `((b,a=new Set([b]))=>b[""]=a)({})` },
    },
    {
      name: `set with non-circular before and after circular`,
      value: (() => {
        const circular = new Set<unknown>()
        circular.add(1)
        circular.add(circular)
        circular.add(2)
        return circular
      })(),
      expected: { source: `(a=>(a.add(a),a.add(2)))(new Set([1]))` },
    },
    {
      name: `set with multiple circular values with non-circular between`,
      value: (() => {
        const obj: Record<string, unknown> = {}
        const circular = new Set<unknown>()
        circular.add(circular)
        circular.add(1)
        circular.add(obj)
        obj.ref = circular
        return circular
      })(),
      expected: {
        source: `((b,a)=>(a.add(a),a.add(1),b.ref=a,a.add(b)))({},new Set)`,
      },
    },
    {
      name: `directly circular map entry value`,
      value: (() => {
        const circular = new Map()
        circular.set(`hi`, circular)
        return circular
      })(),
      expected: { source: `(a=>a.set("hi",a))(new Map([["hi"]]))` },
    },
    {
      name: `circular map containing value with circular reference`,
      value: (() => {
        const circular = new Map()
        circular.set(`hi`, circular)
        circular.set(`hello`, { circular })
        return circular
      })(),
      expected: {
        source: `((b,a=new Map([["hi"],["hello",b]]))=>(a.set("hi",a),b.circular=a))({})`,
      },
    },
    {
      name: `directly circular map entry key`,
      value: (() => {
        const circular = new Map()
        circular.set(circular, `howdy`)
        return circular
      })(),
      expected: { source: `(a=>a.set(a,"howdy"))(new Map)` },
    },
    {
      name: `map containing key with circular reference`,
      value: (() => {
        const circular = new Map()
        circular.set({ '': circular }, circular)
        return circular
      })(),
      expected: { source: `((b,a=new Map([[b]]))=>(b[""]=a,a.set(b,a)))({})` },
    },
    {
      name: `map containing entry value map with circular key to outer map`,
      value: (() => {
        const circular = new Map()
        circular.set({}, { '': new Map([[circular, new Map()]]) })
        return circular
      })(),
      expected: {
        source: `((b,a=new Map([[{},{"":b}]]))=>(b.set(a,new Map),a))(new Map)`,
      },
    },
    {
      name: `map containing array key with circular reference to outer map`,
      value: (() => {
        const array: unknown[] = []
        const circular = new Map([[array, {}]])
        array.push(circular)
        return circular
      })(),
      expected: { source: `((b,a=new Map([[b,{}]]))=>b[0]=a)([])` },
    },
    {
      name: `absurd circular map`,
      value: (() => {
        const d = {}
        const c = { '': d }
        const b = new Map<unknown, unknown>([[c, undefined]])
        const a = [b, [d]]
        b.set(c, a)
        return a
      })(),
      expected: {
        source: `((d,c={"":d},b=new Map([[c]]),a=[b,[d]])=>(b.set(c,a),a))({})`,
      },
    },
    {
      name: `map with entries before and after circular key preserves iteration order`,
      value: (() => {
        const map = new Map<unknown, unknown>()
        map.set(`a`, 1)
        map.set(map, `self`)
        map.set(`b`, 2)
        return map
      })(),
      expected: {
        source: `(a=>(a.set(a,"self"),a.set("b",2)))(new Map([["a",1]]))`,
      },
    },
    {
      name: `map with multiple circular keys and non-circular entries between them`,
      value: (() => {
        const obj = {} as Record<string, unknown>
        const map = new Map<unknown, unknown>()
        map.set(`first`, 1)
        map.set(map, `self`)
        map.set(`middle`, 2)
        map.set(obj, `obj`)
        map.set(`last`, 3)
        obj.map = map
        return map
      })(),
      expected: {
        source: `((b,a)=>(a.set(a,"self"),a.set("middle",2),b.map=a,a.set(b,"obj"),a.set("last",3)))({},new Map([["first",1]]))`,
      },
    },
    {
      name: `map with circular key whose value has a binding`,
      value: (() => {
        const obj = {}
        const map = new Map<unknown, unknown>()
        map.set(map, obj)
        map.set(`x`, obj)
        return map
      })(),
      expected: { source: `((b,a)=>(a.set(a,b),a.set("x",b)))({},new Map)` },
    },
    {
      name: `absurd circular set and object`,
      value: (() => {
        const c: Record<string, unknown> = {}
        const b: unknown[] = [, c]
        const a = new Set([b])
        b[0] = a
        c[``] = a
        return a
      })(),
      expected: { source: `((c,b=[,c],a=new Set([b]))=>(b[0]=a,c[""]=a))({})` },
    },
    {
      name: `custom shared object`,
      value: (() => {
        const object = { x: 1 }
        return [object, object]
      })(),
      options: {
        custom: value =>
          typeof value === `object` && value !== null && !Array.isArray(value)
            ? null
            : undefined,
      },
      expected: {
        source: `[,,]`,
        roundtrips: false,
      },
    },
  ],

  Function: [
    {
      name: `Function`,
      value: () => {},
      expected: {
        error: `Unsupported: Function`,
      },
    },
    {
      name: `GeneratorFunction`,
      // eslint-disable-next-line object-shorthand
      value: function* () {},
      expected: {
        error: `Unsupported: GeneratorFunction`,
      },
    },
    {
      name: `AsyncFunction`,
      value: async () => {},
      expected: {
        error: `Unsupported: AsyncFunction`,
      },
    },
    {
      name: `AsyncGeneratorFunction`,
      // eslint-disable-next-line object-shorthand
      value: async function* () {},
      expected: {
        error: `Unsupported: AsyncGeneratorFunction`,
      },
    },
  ],

  Promise: [
    {
      name: `Promise`,
      value: Promise.resolve(42),
      expected: {
        error: `Unsupported: Promise`,
      },
    },
  ],

  SharedArrayBuffer: [
    {
      name: `SharedArrayBuffer`,
      value: new SharedArrayBuffer(),
      expected: {
        error: `Unsupported: SharedArrayBuffer`,
      },
    },
  ],

  WeakSet: [
    {
      name: `WeakSet`,
      value: new WeakSet(),
      expected: {
        error: `Unsupported: WeakSet`,
      },
    },
  ],

  WeakMap: [
    {
      name: `WeakMap`,
      value: new WeakMap(),
      expected: {
        error: `Unsupported: WeakMap`,
      },
    },
  ],

  Custom: [
    {
      name: `custom option for functions`,
      value: { x: 42, f: () => `hi` },
      options: {
        custom: value =>
          typeof value === `function` ? String(value) : undefined,
      },
      expected: {
        source: `{x:42,f:() => \`hi\`}`,
        roundtrips: false,
      },
    },
    (() => {
      class Person {
        public name: string

        public constructor(name: string) {
          this.name = name
        }
      }
      // So that we can test roundtripping works.
      ;(globalThis as Record<string, unknown>).Person = Person

      return {
        name: `custom option for classes`,
        value: new Person(`Tomer`),
        options: {
          custom: (value, uneval) =>
            value instanceof Person
              ? `new Person(${uneval(value.name)})`
              : undefined,
        },
        expected: { source: `new Person("Tomer")` },
      }
    })(),
    {
      name: `custom option with nested behavior`,
      value: Symbol(`hi`),
      options: {
        custom: (value, uneval) => {
          if (typeof value === `string`) {
            const uppercase = value.toUpperCase()
            if (uppercase === value) {
              // Avoid infinite recursion.
              return undefined
            }
            return uneval(uppercase)
          }

          if (typeof value === `symbol`) {
            return `Symbol(${
              // This should delegate to the above.
              uneval(value.description)
            })`
          }

          return undefined
        },
      },
      expected: {
        source: `Symbol("HI")`,
        roundtrips: false,
      },
    },
    (() => {
      let callCount = 0
      const shared = {}
      return {
        name: `custom option with repeated object`,
        value: [shared, {}, shared],
        options: {
          custom: (value, uneval) => {
            if (
              !Array.isArray(value) &&
              value !== null &&
              typeof value === `object`
            ) {
              callCount++
              return uneval(`OBJECT ${callCount}!`)
            }

            return undefined
          },
        },
        expected: {
          source: `(a=>[a,"OBJECT 2!",a])("OBJECT 1!")`,
          roundtrips: false,
        },
      }
    })(),
    (() => {
      let callCount = 0
      return {
        name: `custom option with repeated primitive`,
        value: { a: 1, b: 1, c: 1 },
        options: {
          custom: (value, uneval) => {
            if (typeof value === `number`) {
              expect(callCount).toBe(0)
              callCount++
              return uneval(String(value))
            }

            return undefined
          },
        },
        expected: {
          source: `{a:"1",b:"1",c:"1"}`,
          roundtrips: false,
        },
      }
    })(),
    {
      name: `omit root`,
      value: 42,
      options: { custom: () => null },
      expected: {
        error: `Root omitted`,
      },
    },
  ],
}

for (let [category, categoryCases] of Object.entries(cases)) {
  if (isComparison) {
    categoryCases = categoryCases.filter(
      ({ expected, options, compare = true }) =>
        compare &&
        (!(`source` in expected) ||
          // If the test case doesn't roundtrip, then there's nothing to compare
          // because we don't assert on source when comparing.
          (expected.roundtrips ?? true)) &&
        // If this test case requires options, then it's specific to this
        // package and probably isn't portable to other package. It wouldn't be
        // fair to consider these test cases.
        !options,
    )
  }
  if (categoryCases.length === 0) {
    continue
  }

  describe(category, () => {
    for (const { todo, name, value, expected, options } of categoryCases) {
      // When comparing, we should run todo cases in because other packages
      // may successfully handle them.
      ;(todo && !isComparison ? test.todo : test)(`uneval '${name}'`, () => {
        if (isComparison) {
          // When comparing with packages, we don't fail other packages if they
          // output slightly different source. That's fine as long as their
          // source still roundtrips.
          expectUnevalRoundtrips(value)
          return
        }

        if (`error` in expected) {
          expect(() => uneval(value, options)).toThrowError(
            expected.error === true ? undefined : expected.error,
          )
          return
        }

        const { source, roundtrips = true } = expected
        const actualSource = (roundtrips ? expectUnevalRoundtrips : uneval)(
          value,
          options,
        )

        expect(actualSource).toBe(source)
      })
    }
  })
}

describe.skipIf(isComparison)(`invariants`, () => {
  test.prop([anythingArb], { numRuns: 100_000 })(`uneval works`, value => {
    const source = expectUnevalRoundtrips(value)
    // Ensure no `</script>` XSS.
    expect(source).not.toMatch(/<\/script>/gi)
  })
})

const expectUnevalRoundtrips = (
  value: unknown,
  options?: UnevalOptions,
): string => {
  const source = uneval(value, options)

  let roundtrippedValue: unknown
  try {
    // eslint-disable-next-line no-eval
    roundtrippedValue = (0, eval)(`(${source})`) as unknown
    expect(roundtrippedValue, source).toStrictEqual(value)
  } catch (error: unknown) {
    console.log(value)
    console.log(source)
    throw error
  }

  return source
}
