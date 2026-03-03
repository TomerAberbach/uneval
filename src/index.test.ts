/* eslint-disable id-length */
/* eslint-disable prefer-regex-literals */
/* eslint-disable require-unicode-regexp */
/* eslint-disable no-sparse-arrays */
/* eslint-disable unicorn/new-for-builtins */
/* eslint-disable no-new-wrappers */

import { assertNoPoisoning, restoreGlobals } from '@fast-check/poisoning'
import { fc, test } from '@fast-check/vitest'
import { afterEach, expect } from 'vitest'
import { anythingArb } from './arbs.ts'
import type { UnevalOptions } from './index.ts'
import uneval from './package.ts'

const ignoredRootRegex = /^(?:__vitest_.*|Person)$/u
const poisoningAfterEach = () => {
  try {
    assertNoPoisoning({ ignoredRootRegex })
  } catch (error: unknown) {
    restoreGlobals({ ignoredRootRegex })
    throw error
  }
}
fc.configureGlobal({ afterEach: poisoningAfterEach })
afterEach(poisoningAfterEach)

test.prop([anythingArb], { numRuns: 100_000 })(`uneval works`, value => {
  const source = expectUnevalRoundtrips(value)
  // Ensure no `</script>` XSS.
  expect(source).not.toMatch(/<\/script>/gi)
})

type Case = {
  name: string
  value: unknown
  source: string
  options?: UnevalOptions
  roundtrips?: boolean
}

const customBoolean: UnevalOptions[`custom`] = value =>
  typeof value === `boolean` ? String(value) : undefined
const customNumber: UnevalOptions[`custom`] = value =>
  typeof value === `number` && Number.isInteger(value)
    ? `${value}.0`
    : undefined
const customString: UnevalOptions[`custom`] = value =>
  typeof value === `string` ? `'${value}'` : undefined
const customBigInt: UnevalOptions[`custom`] = value =>
  typeof value === `bigint` ? `BigInt(${value})` : undefined
const customSymbol: UnevalOptions[`custom`] = (value, uneval) =>
  typeof value === `symbol` ? `Symbol(${uneval(value.description)})` : undefined

test.each<Case>([
  // Undefined
  { name: `undefined`, value: undefined, source: `void 0` },
  {
    name: `custom undefined`,
    value: undefined,
    options: {
      custom: value => (value === undefined ? `undefined` : undefined),
    },
    source: `undefined`,
  },
  {
    name: `omit undefined from array`,
    value: [1, undefined, 3],
    options: { custom: value => (value === undefined ? null : undefined) },
    source: `[1,,3]`,
    roundtrips: false,
  },

  // Null
  { name: `null`, value: null, source: `null` },
  {
    name: `custom null`,
    value: null,
    options: {
      custom: value => (value === null ? `JSON.parse("null")` : undefined),
    },
    source: `JSON.parse("null")`,
  },
  {
    name: `omit null from array`,
    value: [1, null, 3],
    options: { custom: value => (value === null ? null : undefined) },
    source: `[1,,3]`,
    roundtrips: false,
  },

  // Boolean
  { name: `false`, value: false, source: `!1` },
  { name: `boxed false`, value: new Boolean(false), source: `Object(!1)` },
  { name: `true`, value: true, source: `!0` },
  { name: `boxed true`, value: new Boolean(true), source: `Object(!0)` },
  {
    name: `custom boolean`,
    value: true,
    options: { custom: customBoolean },
    source: `true`,
  },
  {
    name: `custom boolean affects boxed boolean`,
    value: new Boolean(true),
    options: { custom: customBoolean },
    source: `Object(true)`,
  },
  {
    name: `omit boolean from array`,
    value: [true, 1],
    options: { custom: value => (value === true ? null : undefined) },
    source: `[,1]`,
    roundtrips: false,
  },
  {
    name: `omit boolean cascades to boxed boolean`,
    value: [new Boolean(true), 1],
    options: { custom: value => (value === true ? null : undefined) },
    source: `[,1]`,
    roundtrips: false,
  },

  // Number
  { name: `zero`, value: 0, source: `0` },
  { name: `boxed zero`, value: new Number(0), source: `Object(0)` },
  { name: `negative zero`, value: -0, source: `-0` },
  {
    name: `boxed negative zero`,
    value: new Number(-0),
    source: `Object(-0)`,
  },
  { name: `positive integer`, value: 42, source: `42` },
  {
    name: `boxed positive integer`,
    value: new Number(42),
    source: `Object(42)`,
  },
  { name: `negative integer`, value: -42, source: `-42` },
  {
    name: `boxed negative integer`,
    value: new Number(-42),
    source: `Object(-42)`,
  },
  { name: `positive decimal`, value: 3.14, source: `3.14` },
  {
    name: `boxed positive decimal`,
    value: new Number(3.14),
    source: `Object(3.14)`,
  },
  { name: `negative decimal`, value: -3.14, source: `-3.14` },
  {
    name: `boxed negative decimal`,
    value: new Number(-3.14),
    source: `Object(-3.14)`,
  },
  { name: `decimal between 0 and 1`, value: 0.12, source: `.12` },
  {
    name: `boxed decimal between 0 and 1`,
    value: new Number(0.12),
    source: `Object(.12)`,
  },
  { name: `decimal between -1 and 0`, value: -0.12, source: `-.12` },
  {
    name: `boxed decimal between -1 and 0`,
    value: new Number(-0.12),
    source: `Object(-.12)`,
  },
  {
    name: `max safe integer value`,
    value: Number.MAX_SAFE_INTEGER,
    source: `9007199254740991`,
  },
  {
    name: `boxed max safe integer value`,
    value: new Number(Number.MAX_SAFE_INTEGER),
    source: `Object(9007199254740991)`,
  },
  {
    name: `max number value`,
    value: Number.MAX_VALUE,
    source: `1.7976931348623157e+308`,
  },
  {
    name: `boxed max number value`,
    value: new Number(Number.MAX_VALUE),
    source: `Object(1.7976931348623157e+308)`,
  },
  {
    name: `min safe integer value`,
    value: Number.MIN_SAFE_INTEGER,
    source: `-9007199254740991`,
  },
  {
    name: `boxed min safe integer value`,
    value: new Number(Number.MIN_SAFE_INTEGER),
    source: `Object(-9007199254740991)`,
  },
  {
    name: `min number value`,
    value: Number.MIN_VALUE,
    source: `5e-324`,
  },
  {
    name: `boxed min number value`,
    value: new Number(Number.MIN_VALUE),
    source: `Object(5e-324)`,
  },
  { name: `NaN`, value: Number.NaN, source: `NaN` },
  {
    name: `boxed NaN`,
    value: new Number(Number.NaN),
    source: `Object(NaN)`,
  },
  { name: `infinity`, value: Infinity, source: `1/0` },
  {
    name: `boxed infinity`,
    value: new Number(Infinity),
    source: `Object(1/0)`,
  },
  { name: `negative infinity`, value: -Infinity, source: `-1/0` },
  {
    name: `boxed negative infinity`,
    value: new Number(-Infinity),
    source: `Object(-1/0)`,
  },
  {
    name: `custom number`,
    value: 42,
    options: { custom: customNumber },
    source: `42.0`,
  },
  {
    name: `custom number affects boxed number`,
    value: new Number(42),
    options: { custom: customNumber },
    source: `Object(42.0)`,
  },
  {
    name: `omit number from array`,
    value: [42, 1],
    options: { custom: value => (value === 42 ? null : undefined) },
    source: `[,1]`,
    roundtrips: false,
  },
  {
    name: `omit number cascades to boxed number`,
    value: [new Number(42), 1],
    options: { custom: value => (value === 42 ? null : undefined) },
    source: `[,1]`,
    roundtrips: false,
  },

  // BigInt
  { name: `zero bigint`, value: 0n, source: `0n` },
  { name: `negative zero bigint`, value: -0n, source: `0n` },
  { name: `positive bigint`, value: 42n, source: `42n` },
  { name: `negative bigint`, value: -42n, source: `-42n` },
  {
    name: `large positive bigint`,
    value: 2_347_623_847_628_347_263_123n,
    source: `2347623847628347263123n`,
  },
  {
    name: `large negative bigint`,
    value: -2_347_623_847_628_347_263_123n,
    source: `-2347623847628347263123n`,
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
    source: `BigInt("42")`,
  },
  {
    name: `omit bigint from array`,
    value: [42n, 1],
    options: { custom: value => (value === 42n ? null : undefined) },
    source: `[,1]`,
    roundtrips: false,
  },

  // String
  { name: `empty string`, value: ``, source: `""` },
  { name: `boxed empty string`, value: new String(``), source: `Object("")` },
  { name: `single character string`, value: `a`, source: `"a"` },
  {
    name: `boxed single character string`,
    value: new String(`a`),
    source: `Object("a")`,
  },
  { name: `string with spaces`, value: `a b c`, source: `"a b c"` },
  {
    name: `boxed string with spaces`,
    value: new String(`a b c`),
    source: `Object("a b c")`,
  },
  { name: `string with single quotes`, value: `'''`, source: `"'''"` },
  {
    name: `boxed string with single quotes`,
    value: new String(`'''`),
    source: `Object("'''")`,
  },
  { name: `string with double quote`, value: `"`, source: `"\\""` },
  {
    name: `boxed string with double quote`,
    value: new String(`"`),
    source: `Object("\\"")`,
  },
  { name: `backslash string`, value: `\\`, source: `"\\\\"` },
  {
    name: `boxed backslash string`,
    value: new String(`\\`),
    source: `Object("\\\\")`,
  },
  { name: `null terminator string`, value: `\0`, source: `"\\0"` },
  {
    name: `boxed null terminator string`,
    value: new String(`\0`),
    source: `Object("\\0")`,
  },
  { name: `newline string`, value: `\n`, source: `"\\n"` },
  {
    name: `boxed newline string`,
    value: new String(`\n`),
    source: `Object("\\n")`,
  },
  { name: `carriage return string`, value: `\r`, source: `"\\r"` },
  {
    name: `boxed carriage return string`,
    value: new String(`\r`),
    source: `Object("\\r")`,
  },
  { name: `tab string`, value: `\t`, source: `"\\t"` },
  {
    name: `boxed tab string`,
    value: new String(`\t`),
    source: `Object("\\t")`,
  },
  { name: `backspace string`, value: `\b`, source: `"\\b"` },
  {
    name: `boxed backspace string`,
    value: new String(`\b`),
    source: `Object("\\b")`,
  },
  { name: `form feed string`, value: `\f`, source: `"\\f"` },
  {
    name: `boxed form feed string`,
    value: new String(`\f`),
    source: `Object("\\f")`,
  },
  { name: `vertical tabulator string`, value: `\v`, source: `"\\v"` },
  {
    name: `boxed vertical tabulator string`,
    value: new String(`\v`),
    source: `Object("\\v")`,
  },
  { name: `line separator string`, value: `\u2028`, source: `"\\u2028"` },
  {
    name: `boxed line separator string`,
    value: new String(`\u2028`),
    source: `Object("\\u2028")`,
  },
  {
    name: `multiple line separators string`,
    value: `\u2028\u2028`,
    source: `"\\u2028\\u2028"`,
  },
  {
    name: `boxed multiple line separators string`,
    value: new String(`\u2028\u2028`),
    source: `Object("\\u2028\\u2028")`,
  },
  { name: `paragraph separator string`, value: `\u2029`, source: `"\\u2029"` },
  {
    name: `boxed paragraph separator string`,
    value: new String(`\u2029`),
    source: `Object("\\u2029")`,
  },
  {
    name: `multiple paragraph separators string`,
    value: `\u2029\u2029`,
    source: `"\\u2029\\u2029"`,
  },
  {
    name: `boxed multiple paragraph separators string`,
    value: new String(`\u2029\u2029`),
    source: `Object("\\u2029\\u2029")`,
  },
  {
    name: `string with closing script tag`,
    value: `</script>`,
    source: `"<\\u002fscript>"`,
  },
  {
    name: `string with multiple closing script tags`,
    value: ` </script> sdf </script> sdfsfd </script>  sdf </script>`,
    source: `" <\\u002fscript> sdf <\\u002fscript> sdfsfd <\\u002fscript>  sdf <\\u002fscript>"`,
  },
  {
    name: `boxed string with closing script tag`,
    value: new String(`</script>`),
    source: `Object("<\\u002fscript>")`,
  },
  {
    name: `string with capitalized closing script tag`,
    value: `</SCRIPT>`,
    source: `"<\\u002fSCRIPT>"`,
  },
  {
    name: `boxed string with capitalized closing script tag`,
    value: new String(`</SCRIPT>`),
    source: `Object("<\\u002fSCRIPT>")`,
  },
  {
    name: `string with mixed capitalization closing script tag`,
    value: `</sCrIpT>`,
    source: `"<\\u002fsCrIpT>"`,
  },
  {
    name: `boxed string with mixed capitalization capitalized closing script tag`,
    value: new String(`</sCrIpT>`),
    source: `Object("<\\u002fsCrIpT>")`,
  },
  {
    name: `string with closing script tag with whitespace`,
    value: `</script   >`,
    source: `"<\\u002fscript   >"`,
  },
  {
    name: `boxed string with closing script tag with whitespace`,
    value: new String(`</script   >`),
    source: `Object("<\\u002fscript   >")`,
  },
  {
    name: `string with unpaired low surrogate`,
    value: `\uDC00`,
    source: `"\\udc00"`,
  },
  {
    name: `boxed string with unpaired low surrogate`,
    value: new String(`\uDC00`),
    source: `Object("\\udc00")`,
  },
  {
    name: `string with unpaired high surrogate`,
    value: `\uD800`,
    source: `"\\ud800"`,
  },
  {
    name: `boxed string with unpaired high surrogate`,
    value: new String(`\uD800`),
    source: `Object("\\ud800")`,
  },
  {
    name: `string with unpaired low surrogate in middle`,
    value: `a\uDC00b`,
    source: `"a\\udc00b"`,
  },
  {
    name: `boxed string with unpaired low surrogate in middle`,
    value: new String(`a\uDC00b`),
    source: `Object("a\\udc00b")`,
  },
  {
    name: `string with unpaired high surrogate in middle`,
    value: `a\uD800b`,
    source: `"a\\ud800b"`,
  },
  {
    name: `boxed string with unpaired high surrogate in middle`,
    value: new String(`a\uD800b`),
    source: `Object("a\\ud800b")`,
  },
  {
    name: `string with multiple unpaired surrogates`,
    value: `\uD800\uDBFF`,
    source: `"\\ud800\\udbff"`,
  },
  {
    name: `boxed string with multiple unpaired surrogates`,
    value: new String(`\uD800\uDBFF`),
    source: `Object("\\ud800\\udbff")`,
  },
  {
    name: `string with surrogate pair`,
    value: `\uD83D\uDE00`,
    source: `"😀"`,
  },
  {
    name: `boxed string with surrogate pair`,
    value: new String(`\uD83D\uDE00`),
    source: `Object("😀")`,
  },
  {
    name: `custom string`,
    value: `Hello!`,
    options: { custom: customString },
    source: `'Hello!'`,
  },
  {
    name: `custom string affects boxed string`,
    value: new String(`Hello!`),
    options: { custom: customString },
    source: `Object('Hello!')`,
  },
  {
    name: `omit string from array`,
    value: [`hello`, 1],
    options: { custom: value => (value === `hello` ? null : undefined) },
    source: `[,1]`,
    roundtrips: false,
  },
  {
    name: `omit string cascades to boxed string`,
    value: [new String(`hello`), 1],
    options: { custom: value => (value === `hello` ? null : undefined) },
    source: `[,1]`,
    roundtrips: false,
  },

  // Symbol
  {
    name: `async dispose symbol`,
    value: Symbol.asyncDispose,
    source: `Symbol.asyncDispose`,
  },
  {
    name: `async iterator symbol`,
    value: Symbol.asyncIterator,
    source: `Symbol.asyncIterator`,
  },
  { name: `dispose symbol`, value: Symbol.dispose, source: `Symbol.dispose` },
  {
    name: `instanceof symbol`,
    value: Symbol.hasInstance,
    source: `Symbol.hasInstance`,
  },
  {
    name: `is concat spreadable symbol`,
    value: Symbol.isConcatSpreadable,
    source: `Symbol.isConcatSpreadable`,
  },
  {
    name: `iterator symbol`,
    value: Symbol.iterator,
    source: `Symbol.iterator`,
  },
  { name: `match symbol`, value: Symbol.match, source: `Symbol.match` },
  {
    name: `match all symbol`,
    value: Symbol.matchAll,
    source: `Symbol.matchAll`,
  },
  { name: `replace symbol`, value: Symbol.replace, source: `Symbol.replace` },
  { name: `search symbol`, value: Symbol.search, source: `Symbol.search` },
  { name: `species symbol`, value: Symbol.species, source: `Symbol.species` },
  { name: `split symbol`, value: Symbol.split, source: `Symbol.split` },
  {
    name: `to primitive symbol`,
    value: Symbol.toPrimitive,
    source: `Symbol.toPrimitive`,
  },
  {
    name: `to string tag symbol`,
    value: Symbol.toStringTag,
    source: `Symbol.toStringTag`,
  },
  {
    name: `unscopables symbol`,
    value: Symbol.unscopables,
    source: `Symbol.unscopables`,
  },
  {
    name: `global symbol registry symbol`,
    value: Symbol.for(`howdy`),
    source: `Symbol.for("howdy")`,
  },
  {
    name: `custom symbol`,
    value: Symbol(`hi`),
    options: { custom: customSymbol },
    source: `Symbol("hi")`,
    roundtrips: false,
  },
  {
    name: `custom string does not affect symbol`,
    value: Symbol.for(`hi`),
    options: { custom: customString },
    source: `Symbol.for("hi")`,
  },

  // Array
  { name: `empty array`, value: [], source: `[]` },
  { name: `non-empty array`, value: [1, 2, 3], source: `[1,2,3]` },
  {
    name: `sparse array with all empty slots`,
    value: [, , ,],
    source: `[,,,]`,
  },
  {
    name: `sparse array with leading empty slots`,
    value: [, 1, 2, 3],
    source: `[,1,2,3]`,
  },
  {
    name: `sparse array with trailing empty slots`,
    value: [1, 2, 3, ,],
    source: `[1,2,3,,]`,
  },
  {
    name: `sparse array with leading and trailing empty slots`,
    value: [, 1, 2, 3, ,],
    source: `[,1,2,3,,]`,
  },
  {
    name: `sparse array with middle empty slots`,
    value: [1, , , , , 2],
    source: `[1,,,,,2]`,
  },
  {
    name: `custom array`,
    value: [1, 2, 3],
    options: {
      custom: (value, uneval) =>
        Array.isArray(value) ? `[${value.map(uneval).join(`, `)}]` : undefined,
    },
    source: `[1, 2, 3]`,
  },
  {
    name: `custom element affects array`,
    value: [1, 2, 3],
    options: { custom: customNumber },
    source: `[1.0,2.0,3.0]`,
  },
  {
    name: `omit array element`,
    value: [1, 2, 3],
    options: { custom: value => (value === 2 ? null : undefined) },
    source: `[1,,3]`,
    roundtrips: false,
  },
  {
    name: `omit trailing array element`,
    value: [1, 2, 3],
    options: { custom: value => (value === 3 ? null : undefined) },
    source: `[1,2,,]`,
    roundtrips: false,
  },

  // Object
  { name: `empty object`, value: {}, source: `{}` },
  {
    name: `object with single character property`,
    value: { a: 2 },
    source: `{a:2}`,
  },
  {
    name: `object with string property`,
    value: { ab: 2 },
    source: `{ab:2}`,
  },
  {
    name: `object with string with spaces property`,
    value: { 'a b c': 2 },
    source: `{"a b c":2}`,
  },
  {
    name: `object with string with underscores property`,
    value: { __a__: 2 },
    source: `{__a__:2}`,
  },
  {
    name: `object with string with dollar signs property`,
    value: { $a$: 2 },
    source: `{$a$:2}`,
  },
  {
    name: `object with closing script tag property`,
    value: { [`</script>`]: 2 },
    source: `{"<\\u002fscript>":2}`,
  },
  { name: `object with zero property`, value: { 0: 2 }, source: `{0:2}` },
  {
    name: `object with multiple zeros property`,
    value: { '00': 2 },
    source: `{"00":2}`,
  },
  { name: `object with integer property`, value: { 1: 2 }, source: `{1:2}` },
  {
    name: `object with integer property with matching value`,
    value: { 1: 1 },
    source: `{1:1}`,
  },
  {
    name: `object with string positive integer property`,
    value: { '1': 2 },
    source: `{1:2}`,
  },
  {
    name: `object with string negative integer property`,
    value: { '-1': 2 },
    source: `{"-1":2}`,
  },
  {
    name: `object with string positive decimal property`,
    value: { '1.2': 2 },
    source: `{"1.2":2}`,
  },
  {
    name: `object with string negative decimal property`,
    value: { '-1.2': 2 },
    source: `{"-1.2":2}`,
  },
  {
    name: `object with large safe integer property`,
    value: { 1_000_000_000_000_000: 2 },
    source: `{1000000000000000:2}`,
  },
  {
    name: `object with non-safe integer property`,
    value: { '10000000000000000000000000000000000000000': 2 },
    source: `{"10000000000000000000000000000000000000000":2}`,
  },
  {
    name: `object with symbol property`,
    value: { [Symbol.toStringTag]: `hi` },
    source: `{[Symbol.toStringTag]:"hi"}`,
  },
  {
    name: `null prototype empty object`,
    value: Object.create(null),
    source: `Object.setPrototypeOf({},null)`,
  },
  {
    name: `null prototype non-empty object`,
    value: Object.setPrototypeOf({ a: 2 }, null),
    source: `Object.setPrototypeOf({a:2},null)`,
  },
  {
    name: `object with null __proto__ property`,
    value: { __proto__: null },
    source: `Object.setPrototypeOf({},null)`,
  },
  {
    name: `object with null own __proto__ property`,
    value: Object.defineProperty({}, `__proto__`, {
      value: null,
      configurable: true,
      enumerable: true,
      writable: true,
    }),
    source: `{["__proto__"]:null}`,
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
    source: `{}`,
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
    source: `Object.setPrototypeOf({},{__defineGetter__:"function",__defineSetter__:"function",hasOwnProperty:"function",__lookupGetter__:"function",__lookupSetter__:"function",isPrototypeOf:"function",propertyIsEnumerable:"function",toString:"function",valueOf:"function",["__proto__"]:null,toLocaleString:"function"})`,
  },
  {
    name: `non-enumerable non-configurable non-writable property`,
    value: Object.defineProperty({}, `a`, { value: 1 }),
    source: `Object.defineProperties({},{a:{value:1}})`,
  },
  {
    name: `enumerable non-configurable non-writable property`,
    value: Object.defineProperty({}, `a`, { value: 1, enumerable: true }),
    source: `Object.defineProperties({},{a:{value:1,enumerable:!0}})`,
  },
  {
    name: `non-enumerable configurable non-writable property`,
    value: Object.defineProperty({}, `a`, { value: 1, configurable: true }),
    source: `Object.defineProperties({},{a:{value:1,configurable:!0}})`,
  },
  {
    name: `non-enumerable non-configurable writable property`,
    value: Object.defineProperty({}, `a`, { value: 1, writable: true }),
    source: `Object.defineProperties({},{a:{value:1,writable:!0}})`,
  },
  {
    name: `enumerable configurable non-writable property`,
    value: Object.defineProperty({}, `a`, {
      value: 1,
      enumerable: true,
      configurable: true,
    }),
    source: `Object.defineProperties({},{a:{value:1,configurable:!0,enumerable:!0}})`,
  },
  {
    name: `enumerable non-configurable writable property`,
    value: Object.defineProperty({}, `a`, {
      value: 1,
      enumerable: true,
      writable: true,
    }),
    source: `Object.defineProperties({},{a:{value:1,enumerable:!0,writable:!0}})`,
  },
  {
    name: `enumerable configurable non-writable property`,
    value: Object.defineProperty({}, `a`, {
      value: 1,
      enumerable: true,
      configurable: true,
    }),
    source: `Object.defineProperties({},{a:{value:1,configurable:!0,enumerable:!0}})`,
  },
  {
    name: `enumerable configurable writable property`,
    value: Object.defineProperty({}, `a`, {
      value: 1,
      enumerable: true,
      configurable: true,
      writable: true,
    }),
    source: `{a:1}`,
  },
  {
    name: `regular then non-regular property`,
    value: Object.defineProperty({ a: 1 }, `b`, { value: 2 }),
    source: `Object.defineProperties({a:1},{b:{value:2}})`,
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
    source: `Object.defineProperties({},{a:{value:1},b:{value:2,configurable:!0,enumerable:!0,writable:!0}})`,
  },
  {
    name: `non-enumerable symbol property`,
    value: Object.defineProperty({}, Symbol.toStringTag, { value: `hi` }),
    source: `Object.defineProperties({},{[Symbol.toStringTag]:{value:"hi"}})`,
  },
  {
    name: `non-enumerable __proto__ property`,
    value: Object.defineProperty({}, `__proto__`, { value: null }),
    source: `Object.defineProperties({},{["__proto__"]:{value:null}})`,
  },
  {
    name: `accessor property with undefined getter`,
    value: Object.defineProperty({}, `a`, { get: undefined }),
    source: `Object.defineProperties({},{a:{get:void 0}})`,
  },
  {
    name: `accessor property with undefined setter`,
    value: Object.defineProperty({}, `a`, { set: undefined }),
    source: `Object.defineProperties({},{a:{get:void 0}})`,
  },
  {
    name: `accessor property with undefined getter and setter`,
    value: Object.defineProperty({}, `a`, { get: undefined, set: undefined }),
    source: `Object.defineProperties({},{a:{get:void 0}})`,
  },
  {
    name: `only non-regular properties`,
    value: Object.defineProperties(
      {},
      { a: { value: 1, writable: true }, b: { value: 2, enumerable: true } },
    ),
    source: `Object.defineProperties({},{a:{value:1,writable:!0},b:{value:2,enumerable:!0}})`,
  },
  {
    name: `non-regular property with null prototype`,
    value: Object.setPrototypeOf(
      Object.defineProperty({}, `a`, { value: 1 }),
      null,
    ),
    source: `Object.setPrototypeOf(Object.defineProperties({},{a:{value:1}}),null)`,
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
    source: `{ ["a"]: 1, ["b"]: 2, ["c"]: 3 }`,
  },
  {
    name: `custom string does not affect object keys`,
    value: { a: 1, b: 2, c: 3, 'x y z': 4 },
    options: { custom: customString },
    source: `{a:1,b:2,c:3,"x y z":4}`,
  },
  {
    name: `custom symbol affects object keys`,
    value: { a: 1, [Symbol.for(`hi`)]: 2 },
    options: { custom: customSymbol },
    source: `{a:1,[Symbol("hi")]:2}`,
    roundtrips: false,
  },
  {
    name: `custom value affects object values`,
    value: { a: 1, b: 2, c: 3 },
    options: { custom: customNumber },
    source: `{a:1.0,b:2.0,c:3.0}`,
  },
  {
    name: `omit object property value`,
    value: { a: 1, b: 2, c: 3 },
    options: { custom: value => (value === 2 ? null : undefined) },
    source: `{a:1,c:3}`,
    roundtrips: false,
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
    source: `[1,,3]`,
    roundtrips: false,
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
    source: `{a:1,b:3}`,
    roundtrips: false,
  },

  // Set
  { name: `empty Set`, value: new Set(), source: `new Set` },
  {
    name: `empty Set from empty array`,
    value: new Set([]),
    source: `new Set`,
  },
  {
    name: `non-empty Set`,
    value: new Set([1, 2, 3]),
    source: `new Set([1,2,3])`,
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
    source: `((set=new Set())=>set.add(1).add(2).add(3))()`,
  },
  {
    name: `custom member affects Set`,
    value: new Set([1, 2, 3]),
    options: { custom: customNumber },
    source: `new Set([1.0,2.0,3.0])`,
  },
  {
    name: `omit Set member`,
    value: new Set([1, 2, 3]),
    options: { custom: value => (value === 2 ? null : undefined) },
    source: `new Set([1,3])`,
    roundtrips: false,
  },

  // Map
  { name: `empty Map`, value: new Map(), source: `new Map` },
  {
    name: `empty Map from empty array`,
    value: new Map([]),
    source: `new Map`,
  },
  {
    name: `non-empty Map`,
    value: new Map([
      [1, 2],
      [3, 4],
    ]),
    source: `new Map([[1,2],[3,4]])`,
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
    source: `((map=new Map())=>map.set(1,2).set(3,4))()`,
  },
  {
    name: `custom key affects Map keys`,
    value: new Map([
      [1, `a`],
      [2, `b`],
    ]),
    options: { custom: customNumber },
    source: `new Map([[1.0,"a"],[2.0,"b"]])`,
  },
  {
    name: `custom value affects Map value`,
    value: new Map([
      [`a`, 1],
      [`b`, 2],
    ]),
    options: { custom: customNumber },
    source: `new Map([["a",1.0],["b",2.0]])`,
  },
  {
    name: `omit Map value drops entry`,
    value: new Map<unknown, unknown>([
      [`a`, 1],
      [`b`, 2],
      [`c`, 3],
    ]),
    options: { custom: value => (value === 2 ? null : undefined) },
    source: `new Map([["a",1],["c",3]])`,
    roundtrips: false,
  },
  {
    name: `omit Map key drops entry`,
    value: new Map<unknown, unknown>([
      [1, `a`],
      [2, `b`],
      [3, `c`],
    ]),
    options: { custom: value => (value === 2 ? null : undefined) },
    source: `new Map([[1,"a"],[3,"c"]])`,
    roundtrips: false,
  },

  // RegExp
  { name: `RegExp literal without flags`, value: /abc/, source: `/abc/` },
  {
    name: `RegExp constructor without flags`,
    value: new RegExp(`abc`),
    source: `/abc/`,
  },
  { name: `RegExp literal with flags`, value: /abc/iu, source: `/abc/iu` },
  {
    name: `RegExp constructor with flags`,
    value: new RegExp(`abc`, `iu`),
    source: `/abc/iu`,
  },
  { name: `RegExp with empty string`, value: new RegExp(``), source: `/(?:)/` },
  { name: `RegExp literal with spaces`, value: /a b c/, source: `/a b c/` },
  {
    name: `RegExp constructor with spaces`,
    value: new RegExp(`a b c`),
    source: `/a b c/`,
  },
  { name: `RegExp literal with forward slash`, value: /\//, source: `/\\//` },
  {
    name: `RegExp constructor with forward slash`,
    value: new RegExp(`/`),
    source: `/\\//`,
  },
  { name: `RegExp literal with backlash slash`, value: /\\/, source: `/\\\\/` },
  {
    name: `RegExp constructor with backlash slash`,
    value: new RegExp(`\\\\`),
    source: `/\\\\/`,
  },
  { name: `RegExp literal with null terminator`, value: /\0/, source: `/\\0/` },
  {
    name: `RegExp constructor with null terminator`,
    value: new RegExp(`\0`),
    source: `new RegExp("\\0")`,
  },
  { name: `RegExp literal with newline`, value: /\n/, source: `/\\n/` },
  {
    name: `RegExp constructor with newline`,
    value: new RegExp(`\n`),
    source: `/\\n/`,
  },
  { name: `RegExp literal with carriage return`, value: /\r/, source: `/\\r/` },
  {
    name: `RegExp constructor with carriage return`,
    value: new RegExp(`\r`),
    source: `/\\r/`,
  },
  { name: `RegExp literal with tab`, value: /\t/, source: `/\\t/` },
  {
    name: `RegExp constructor with tab`,
    value: new RegExp(`\t`),
    source: `new RegExp("\\t")`,
  },
  { name: `RegExp literal with backspace`, value: /\b/, source: `/\\b/` },
  {
    name: `RegExp constructor with backspace`,
    value: new RegExp(`\b`),
    source: `new RegExp("\\b")`,
  },
  { name: `RegExp literal with form feed`, value: /\f/, source: `/\\f/` },
  {
    name: `RegExp constructor with form feed`,
    value: new RegExp(`\f`),
    source: `new RegExp("\\f")`,
  },
  {
    name: `RegExp literal with vertical tabulator`,
    value: /\v/,
    source: `/\\v/`,
  },
  {
    name: `RegExp constructor with vertical tabulator`,
    value: new RegExp(`\v`),
    source: `new RegExp("\\v")`,
  },
  {
    name: `RegExp literal with line separator`,
    value: /\u2028/,
    source: `/\\u2028/`,
  },
  {
    name: `RegExp constructor with line separator`,
    value: new RegExp(`\u2028`),
    source: `/\\u2028/`,
  },
  {
    name: `RegExp literal with multiple line separators`,
    // eslint-disable-next-line unicorn/better-regex
    value: /\u2028\u2028/,
    source: `/\\u2028\\u2028/`,
  },
  {
    name: `RegExp constructor with multiple line separators`,
    value: new RegExp(`\u2028\u2028`),
    source: `/\\u2028\\u2028/`,
  },
  {
    name: `RegExp literal with paragraph separator`,
    value: /\u2029/,
    source: `/\\u2029/`,
  },
  {
    name: `RegExp constructor with paragraph separator`,
    value: new RegExp(`\u2029`),
    source: `/\\u2029/`,
  },
  {
    name: `RegExp literal with multiple paragraph separators`,
    // eslint-disable-next-line unicorn/better-regex
    value: /\u2029\u2029/,
    source: `/\\u2029\\u2029/`,
  },
  {
    name: `RegExp constructor with multiple paragraph separators`,
    value: new RegExp(`\u2029\u2029`),
    source: `/\\u2029\\u2029/`,
  },
  {
    name: `RegExp literal with closing script tag`,
    value: /<\/script>/,
    source: `/<\\/script>/`,
  },
  {
    name: `RegExp constructor with closing script tag`,
    value: new RegExp(`</script>`),
    source: `/<\\/script>/`,
  },
  {
    name: `RegExp literal with closing script tag with whitespace`,
    // eslint-disable-next-line no-regex-spaces
    value: /<\/script   >/,
    source: `/<\\/script   >/`,
  },
  {
    name: `RegExp constructor with closing script tag with whitespace`,
    value: new RegExp(`</script   >`),
    source: `/<\\/script   >/`,
  },
  {
    name: `RegExp literal with unpaired low surrogate`,
    value: /\uDC00/,
    source: `/\\uDC00/`,
  },
  {
    name: `RegExp constructor with unpaired low surrogate`,
    value: new RegExp(`\uDC00`),
    source: `new RegExp("\\udc00")`,
  },
  {
    name: `RegExp literal with unpaired high surrogate`,
    value: /\uD800/,
    source: `/\\uD800/`,
  },
  {
    name: `RegExp constructor with unpaired high surrogate`,
    value: new RegExp(`\uD800`),
    source: `new RegExp("\\ud800")`,
  },
  {
    name: `RegExp literal with unpaired low surrogate in middle`,
    value: /a\uDC00b/,
    source: `/a\\uDC00b/`,
  },
  {
    name: `RegExp constructor with unpaired low surrogate in middle`,
    value: new RegExp(`a\uDC00b`),
    source: `new RegExp("a\\udc00b")`,
  },
  {
    name: `RegExp literal with unpaired high surrogate in middle`,
    value: /a\uD800b/,
    source: `/a\\uD800b/`,
  },
  {
    name: `RegExp constructor with unpaired high surrogate in middle`,
    value: new RegExp(`a\uD800b`),
    source: `new RegExp("a\\ud800b")`,
  },
  {
    name: `RegExp literal with multiple unpaired surrogates`,
    value: /\uD800\uDBFF/,
    source: `/\\uD800\\uDBFF/`,
  },
  {
    name: `RegExp constructor with multiple unpaired surrogates`,
    value: new RegExp(`\uD800\uDBFF`),
    source: `new RegExp("\\ud800\\udbff")`,
  },
  {
    name: `RegExp literal with surrogate pair`,
    value: /\uD83D\uDE00/,
    source: `/\\uD83D\\uDE00/`,
  },
  {
    name: `RegExp constructor with surrogate pair`,
    value: new RegExp(`\uD83D\uDE00`),
    source: `/😀/`,
  },
  {
    name: `RegExp literal with emoji`,
    value: /😀/,
    source: `/😀/`,
  },
  {
    name: `RegExp constructor with emoji`,
    value: new RegExp(`😀`),
    source: `/😀/`,
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
    source: `new RegExp("abc")`,
  },
  {
    name: `custom string does not affect RegExp literal`,
    value: /abc/,
    options: { custom: customString },
    source: `/abc/`,
  },
  {
    name: `custom string does not affect RegExp constructor`,
    value: new RegExp(`\v`),
    options: { custom: customString },
    source: `new RegExp("\\v")`,
  },
  {
    name: `omit RegExp from container`,
    value: [/test/, 1],
    options: {
      custom: value => (value instanceof RegExp ? null : undefined),
    },
    source: `[,1]`,
    roundtrips: false,
  },

  // Date
  { name: `valid Date`, value: new Date(42), source: `new Date(42)` },
  { name: `invalid Date`, value: new Date(`oh no!`), source: `new Date(NaN)` },
  {
    name: `custom Date`,
    value: new Date(42),
    options: {
      custom: (value, uneval) =>
        value instanceof Date
          ? `new Date(${uneval(value.toISOString())})`
          : undefined,
    },
    source: `new Date("1970-01-01T00:00:00.042Z")`,
  },
  {
    name: `custom number does not affect Date`,
    value: new Date(42),
    options: { custom: customNumber },
    source: `new Date(42)`,
  },
  {
    name: `omit Date from container`,
    value: [new Date(0), 1],
    options: {
      custom: value => (value instanceof Date ? null : undefined),
    },
    source: `[,1]`,
    roundtrips: false,
  },

  // Temporal
  {
    name: `Temporal.Instant`,
    value: Temporal.Instant.from(`2024-12-25T00:00:00Z`),
    source: `Temporal.Instant.from("2024-12-25T00:00:00Z")`,
  },
  {
    name: `Temporal.Instant epoch`,
    value: Temporal.Instant.from(`1970-01-01T00:00:00Z`),
    source: `Temporal.Instant.from("1970-01-01T00:00:00Z")`,
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
    source: `Temporal.Instant.fromEpochNanoseconds(0n)`,
  },
  {
    name: `custom string does not affect Temporal.Instant`,
    value: Temporal.Instant.from(`2024-12-25T00:00:00Z`),
    options: { custom: customString },
    source: `Temporal.Instant.from("2024-12-25T00:00:00Z")`,
  },
  {
    name: `Temporal.PlainDate`,
    value: Temporal.PlainDate.from(`2024-12-25`),
    source: `Temporal.PlainDate.from("2024-12-25")`,
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
    source: `Temporal.PlainDate.from({year:2024,month:12,day:25})`,
  },
  {
    name: `custom string does not affect Temporal.PlainDate`,
    value: Temporal.PlainDate.from(`2024-12-25`),
    options: { custom: customString },
    source: `Temporal.PlainDate.from("2024-12-25")`,
  },
  {
    name: `Temporal.PlainTime`,
    value: Temporal.PlainTime.from(`13:45:30`),
    source: `Temporal.PlainTime.from("13:45:30")`,
  },
  {
    name: `Temporal.PlainTime with nanoseconds`,
    value: Temporal.PlainTime.from(`13:45:30.123456789`),
    source: `Temporal.PlainTime.from("13:45:30.123456789")`,
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
    source: `Temporal.PlainTime.from({hour:13,minute:45,second:30})`,
  },
  {
    name: `custom string does not affect Temporal.PlainTime`,
    value: Temporal.PlainTime.from(`13:45:30`),
    options: { custom: customString },
    source: `Temporal.PlainTime.from("13:45:30")`,
  },
  {
    name: `Temporal.PlainDateTime`,
    value: Temporal.PlainDateTime.from(`2024-12-25T13:45:30`),
    source: `Temporal.PlainDateTime.from("2024-12-25T13:45:30")`,
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
    source: `Temporal.PlainDateTime.from({year:2024,month:12,day:25,hour:13,minute:45,second:30})`,
  },
  {
    name: `custom string does not affect Temporal.PlainDateTime`,
    value: Temporal.PlainDateTime.from(`2024-12-25T13:45:30`),
    options: { custom: customString },
    source: `Temporal.PlainDateTime.from("2024-12-25T13:45:30")`,
  },
  {
    name: `Temporal.PlainYearMonth`,
    value: Temporal.PlainYearMonth.from(`2024-12`),
    source: `Temporal.PlainYearMonth.from("2024-12")`,
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
    source: `Temporal.PlainYearMonth.from({year:2024,month:12})`,
  },
  {
    name: `custom string does not affect Temporal.PlainYearMonth`,
    value: Temporal.PlainYearMonth.from(`2024-12`),
    options: { custom: customString },
    source: `Temporal.PlainYearMonth.from("2024-12")`,
  },
  {
    name: `Temporal.PlainMonthDay`,
    value: Temporal.PlainMonthDay.from(`12-25`),
    source: `Temporal.PlainMonthDay.from("12-25")`,
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
    source: `Temporal.PlainMonthDay.from({monthCode:"M12",day:25})`,
  },
  {
    name: `custom string does not affect Temporal.PlainMonthDay`,
    value: Temporal.PlainMonthDay.from(`12-25`),
    options: { custom: customString },
    source: `Temporal.PlainMonthDay.from("12-25")`,
  },
  {
    name: `Temporal.ZonedDateTime`,
    value: Temporal.ZonedDateTime.from(
      `2024-12-25T13:45:30-05:00[America/New_York]`,
    ),
    source: `new Temporal.ZonedDateTime(1735152330000000000n,"America/New_York")`,
  },
  {
    name: `Temporal.ZonedDateTime at minimum epoch boundary`,
    value: new Temporal.ZonedDateTime(
      -8_640_000_000_000_000_000_000n,
      `Europe/London`,
    ),
    source: `new Temporal.ZonedDateTime(-8640000000000000000000n,"Europe/London")`,
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
    source: `Temporal.ZonedDateTime.from({year:2024,month:12,day:25,hour:13,minute:45,second:30,offset:"-05:00",timeZone:"America/New_York"})`,
  },
  {
    name: `custom string does not affect Temporal.ZonedDateTime`,
    value: Temporal.ZonedDateTime.from(
      `2024-12-25T13:45:30-05:00[America/New_York]`,
    ),
    options: { custom: customString },
    source: `new Temporal.ZonedDateTime(1735152330000000000n,"America/New_York")`,
  },
  {
    name: `Temporal.Duration`,
    value: Temporal.Duration.from(`P1Y2M3DT4H5M6S`),
    source: `Temporal.Duration.from("P1Y2M3DT4H5M6S")`,
  },
  {
    name: `Temporal.Duration zero`,
    value: new Temporal.Duration(),
    source: `Temporal.Duration.from("PT0S")`,
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
    source: `Temporal.Duration.from({years:1,months:2,days:3,hours:4,minutes:5,seconds:6})`,
  },
  {
    name: `custom string does not affect Temporal.Duration`,
    value: Temporal.Duration.from(`P1Y2M3DT4H5M6S`),
    options: { custom: customString },
    source: `Temporal.Duration.from("P1Y2M3DT4H5M6S")`,
  },
  {
    name: `omit Temporal.Instant from container`,
    value: [Temporal.Instant.from(`2024-12-25T00:00:00Z`), 1],
    options: {
      custom: value => (value instanceof Temporal.Instant ? null : undefined),
    },
    source: `[,1]`,
    roundtrips: false,
  },

  // URL
  {
    name: `URL`,
    value: new URL(`https://tomeraberba.ch`),
    source: `new URL("https://tomeraberba.ch/")`,
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
    source: `new URL("/","https://tomeraberba.ch")`,
  },
  {
    name: `custom string does not affect URL`,
    value: new URL(`https://tomeraberba.ch`),
    options: { custom: customString },
    source: `new URL("https://tomeraberba.ch/")`,
  },
  {
    name: `omit URL from container`,
    value: [new URL(`https://example.com`), 1],
    options: {
      custom: value => (value instanceof URL ? null : undefined),
    },
    source: `[,1]`,
    roundtrips: false,
  },

  // URLSearchParams
  {
    name: `empty URLSearchParams`,
    value: new URLSearchParams(),
    source: `new URLSearchParams`,
  },
  {
    name: `URLSearchParams with one entry`,
    value: new URLSearchParams([[`a`, `b`]]),
    source: `new URLSearchParams("a=b")`,
  },
  {
    name: `URLSearchParams with two entries`,
    value: new URLSearchParams([
      [`a`, `b`],
      [`c`, `d`],
    ]),
    source: `new URLSearchParams("a=b&c=d")`,
  },
  {
    name: `URLSearchParams with repeated key`,
    value: new URLSearchParams([
      [`a`, `b`],
      [`a`, `c`],
    ]),
    source: `new URLSearchParams("a=b&a=c")`,
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
    source: `new URLSearchParams([["a","b"]])`,
  },
  {
    name: `custom string does not affect URLSearchParams`,
    value: new URLSearchParams([[`a`, `b`]]),
    options: { custom: customString },
    source: `new URLSearchParams("a=b")`,
  },
  {
    name: `omit URLSearchParams from container`,
    value: [new URLSearchParams(`a=1`), 1],
    options: {
      custom: value => (value instanceof URLSearchParams ? null : undefined),
    },
    source: `[,1]`,
    roundtrips: false,
  },

  // ArrayBuffer
  {
    name: `empty non-resizable ArrayBuffer`,
    value: new ArrayBuffer(),
    source: `new ArrayBuffer`,
  },
  {
    name: `detached empty non-resizable ArrayBuffer`,
    value: (() => {
      const buffer = new ArrayBuffer()
      buffer.transfer()
      return buffer
    })(),
    source: `(a=>(a.transfer(),a))(new ArrayBuffer)`,
  },
  {
    name: `empty resizable full capacity ArrayBuffer`,
    value: new ArrayBuffer(0, { maxByteLength: 0 }),
    source: `new ArrayBuffer(0,{maxByteLength:0})`,
  },
  {
    name: `detached empty resizable full capacity ArrayBuffer`,
    value: (() => {
      const buffer = new ArrayBuffer(0, { maxByteLength: 0 })
      buffer.transfer()
      return buffer
    })(),
    source: `(a=>(a.transfer(),a))(new ArrayBuffer(0,{maxByteLength:0}))`,
  },
  {
    name: `empty resizable ArrayBuffer`,
    value: new ArrayBuffer(0, { maxByteLength: 3 }),
    source: `new ArrayBuffer(0,{maxByteLength:3})`,
  },
  {
    name: `detached empty resizable ArrayBuffer`,
    value: (() => {
      const buffer = new ArrayBuffer(0, { maxByteLength: 3 })
      buffer.transfer()
      return buffer
    })(),
    source: `(a=>(a.transfer(),a))(new ArrayBuffer(0,{maxByteLength:0}))`,
  },
  {
    name: `non-empty non-resizable uninitialized ArrayBuffer`,
    value: new ArrayBuffer(8),
    source: `new ArrayBuffer(8)`,
  },
  {
    name: `detached non-empty non-resizable uninitialized ArrayBuffer`,
    value: (() => {
      const buffer = new ArrayBuffer(8)
      buffer.transfer()
      return buffer
    })(),
    source: `(a=>(a.transfer(),a))(new ArrayBuffer)`,
  },
  {
    name: `non-empty non-resizable ArrayBuffer initialized with trailing zeros`,
    value: new Uint8Array([1, 2, 3, 0, 0, 0, 0, 0]).buffer,
    source: `Uint8Array.of(1,2,3,0,0,0,0,0).buffer`,
  },
  {
    name: `detached non-empty non-resizable ArrayBuffer initialized with trailing zeros`,
    value: (() => {
      const { buffer } = new Uint8Array([1, 2, 3, 0, 0, 0, 0, 0])
      buffer.transfer()
      return buffer
    })(),
    source: `(a=>(a.transfer(),a))(new ArrayBuffer)`,
  },
  {
    name: `non-empty non-resizable ArrayBuffer initialized with leading and trailing zeros`,
    value: new Uint8Array([0, 2, 3, 0, 0, 0, 0, 0]).buffer,
    source: `Uint8Array.of(0,2,3,0,0,0,0,0).buffer`,
  },
  {
    name: `detached non-empty non-resizable ArrayBuffer initialized with leading and trailing zeros`,
    value: (() => {
      const { buffer } = new Uint8Array([0, 2, 3, 0, 0, 0, 0, 0])
      buffer.transfer()
      return buffer
    })(),
    source: `(a=>(a.transfer(),a))(new ArrayBuffer)`,
  },
  {
    name: `non-empty non-resizable ArrayBuffer initialized with leading zeros`,
    value: new Uint8Array([0, 0, 0, 0, 0, 1, 2, 3]).buffer,
    source: `Uint8Array.of(0,0,0,0,0,1,2,3).buffer`,
  },
  {
    name: `detached non-empty non-resizable ArrayBuffer initialized with leading zeros`,
    value: (() => {
      const { buffer } = new Uint8Array([0, 0, 0, 0, 0, 1, 2, 3])
      buffer.transfer()
      return buffer
    })(),
    source: `(a=>(a.transfer(),a))(new ArrayBuffer)`,
  },
  {
    name: `non-empty resizable full capacity uninitialized ArrayBuffer`,
    value: new ArrayBuffer(8, { maxByteLength: 8 }),
    source: `new ArrayBuffer(8,{maxByteLength:8})`,
  },
  {
    name: `detached non-empty resizable full capacity uninitialized ArrayBuffer`,
    value: (() => {
      const buffer = new ArrayBuffer(8, { maxByteLength: 8 })
      buffer.transfer()
      return buffer
    })(),
    source: `(a=>(a.transfer(),a))(new ArrayBuffer(0,{maxByteLength:0}))`,
  },
  {
    name: `non-empty resizable full capacity ArrayBuffer initialized with trailing zeros`,
    value: (() => {
      const buffer = new ArrayBuffer(8, { maxByteLength: 8 })
      new Uint8Array(buffer).set([1, 2, 3])
      return buffer
    })(),
    source: `(a=>(new Uint8Array(a).set([1,2,3]),a))(new ArrayBuffer(8,{maxByteLength:8}))`,
  },
  {
    name: `detached non-empty resizable full capacity ArrayBuffer initialized with trailing zeros`,
    value: (() => {
      const buffer = new ArrayBuffer(8, { maxByteLength: 8 })
      new Uint8Array(buffer).set([1, 2, 3])
      buffer.transfer()
      return buffer
    })(),
    source: `(a=>(a.transfer(),a))(new ArrayBuffer(0,{maxByteLength:0}))`,
  },
  {
    name: `non-empty resizable full capacity ArrayBuffer initialized with leading and trailing zeros`,
    value: (() => {
      const buffer = new ArrayBuffer(8, { maxByteLength: 8 })
      new Uint8Array(buffer).set([0, 0, 1, 2, 3])
      return buffer
    })(),
    source: `(a=>(new Uint8Array(a).set([1,2,3],2),a))(new ArrayBuffer(8,{maxByteLength:8}))`,
  },
  {
    name: `detached non-empty resizable full capacity ArrayBuffer initialized with leading and trailing zeros`,
    value: (() => {
      const buffer = new ArrayBuffer(8, { maxByteLength: 8 })
      new Uint8Array(buffer).set([0, 0, 1, 2, 3])
      buffer.transfer()
      return buffer
    })(),
    source: `(a=>(a.transfer(),a))(new ArrayBuffer(0,{maxByteLength:0}))`,
  },
  {
    name: `non-empty resizable full capacity ArrayBuffer initialized with leading zeros`,
    value: (() => {
      const buffer = new ArrayBuffer(8, { maxByteLength: 8 })
      new Uint8Array(buffer).set([0, 0, 0, 0, 0, 1, 2, 3])
      return buffer
    })(),
    source: `(a=>(new Uint8Array(a).set([1,2,3],5),a))(new ArrayBuffer(8,{maxByteLength:8}))`,
  },
  {
    name: `detached non-empty resizable full capacity ArrayBuffer initialized with leading zeros`,
    value: (() => {
      const buffer = new ArrayBuffer(8, { maxByteLength: 8 })
      new Uint8Array(buffer).set([0, 0, 0, 0, 0, 1, 2, 3])
      buffer.transfer()
      return buffer
    })(),
    source: `(a=>(a.transfer(),a))(new ArrayBuffer(0,{maxByteLength:0}))`,
  },
  {
    name: `non-empty resizable uninitialized ArrayBuffer`,
    value: new ArrayBuffer(8, { maxByteLength: 10 }),
    source: `new ArrayBuffer(8,{maxByteLength:10})`,
  },
  {
    name: `detached non-empty resizable uninitialized ArrayBuffer`,
    value: (() => {
      const buffer = new ArrayBuffer(8, { maxByteLength: 10 })
      buffer.transfer()
      return buffer
    })(),
    source: `(a=>(a.transfer(),a))(new ArrayBuffer(0,{maxByteLength:0}))`,
  },
  {
    name: `non-empty resizable ArrayBuffer initialized with trailing zeros`,
    value: (() => {
      const buffer = new ArrayBuffer(8, { maxByteLength: 10 })
      new Uint8Array(buffer).set([1, 2, 3])
      return buffer
    })(),
    source: `(a=>(new Uint8Array(a).set([1,2,3]),a))(new ArrayBuffer(8,{maxByteLength:10}))`,
  },
  {
    name: `detached non-empty resizable ArrayBuffer initialized with trailing zeros`,
    value: (() => {
      const buffer = new ArrayBuffer(8, { maxByteLength: 10 })
      new Uint8Array(buffer).set([1, 2, 3])
      buffer.transfer()
      return buffer
    })(),
    source: `(a=>(a.transfer(),a))(new ArrayBuffer(0,{maxByteLength:0}))`,
  },
  {
    name: `non-empty resizable ArrayBuffer initialized with leading and trailing zeros`,
    value: (() => {
      const buffer = new ArrayBuffer(8, { maxByteLength: 10 })
      new Uint8Array(buffer).set([0, 0, 1, 2, 3])
      return buffer
    })(),
    source: `(a=>(new Uint8Array(a).set([1,2,3],2),a))(new ArrayBuffer(8,{maxByteLength:10}))`,
  },
  {
    name: `detached non-empty resizable ArrayBuffer initialized with leading and trailing zeros`,
    value: (() => {
      const buffer = new ArrayBuffer(8, { maxByteLength: 10 })
      new Uint8Array(buffer).set([0, 0, 1, 2, 3])
      buffer.transfer()
      return buffer
    })(),
    source: `(a=>(a.transfer(),a))(new ArrayBuffer(0,{maxByteLength:0}))`,
  },
  {
    name: `non-empty resizable ArrayBuffer initialized with leading zeros`,
    value: (() => {
      const buffer = new ArrayBuffer(8, { maxByteLength: 10 })
      new Uint8Array(buffer).set([0, 0, 0, 0, 0, 1, 2, 3])
      return buffer
    })(),
    source: `(a=>(new Uint8Array(a).set([1,2,3],5),a))(new ArrayBuffer(8,{maxByteLength:10}))`,
  },
  {
    name: `detached non-empty resizable ArrayBuffer initialized with leading zeros`,
    value: (() => {
      const buffer = new ArrayBuffer(8, { maxByteLength: 10 })
      new Uint8Array(buffer).set([0, 0, 0, 0, 0, 1, 2, 3])
      buffer.transfer()
      return buffer
    })(),
    source: `(a=>(a.transfer(),a))(new ArrayBuffer(0,{maxByteLength:0}))`,
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
    source: `new Uint8Array([1,2,3]).buffer`,
  },
  {
    name: `custom number does not affect ArrayBuffer`,
    value: new Uint8Array([0, 0, 0, 0, 0, 1, 2, 3]).buffer,
    options: { custom: customNumber },
    source: `Uint8Array.of(0,0,0,0,0,1,2,3).buffer`,
  },
  {
    name: `omit ArrayBuffer from container`,
    value: [new ArrayBuffer(4), 1],
    options: {
      custom: value => (value instanceof ArrayBuffer ? null : undefined),
    },
    source: `[,1]`,
    roundtrips: false,
  },

  // Buffer
  {
    name: `empty non-resizable Buffer`,
    value: Buffer.from([]),
    source: `Buffer.alloc(0)`,
  },
  {
    name: `empty resizable full capacity Buffer`,
    value: Buffer.from(new ArrayBuffer(0, { maxByteLength: 0 })),
    source: `Buffer.from(new ArrayBuffer(0,{maxByteLength:0}))`,
  },
  {
    name: `empty resizable Buffer`,
    value: Buffer.from(new ArrayBuffer(0, { maxByteLength: 3 })),
    source: `Buffer.from(new ArrayBuffer(0,{maxByteLength:3}))`,
  },
  {
    name: `non-empty non-resizable uninitialized Buffer`,
    value: Buffer.from(new ArrayBuffer(8)),
    source: `Buffer.from(new ArrayBuffer(8))`,
  },
  {
    name: `non-empty non-resizable Buffer initialized with trailing zeros`,
    value: Buffer.from(new Uint8Array([1, 2, 3, 0, 0, 0, 0, 0]).buffer),
    source: `Buffer.from(Uint8Array.of(1,2,3,0,0,0,0,0).buffer)`,
  },
  {
    name: `non-empty non-resizable Buffer initialized with leading and trailing zeros`,
    value: Buffer.from(new Uint8Array([0, 2, 3, 0, 0, 0, 0, 0]).buffer),
    source: `Buffer.from(Uint8Array.of(0,2,3,0,0,0,0,0).buffer)`,
  },
  {
    name: `non-empty non-resizable Buffer initialized with leading zeros`,
    value: Buffer.from(new Uint8Array([0, 0, 0, 0, 0, 1, 2, 3]).buffer),
    source: `Buffer.from(Uint8Array.of(0,0,0,0,0,1,2,3).buffer)`,
  },
  {
    name: `non-empty resizable full capacity uninitialized Buffer`,
    value: Buffer.from(new ArrayBuffer(8, { maxByteLength: 8 })),
    source: `Buffer.from(new ArrayBuffer(8,{maxByteLength:8}))`,
  },
  {
    name: `non-empty resizable full capacity Buffer initialized with trailing zeros`,
    value: (() => {
      const arrayBuffer = new ArrayBuffer(8, { maxByteLength: 8 })
      new Uint8Array(arrayBuffer).set([1, 2, 3])
      return Buffer.from(arrayBuffer)
    })(),
    source: `(a=>(new Uint8Array(a).set([1,2,3]),Buffer.from(a)))(new ArrayBuffer(8,{maxByteLength:8}))`,
  },
  {
    name: `non-empty resizable full capacity Buffer initialized with leading and trailing zeros`,
    value: (() => {
      const arrayBuffer = new ArrayBuffer(8, { maxByteLength: 8 })
      new Uint8Array(arrayBuffer).set([0, 0, 1, 2, 3])
      return Buffer.from(arrayBuffer)
    })(),
    source: `(a=>(new Uint8Array(a).set([1,2,3],2),Buffer.from(a)))(new ArrayBuffer(8,{maxByteLength:8}))`,
  },
  {
    name: `non-empty resizable full capacity Buffer initialized with leading zeros`,
    value: (() => {
      const arrayBuffer = new ArrayBuffer(8, { maxByteLength: 8 })
      new Uint8Array(arrayBuffer).set([0, 0, 0, 0, 0, 1, 2, 3])
      return Buffer.from(arrayBuffer)
    })(),
    source: `(a=>(new Uint8Array(a).set([1,2,3],5),Buffer.from(a)))(new ArrayBuffer(8,{maxByteLength:8}))`,
  },
  {
    name: `non-empty resizable uninitialized Buffer`,
    value: Buffer.from(new ArrayBuffer(8, { maxByteLength: 10 })),
    source: `Buffer.from(new ArrayBuffer(8,{maxByteLength:10}))`,
  },
  {
    name: `non-empty resizable Buffer initialized with trailing zeros`,
    value: (() => {
      const arrayBuffer = new ArrayBuffer(8, { maxByteLength: 10 })
      new Uint8Array(arrayBuffer).set([1, 2, 3])
      return Buffer.from(arrayBuffer)
    })(),
    source: `(a=>(new Uint8Array(a).set([1,2,3]),Buffer.from(a)))(new ArrayBuffer(8,{maxByteLength:10}))`,
  },
  {
    name: `non-empty resizable Buffer initialized with leading and trailing zeros`,
    value: (() => {
      const arrayBuffer = new ArrayBuffer(8, { maxByteLength: 10 })
      new Uint8Array(arrayBuffer).set([0, 0, 1, 2, 3])
      return Buffer.from(arrayBuffer)
    })(),
    source: `(a=>(new Uint8Array(a).set([1,2,3],2),Buffer.from(a)))(new ArrayBuffer(8,{maxByteLength:10}))`,
  },
  {
    name: `non-empty resizable Buffer initialized with leading zeros`,
    value: (() => {
      const arrayBuffer = new ArrayBuffer(8, { maxByteLength: 10 })
      new Uint8Array(arrayBuffer).set([0, 0, 0, 0, 0, 1, 2, 3])
      return Buffer.from(arrayBuffer)
    })(),
    source: `(a=>(new Uint8Array(a).set([1,2,3],5),Buffer.from(a)))(new ArrayBuffer(8,{maxByteLength:10}))`,
  },
  {
    name: `leading Buffer view`,
    value: Buffer.from(new ArrayBuffer(4), 0, 3),
    source: `Buffer.from(new ArrayBuffer(4),0,3)`,
  },
  {
    name: `middle Buffer view`,
    value: Buffer.from(new ArrayBuffer(4), 1, 2),
    source: `Buffer.from(new ArrayBuffer(4),1,2)`,
  },
  {
    name: `trailing Buffer view`,
    value: Buffer.from(new ArrayBuffer(4), 1, 3),
    source: `Buffer.from(new ArrayBuffer(4),1)`,
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
    source: `Buffer.from([1,2,3])`,
    roundtrips: false,
  },
  {
    name: `custom number does not affect Buffer`,
    value: Buffer.from(new Uint8Array([0, 0, 0, 0, 0, 1, 2, 3]).buffer),
    options: { custom: customNumber },
    source: `Buffer.from(Uint8Array.of(0,0,0,0,0,1,2,3).buffer)`,
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
    source: `Buffer.from(new Uint8Array([1,2,3]).buffer)`,
  },
  {
    name: `omit Buffer from container`,
    value: [Buffer.alloc(4), 1],
    options: {
      custom: value => (Buffer.isBuffer(value) ? null : undefined),
    },
    source: `[,1]`,
    roundtrips: false,
  },

  // Int8Array
  {
    name: `empty Int8Array`,
    value: new Int8Array(),
    source: `new Int8Array`,
  },
  {
    name: `non-empty uninitialized Int8Array`,
    value: new Int8Array(1024),
    source: `new Int8Array(1024)`,
  },
  {
    name: `non-empty initialized Int8Array`,
    value: new Int8Array([1, -2, 3, 4]),
    source: `Int8Array.of(1,-2,3,4)`,
  },
  {
    name: `leading Int8Array view`,
    value: new Int8Array(new ArrayBuffer(4), 0, 3),
    source: `new Int8Array(new ArrayBuffer(4),0,3)`,
  },
  {
    name: `middle Int8Array view`,
    value: new Int8Array(new ArrayBuffer(4), 1, 2),
    source: `new Int8Array(new ArrayBuffer(4),1,2)`,
  },
  {
    name: `trailing Int8Array view`,
    value: new Int8Array(new ArrayBuffer(4), 1, 3),
    source: `new Int8Array(new ArrayBuffer(4),1)`,
  },
  {
    name: `resizable Int8Array`,
    value: new Int8Array(new ArrayBuffer(0, { maxByteLength: 1 })),
    source: `new Int8Array(new ArrayBuffer(0,{maxByteLength:1}))`,
  },
  {
    name: `Int8Array with shared buffer reference`,
    value: (() => {
      const buffer = new ArrayBuffer()
      return [new Int8Array(buffer), new Int8Array(buffer)]
    })(),
    source: `(a=>[new Int8Array(a),new Int8Array(a)])(new ArrayBuffer)`,
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
    source: `new Int8Array([1,-2,3,4])`,
  },
  {
    name: `custom number does not affect Int8Array`,
    value: new Int8Array([0, 0, 0, 0, 0, 1, 2, 3]),
    options: { custom: customNumber },
    source: `Int8Array.of(0,0,0,0,0,1,2,3)`,
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
    source: `new Int8Array(new Uint8Array([1,2,3]).buffer)`,
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
    source: `[,1]`,
    roundtrips: false,
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
    source: `[,1]`,
    roundtrips: false,
  },

  // Uint8Array
  {
    name: `empty Uint8Array`,
    value: new Uint8Array(),
    source: `new Uint8Array`,
  },
  {
    name: `non-empty uninitialized Uint8Array`,
    value: new Uint8Array(1024),
    source: `new Uint8Array(1024)`,
  },
  {
    name: `non-empty initialized Uint8Array`,
    value: new Uint8Array([1, 2, 3, 4]),
    source: `Uint8Array.of(1,2,3,4)`,
  },
  {
    name: `leading Uint8Array view`,
    value: new Uint8Array(new ArrayBuffer(4), 0, 3),
    source: `new Uint8Array(new ArrayBuffer(4),0,3)`,
  },
  {
    name: `middle Uint8Array view`,
    value: new Uint8Array(new ArrayBuffer(4), 1, 2),
    source: `new Uint8Array(new ArrayBuffer(4),1,2)`,
  },
  {
    name: `trailing Uint8Array view`,
    value: new Uint8Array(new ArrayBuffer(4), 1, 3),
    source: `new Uint8Array(new ArrayBuffer(4),1)`,
  },
  {
    name: `resizable Uint8Array`,
    value: new Uint8Array(new ArrayBuffer(0, { maxByteLength: 1 })),
    source: `new Uint8Array(new ArrayBuffer(0,{maxByteLength:1}))`,
  },
  {
    name: `Uint8Array with shared buffer reference`,
    value: (() => {
      const buffer = new ArrayBuffer()
      return [new Uint8Array(buffer), new Uint8Array(buffer)]
    })(),
    source: `(a=>[new Uint8Array(a),new Uint8Array(a)])(new ArrayBuffer)`,
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
    source: `new Uint8Array([1,2,3,4])`,
  },
  {
    name: `custom number does not affect Uint8Array`,
    value: new Uint8Array([0, 0, 0, 0, 0, 1, 2, 3]),
    options: { custom: customNumber },
    source: `Uint8Array.of(0,0,0,0,0,1,2,3)`,
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
    source: `new Uint8Array(new Uint8Array([1,2,3]).buffer)`,
  },

  // Uint8ClampedArray
  {
    name: `empty Uint8ClampedArray`,
    value: new Uint8ClampedArray(),
    source: `new Uint8ClampedArray`,
  },
  {
    name: `non-empty uninitialized Uint8ClampedArray`,
    value: new Uint8ClampedArray(1024),
    source: `new Uint8ClampedArray(1024)`,
  },
  {
    name: `non-empty initialized Uint8ClampedArray`,
    value: new Uint8ClampedArray([1, 2, 3, 4]),
    source: `Uint8ClampedArray.of(1,2,3,4)`,
  },
  {
    name: `leading Uint8ClampedArray view`,
    value: new Uint8ClampedArray(new ArrayBuffer(4), 0, 3),
    source: `new Uint8ClampedArray(new ArrayBuffer(4),0,3)`,
  },
  {
    name: `middle Uint8ClampedArray view`,
    value: new Uint8ClampedArray(new ArrayBuffer(4), 1, 2),
    source: `new Uint8ClampedArray(new ArrayBuffer(4),1,2)`,
  },
  {
    name: `trailing Uint8ClampedArray view`,
    value: new Uint8ClampedArray(new ArrayBuffer(4), 1, 3),
    source: `new Uint8ClampedArray(new ArrayBuffer(4),1)`,
  },
  {
    name: `resizable Uint8ClampedArray`,
    value: new Uint8ClampedArray(new ArrayBuffer(0, { maxByteLength: 1 })),
    source: `new Uint8ClampedArray(new ArrayBuffer(0,{maxByteLength:1}))`,
  },
  {
    name: `Uint8ClampedArray with shared buffer reference`,
    value: (() => {
      const buffer = new ArrayBuffer()
      return [new Uint8ClampedArray(buffer), new Uint8ClampedArray(buffer)]
    })(),
    source: `(a=>[new Uint8ClampedArray(a),new Uint8ClampedArray(a)])(new ArrayBuffer)`,
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
    source: `new Uint8ClampedArray([1,2,3,4])`,
  },
  {
    name: `custom number does not affect Uint8ClampedArray`,
    value: new Uint8ClampedArray([0, 0, 0, 0, 0, 1, 2, 3]),
    options: { custom: customNumber },
    source: `Uint8ClampedArray.of(0,0,0,0,0,1,2,3)`,
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
    source: `new Uint8ClampedArray(new Uint8Array([1,2,3]).buffer)`,
  },

  // Int16Array
  {
    name: `empty Int16Array`,
    value: new Int16Array(),
    source: `new Int16Array`,
  },
  {
    name: `non-empty uninitialized Int16Array`,
    value: new Int16Array(1024),
    source: `new Int16Array(1024)`,
  },
  {
    name: `non-empty initialized Int16Array`,
    value: new Int16Array([1, -2, 3, 4]),
    source: `Int16Array.of(1,-2,3,4)`,
  },
  {
    name: `leading Int16Array view`,
    value: new Int16Array(new ArrayBuffer(8), 0, 2),
    source: `new Int16Array(new ArrayBuffer(8),0,2)`,
  },
  {
    name: `middle Int16Array view`,
    value: new Int16Array(new ArrayBuffer(8), 2, 2),
    source: `new Int16Array(new ArrayBuffer(8),2,2)`,
  },
  {
    name: `trailing Int16Array view`,
    value: new Int16Array(new ArrayBuffer(8), 4, 2),
    source: `new Int16Array(new ArrayBuffer(8),4)`,
  },
  {
    name: `resizable Int16Array`,
    value: new Int16Array(new ArrayBuffer(0, { maxByteLength: 1 })),
    source: `new Int16Array(new ArrayBuffer(0,{maxByteLength:1}))`,
  },
  {
    name: `Int16Array with shared buffer reference`,
    value: (() => {
      const buffer = new ArrayBuffer()
      return [new Int16Array(buffer), new Int16Array(buffer)]
    })(),
    source: `(a=>[new Int16Array(a),new Int16Array(a)])(new ArrayBuffer)`,
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
    source: `new Int16Array([1,-2,3,4])`,
  },
  {
    name: `custom number does not affect Int16Array`,
    value: new Int16Array([0, 0, 0, 0, 0, 1, 2, 3]),
    options: { custom: customNumber },
    source: `Int16Array.of(0,0,0,0,0,1,2,3)`,
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
    source: `new Int16Array(new Uint8Array([1,0,2,0,3,0]).buffer)`,
  },

  // Uint16Array
  {
    name: `empty Uint16Array`,
    value: new Uint16Array(),
    source: `new Uint16Array`,
  },
  {
    name: `non-empty uninitialized Uint16Array`,
    value: new Uint16Array(1024),
    source: `new Uint16Array(1024)`,
  },
  {
    name: `non-empty initialized Uint16Array`,
    value: new Uint16Array([1, 2, 3, 4]),
    source: `Uint16Array.of(1,2,3,4)`,
  },
  {
    name: `leading Uint16Array view`,
    value: new Uint16Array(new ArrayBuffer(8), 0, 2),
    source: `new Uint16Array(new ArrayBuffer(8),0,2)`,
  },
  {
    name: `middle Uint16Array view`,
    value: new Uint16Array(new ArrayBuffer(8), 2, 2),
    source: `new Uint16Array(new ArrayBuffer(8),2,2)`,
  },
  {
    name: `trailing Uint16Array view`,
    value: new Uint16Array(new ArrayBuffer(8), 4, 2),
    source: `new Uint16Array(new ArrayBuffer(8),4)`,
  },
  {
    name: `resizable Uint16Array`,
    value: new Uint16Array(new ArrayBuffer(0, { maxByteLength: 1 })),
    source: `new Uint16Array(new ArrayBuffer(0,{maxByteLength:1}))`,
  },
  {
    name: `Uint16Array with shared buffer reference`,
    value: (() => {
      const buffer = new ArrayBuffer()
      return [new Uint16Array(buffer), new Uint16Array(buffer)]
    })(),
    source: `(a=>[new Uint16Array(a),new Uint16Array(a)])(new ArrayBuffer)`,
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
    source: `new Uint16Array([1,2,3,4])`,
  },
  {
    name: `custom number does not affect Uint16Array`,
    value: new Uint16Array([0, 0, 0, 0, 0, 1, 2, 3]),
    options: { custom: customNumber },
    source: `Uint16Array.of(0,0,0,0,0,1,2,3)`,
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
    source: `new Uint16Array(new Uint8Array([1,0,2,0,3,0]).buffer)`,
  },

  // Int32Array
  {
    name: `empty Int32Array`,
    value: new Int32Array(),
    source: `new Int32Array`,
  },
  {
    name: `non-empty uninitialized Int32Array`,
    value: new Int32Array(1024),
    source: `new Int32Array(1024)`,
  },
  {
    name: `non-empty initialized Int32Array`,
    value: new Int32Array([1, -2, 3, 4]),
    source: `Int32Array.of(1,-2,3,4)`,
  },
  {
    name: `leading Int32Array view`,
    value: new Int32Array(new ArrayBuffer(16), 0, 2),
    source: `new Int32Array(new ArrayBuffer(16),0,2)`,
  },
  {
    name: `middle Int32Array view`,
    value: new Int32Array(new ArrayBuffer(16), 4, 2),
    source: `new Int32Array(new ArrayBuffer(16),4,2)`,
  },
  {
    name: `trailing Int32Array view`,
    value: new Int32Array(new ArrayBuffer(16), 8, 2),
    source: `new Int32Array(new ArrayBuffer(16),8)`,
  },
  {
    name: `resizable Int32Array`,
    value: new Int32Array(new ArrayBuffer(0, { maxByteLength: 1 })),
    source: `new Int32Array(new ArrayBuffer(0,{maxByteLength:1}))`,
  },
  {
    name: `Int32Array with shared buffer reference`,
    value: (() => {
      const buffer = new ArrayBuffer()
      return [new Int32Array(buffer), new Int32Array(buffer)]
    })(),
    source: `(a=>[new Int32Array(a),new Int32Array(a)])(new ArrayBuffer)`,
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
    source: `new Int32Array([1,-2,3,4])`,
  },
  {
    name: `custom number does not affect Int32Array`,
    value: new Int32Array([0, 0, 0, 0, 0, 1, 2, 3]),
    options: { custom: customNumber },
    source: `Int32Array.of(0,0,0,0,0,1,2,3)`,
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
    source: `new Int32Array(new Uint8Array([1,0,0,0,2,0,0,0,3,0,0,0]).buffer)`,
  },

  // Uint32Array
  {
    name: `empty Uint32Array`,
    value: new Uint32Array(),
    source: `new Uint32Array`,
  },
  {
    name: `non-empty uninitialized Uint32Array`,
    value: new Uint32Array(1024),
    source: `new Uint32Array(1024)`,
  },
  {
    name: `non-empty initialized Uint32Array`,
    value: new Uint32Array([1, 2, 3, 4]),
    source: `Uint32Array.of(1,2,3,4)`,
  },
  {
    name: `leading Uint32Array view`,
    value: new Uint32Array(new ArrayBuffer(16), 0, 2),
    source: `new Uint32Array(new ArrayBuffer(16),0,2)`,
  },
  {
    name: `middle Uint32Array view`,
    value: new Uint32Array(new ArrayBuffer(16), 4, 2),
    source: `new Uint32Array(new ArrayBuffer(16),4,2)`,
  },
  {
    name: `trailing Uint32Array view`,
    value: new Uint32Array(new ArrayBuffer(16), 8, 2),
    source: `new Uint32Array(new ArrayBuffer(16),8)`,
  },
  {
    name: `resizable Uint32Array`,
    value: new Uint32Array(new ArrayBuffer(0, { maxByteLength: 1 })),
    source: `new Uint32Array(new ArrayBuffer(0,{maxByteLength:1}))`,
  },
  {
    name: `Uint32Array with shared buffer reference`,
    value: (() => {
      const buffer = new ArrayBuffer()
      return [new Uint32Array(buffer), new Uint32Array(buffer)]
    })(),
    source: `(a=>[new Uint32Array(a),new Uint32Array(a)])(new ArrayBuffer)`,
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
    source: `new Uint32Array([1,2,3,4])`,
  },
  {
    name: `custom number does not affect Uint32Array`,
    value: new Uint32Array([0, 0, 0, 0, 0, 1, 2, 3]),
    options: { custom: customNumber },
    source: `Uint32Array.of(0,0,0,0,0,1,2,3)`,
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
    source: `new Uint32Array(new Uint8Array([1,0,0,0,2,0,0,0,3,0,0,0]).buffer)`,
  },

  // Float16Array
  ...(typeof Float16Array === `undefined`
    ? []
    : ([
        {
          name: `empty Float16Array`,
          value: new Float16Array(),
          source: `new Float16Array`,
        },
        {
          name: `non-empty uninitialized Float16Array`,
          value: new Float16Array(1024),
          source: `new Float16Array(1024)`,
        },
        {
          name: `non-empty initialized Float16Array`,
          value: new Float16Array([1, -2, 3.140_625, 4]),
          source: `Float16Array.of(1,-2,3.140625,4)`,
        },
        {
          name: `middle Float16Array view`,
          value: new Float16Array(new ArrayBuffer(8), 2, 2),
          source: `new Float16Array(new ArrayBuffer(8),2,2)`,
        },
        {
          name: `trailing Float16Array view`,
          value: new Float16Array(new ArrayBuffer(8), 4, 2),
          source: `new Float16Array(new ArrayBuffer(8),4)`,
        },
        {
          name: `resizable Float16Array`,
          value: new Float16Array(new ArrayBuffer(0, { maxByteLength: 1 })),
          source: `new Float16Array(new ArrayBuffer(0,{maxByteLength:1}))`,
        },
        {
          name: `resizable Float16Array`,
          value: new Float16Array(new ArrayBuffer(0, { maxByteLength: 1 })),
          source: `new Float16Array(new ArrayBuffer(0,{maxByteLength:1}))`,
        },
        {
          name: `Float16Array with shared buffer reference`,
          value: (() => {
            const buffer = new ArrayBuffer()
            return [new Float16Array(buffer), new Float16Array(buffer)]
          })(),
          source: `(a=>[new Float16Array(a),new Float16Array(a)])(new ArrayBuffer)`,
        },
        {
          name: `Float16Array from NaN`,
          value: new Float16Array([Number.NaN]),
          source: `Float16Array.of(NaN)`,
        },
        {
          name: `Float16Array from non-canonical NaN`,
          value: new Float16Array(new Uint8Array([0, 125]).buffer),
          source: `new Float16Array(Uint8Array.of(0,125).buffer)`,
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
          source: `new Float16Array([1,2,3])`,
        },
        {
          name: `custom number does not affect Float16Array`,
          value: new Float16Array([0, 0, 0, 0, 0, 1, 2, 3]),
          options: { custom: customNumber },
          source: `Float16Array.of(0,0,0,0,0,1,2,3)`,
        },
        {
          name: `custom ArrayBuffer affects Float16Array`,
          value: new Float16Array(new Uint8Array([0, 60, 0, 64, 0, 68]).buffer),
          options: {
            custom: (value, uneval) =>
              value instanceof ArrayBuffer
                ? `new Uint8Array(${uneval([...new Uint8Array(value)])}).buffer`
                : undefined,
          },
          source: `new Float16Array(new Uint8Array([0,60,0,64,0,68]).buffer)`,
        },
      ] satisfies Case[])),

  // Float32Array
  {
    name: `empty Float32Array`,
    value: new Float32Array(),
    source: `new Float32Array`,
  },
  {
    name: `non-empty uninitialized Float32Array`,
    value: new Float32Array(1024),
    source: `new Float32Array(1024)`,
  },
  {
    name: `non-empty initialized Float32Array`,
    value: new Float32Array([1, -2, 3.140_000_104_904_175, 4]),
    source: `Float32Array.of(1,-2,3.140000104904175,4)`,
  },
  {
    name: `leading Float32Array view`,
    value: new Float32Array(new ArrayBuffer(16), 0, 2),
    source: `new Float32Array(new ArrayBuffer(16),0,2)`,
  },
  {
    name: `middle Float32Array view`,
    value: new Float32Array(new ArrayBuffer(16), 4, 2),
    source: `new Float32Array(new ArrayBuffer(16),4,2)`,
  },
  {
    name: `trailing Float32Array view`,
    value: new Float32Array(new ArrayBuffer(16), 8, 2),
    source: `new Float32Array(new ArrayBuffer(16),8)`,
  },
  {
    name: `resizable Float32Array`,
    value: new Float32Array(new ArrayBuffer(0, { maxByteLength: 1 })),
    source: `new Float32Array(new ArrayBuffer(0,{maxByteLength:1}))`,
  },
  {
    name: `Float32Array with shared buffer reference`,
    value: (() => {
      const buffer = new ArrayBuffer()
      return [new Float32Array(buffer), new Float32Array(buffer)]
    })(),
    source: `(a=>[new Float32Array(a),new Float32Array(a)])(new ArrayBuffer)`,
  },
  {
    name: `Float32Array from NaN`,
    value: new Float32Array([Number.NaN]),
    source: `Float32Array.of(NaN)`,
  },
  {
    name: `Float32Array from non-canonical NaN`,
    value: new Float32Array(new Uint8Array([0, 0, 255, 127]).buffer),
    source: `new Float32Array(Uint8Array.of(0,0,255,127).buffer)`,
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
    source: `new Float32Array([1,-2,3,4])`,
  },
  {
    name: `custom number does not affect Float32Array`,
    value: new Float32Array([0, 0, 0, 0, 0, 1, 2, 3]),
    options: { custom: customNumber },
    source: `Float32Array.of(0,0,0,0,0,1,2,3)`,
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
    source: `new Float32Array(new Uint8Array([0,0,255,127]).buffer)`,
  },

  // Float64Array
  {
    name: `empty Float64Array`,
    value: new Float64Array(),
    source: `new Float64Array`,
  },
  {
    name: `non-empty uninitialized Float64Array`,
    value: new Float64Array(1024),
    source: `new Float64Array(1024)`,
  },
  {
    name: `non-empty initialized Float64Array`,
    value: new Float64Array([1, -2, 3.14, 4]),
    source: `Float64Array.of(1,-2,3.14,4)`,
  },
  {
    name: `leading Float64Array view`,
    value: new Float64Array(new ArrayBuffer(32), 0, 2),
    source: `new Float64Array(new ArrayBuffer(32),0,2)`,
  },
  {
    name: `middle Float64Array view`,
    value: new Float64Array(new ArrayBuffer(32), 8, 2),
    source: `new Float64Array(new ArrayBuffer(32),8,2)`,
  },
  {
    name: `trailing Float64Array view`,
    value: new Float64Array(new ArrayBuffer(32), 16, 2),
    source: `new Float64Array(new ArrayBuffer(32),16)`,
  },
  {
    name: `resizable Float64Array`,
    value: new Float64Array(new ArrayBuffer(0, { maxByteLength: 1 })),
    source: `new Float64Array(new ArrayBuffer(0,{maxByteLength:1}))`,
  },
  {
    name: `Float64Array with shared buffer reference`,
    value: (() => {
      const buffer = new ArrayBuffer()
      return [new Float64Array(buffer), new Float64Array(buffer)]
    })(),
    source: `(a=>[new Float64Array(a),new Float64Array(a)])(new ArrayBuffer)`,
  },
  {
    name: `Float64Array from NaN`,
    value: new Float64Array([Number.NaN]),
    source: `Float64Array.of(NaN)`,
  },
  {
    name: `Float64Array from non-canonical NaN`,
    value: new Float64Array(
      new Uint8Array([0, 0, 0, 0, 0, 0, 255, 127]).buffer,
    ),
    source: `new Float64Array(Uint8Array.of(0,0,0,0,0,0,255,127).buffer)`,
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
    source: `new Float64Array([1,-2,3.14,4])`,
  },
  {
    name: `custom number does not affect Float64Array`,
    value: new Float64Array([0, 0, 0, 0, 0, 1, 2, 3]),
    options: { custom: customNumber },
    source: `Float64Array.of(0,0,0,0,0,1,2,3)`,
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
    source: `new Float64Array(new Uint8Array([0,0,0,0,0,0,255,127]).buffer)`,
  },

  // BigInt64Array
  {
    name: `empty BigInt64Array`,
    value: new BigInt64Array(),
    source: `new BigInt64Array`,
  },
  {
    name: `non-empty uninitialized BigInt64Array`,
    value: new BigInt64Array(1024),
    source: `new BigInt64Array(1024)`,
  },
  {
    name: `non-empty initialized BigInt64Array`,
    value: new BigInt64Array([1n, -2n, 3n, 4n]),
    source: `BigInt64Array.of(1n,-2n,3n,4n)`,
  },
  {
    name: `leading BigInt64Array view`,
    value: new BigInt64Array(new ArrayBuffer(32), 0, 2),
    source: `new BigInt64Array(new ArrayBuffer(32),0,2)`,
  },
  {
    name: `middle BigInt64Array view`,
    value: new BigInt64Array(new ArrayBuffer(32), 8, 2),
    source: `new BigInt64Array(new ArrayBuffer(32),8,2)`,
  },
  {
    name: `trailing BigInt64Array view`,
    value: new BigInt64Array(new ArrayBuffer(32), 16, 2),
    source: `new BigInt64Array(new ArrayBuffer(32),16)`,
  },
  {
    name: `resizable BigInt64Array`,
    value: new BigInt64Array(new ArrayBuffer(0, { maxByteLength: 1 })),
    source: `new BigInt64Array(new ArrayBuffer(0,{maxByteLength:1}))`,
  },
  {
    name: `BigInt64Array with shared buffer reference`,
    value: (() => {
      const buffer = new ArrayBuffer()
      return [new BigInt64Array(buffer), new BigInt64Array(buffer)]
    })(),
    source: `(a=>[new BigInt64Array(a),new BigInt64Array(a)])(new ArrayBuffer)`,
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
    source: `new BigInt64Array([1n,-2n,3n,4n])`,
  },
  {
    name: `custom bigint does not affect BigInt64Array`,
    value: new BigInt64Array([0n, 0n, 0n, 0n, 0n, 1n, 2n, 3n]),
    options: { custom: customBigInt },
    source: `BigInt64Array.of(0n,0n,0n,0n,0n,1n,2n,3n)`,
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
    source: `new BigInt64Array(new Uint8Array([1,0,0,0,0,0,0,0,2,0,0,0,0,0,0,0]).buffer,0,1)`,
  },

  // BigUint64Array
  {
    name: `empty BigUint64Array`,
    value: new BigUint64Array(),
    source: `new BigUint64Array`,
  },
  {
    name: `non-empty uninitialized BigUint64Array`,
    value: new BigUint64Array(1024),
    source: `new BigUint64Array(1024)`,
  },
  {
    name: `non-empty initialized BigUint64Array`,
    value: new BigUint64Array([1n, 2n, 3n, 4n]),
    source: `BigUint64Array.of(1n,2n,3n,4n)`,
  },
  {
    name: `leading BigUint64Array view`,
    value: new BigUint64Array(new ArrayBuffer(32), 0, 2),
    source: `new BigUint64Array(new ArrayBuffer(32),0,2)`,
  },
  {
    name: `middle BigUint64Array view`,
    value: new BigUint64Array(new ArrayBuffer(32), 8, 2),
    source: `new BigUint64Array(new ArrayBuffer(32),8,2)`,
  },
  {
    name: `trailing BigUint64Array view`,
    value: new BigUint64Array(new ArrayBuffer(32), 16, 2),
    source: `new BigUint64Array(new ArrayBuffer(32),16)`,
  },
  {
    name: `resizable BigUint64Array`,
    value: new BigUint64Array(new ArrayBuffer(0, { maxByteLength: 1 })),
    source: `new BigUint64Array(new ArrayBuffer(0,{maxByteLength:1}))`,
  },
  {
    name: `BigUint64Array with shared buffer reference`,
    value: (() => {
      const buffer = new ArrayBuffer()
      return [new BigUint64Array(buffer), new BigUint64Array(buffer)]
    })(),
    source: `(a=>[new BigUint64Array(a),new BigUint64Array(a)])(new ArrayBuffer)`,
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
    source: `new BigUint64Array([1n,2n,3n,4n])`,
  },
  {
    name: `custom bigint does not affect BigUint64Array`,
    value: new BigUint64Array([0n, 0n, 0n, 0n, 0n, 1n, 2n, 3n]),
    options: { custom: customBigInt },
    source: `BigUint64Array.of(0n,0n,0n,0n,0n,1n,2n,3n)`,
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
    source: `new BigUint64Array(new Uint8Array([1,0,0,0,0,0,0,0,2,0,0,0,0,0,0,0]).buffer,0,1)`,
  },

  // Shared reference
  {
    name: `shared object reference`,
    value: (() => {
      const object = {}
      return { a: object, b: object }
    })(),
    source: `(a=>({a,b:a}))({})`,
  },
  {
    name: `many shared object references`,
    value: (() => {
      const objects = Array.from({ length: 100 }, () => ({}))
      return [...objects, ...objects]
    })(),
    source: `((a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z,A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z,$aa,$ab,$ac,$ad,$ae,$af,$ag,$ah,$ai,$aj,$ak,$al,$am,$an,$ao,$ap,$aq,$ar,$as,$at,$au,$av,$aw,$ax,$ay,$az,$aA,$aB,$aC,$aD,$aE,$aF,$aG,$aH,$aI,$aJ,$aK,$aL,$aM,$aN,$aO,$aP,$aQ,$aR,$aS,$aT,$aU,$aV)=>[a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z,A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z,$aa,$ab,$ac,$ad,$ae,$af,$ag,$ah,$ai,$aj,$ak,$al,$am,$an,$ao,$ap,$aq,$ar,$as,$at,$au,$av,$aw,$ax,$ay,$az,$aA,$aB,$aC,$aD,$aE,$aF,$aG,$aH,$aI,$aJ,$aK,$aL,$aM,$aN,$aO,$aP,$aQ,$aR,$aS,$aT,$aU,$aV,a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z,A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z,$aa,$ab,$ac,$ad,$ae,$af,$ag,$ah,$ai,$aj,$ak,$al,$am,$an,$ao,$ap,$aq,$ar,$as,$at,$au,$av,$aw,$ax,$ay,$az,$aA,$aB,$aC,$aD,$aE,$aF,$aG,$aH,$aI,$aJ,$aK,$aL,$aM,$aN,$aO,$aP,$aQ,$aR,$aS,$aT,$aU,$aV])({},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{})`,
  },

  // Circular reference
  {
    name: `directly circular object`,
    value: (() => {
      const circular: { ref?: unknown } = {}
      circular.ref = circular
      return circular
    })(),
    source: `(a=>a.ref=a)({})`,
  },
  {
    name: `object containing directly circular object`,
    value: (() => {
      const circular: { ref?: unknown } = {}
      circular.ref = circular
      return { circular }
    })(),
    source: `(a=>(a.ref=a,{circular:a}))({})`,
  },
  {
    name: `object containing directly circular object on property with same name as binding`,
    value: (() => {
      const circular: { ref?: unknown } = {}
      circular.ref = circular
      return { a: circular }
    })(),
    source: `(a=>(a.ref=a,{a}))({})`,
  },
  {
    name: `mutually circular object`,
    value: (() => {
      const circular1: { ref?: unknown } = {}
      const circular2 = { ref: circular1 }
      circular1.ref = circular2
      return circular1
    })(),
    source: `((b,a={ref:b})=>b.ref=a)({})`,
  },
  {
    name: `object containing mutually circular object`,
    value: (() => {
      const circular1: { ref?: unknown } = {}
      const circular2 = { ref: circular1 }
      circular1.ref = circular2
      return { circular: circular1 }
    })(),
    source: `((b,a={ref:b})=>(b.ref=a,{circular:a}))({})`,
  },
  {
    name: `object containing both mutually circular objects`,
    value: (() => {
      const circular1: { ref?: unknown } = {}
      const circular2 = { ref: circular1 }
      circular1.ref = circular2
      return { a: circular1, b: circular2 }
    })(),
    source: `((b,a={ref:b})=>(b.ref=a,{a,b}))({})`,
  },
  {
    name: `circular object through string property with spaces`,
    value: (() => {
      const circular: { 'a b c'?: unknown } = {}
      circular[`a b c`] = circular
      return circular
    })(),
    source: `(a=>a["a b c"]=a)({})`,
  },
  {
    name: `circular object through symbol property`,
    value: (() => {
      const circular: Record<PropertyKey, unknown> = {}
      circular[Symbol.hasInstance] = circular
      return circular
    })(),
    source: `(a=>a[Symbol.hasInstance]=a)({})`,
  },
  {
    name: `circular array`,
    value: (() => {
      const circular: unknown[] = []
      circular.push(circular)
      return circular
    })(),
    source: `(a=>a[0]=a)([])`,
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
    source: `((b,a=[b])=>(b[0]=a,b[1]=b,a))([,])`,
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
    source: `(a=>Object.defineProperty(a,"__proto__",{value:a,writable:!0,enumerable:!0,configurable:!0}))({})`,
  },
  {
    name: `circular property preserves order with non-circular properties after`,
    value: (() => {
      const obj: Record<string, unknown> = { a: 1 }
      obj.self = obj
      obj.b = 2
      return obj
    })(),
    source: `(a=>a.self=a)({a:1,self:null,b:2})`,
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
    source: `(a=>(a.ref1=a,a.ref2=a))({ref1:null,middle:42,ref2:null,end:99})`,
  },
  {
    name: `trailing circular property does not get placeholder`,
    value: (() => {
      const obj: Record<string, unknown> = { a: 1 }
      obj.self = obj
      return obj
    })(),
    source: `(a=>a.self=a)({a:1})`,
  },
  {
    name: `non-regular circular descriptor preserves order before non-circular descriptor`,
    value: (() => {
      const obj = {}
      Object.defineProperty(obj, `circ`, { value: obj })
      Object.defineProperty(obj, `other`, { value: 42 })
      return obj
    })(),
    source: `(a=>Object.defineProperty(a,"circ",{value:a,configurable:!1}))(Object.defineProperties({},{circ:{configurable:!0},other:{value:42}}))`,
  },
  {
    name: `trailing non-regular circular descriptor does not get placeholder`,
    value: (() => {
      const obj = {}
      Object.defineProperty(obj, `other`, { value: 42 })
      Object.defineProperty(obj, `circ`, { value: obj })
      return obj
    })(),
    source: `(a=>Object.defineProperty(a,"circ",{value:a}))(Object.defineProperties({},{other:{value:42}}))`,
  },
  {
    name: `regular circular property preserves order before non-regular non-circular`,
    value: (() => {
      const obj: Record<string, unknown> = {}
      obj.circ = obj
      Object.defineProperty(obj, `other`, { value: 42 })
      return obj
    })(),
    source: `(a=>a.circ=a)(Object.defineProperties({circ:null},{other:{value:42}}))`,
  },
  {
    name: `non-regular non-circular then trailing regular circular`,
    value: (() => {
      const obj: Record<string, unknown> = {}
      Object.defineProperty(obj, `other`, { value: 42 })
      obj.circ = obj
      return obj
    })(),
    source: `(a=>Object.defineProperty(a,"circ",{value:a,configurable:!0,enumerable:!0,writable:!0}))(Object.defineProperties({},{other:{value:42}}))`,
  },
  {
    name: `configurable circular descriptor preserves order before non-circular descriptor`,
    value: (() => {
      const obj = {}
      Object.defineProperty(obj, `circ`, { value: obj, configurable: true })
      Object.defineProperty(obj, `other`, { value: 42 })
      return obj
    })(),
    source: `(a=>Object.defineProperty(a,"circ",{value:a,configurable:!0}))(Object.defineProperties({},{circ:{configurable:!0},other:{value:42}}))`,
  },
  {
    name: `writable circular descriptor preserves order before non-circular descriptor`,
    value: (() => {
      const obj = {}
      Object.defineProperty(obj, `circ`, { value: obj, writable: true })
      Object.defineProperty(obj, `other`, { value: 42 })
      return obj
    })(),
    source: `(a=>Object.defineProperty(a,"circ",{value:a,writable:!0,configurable:!1}))(Object.defineProperties({},{circ:{configurable:!0},other:{value:42}}))`,
  },
  {
    name: `prototype containing circular reference`,
    value: (() => {
      const circular1 = {}
      const circular2 = { ref: circular1 }
      return Object.setPrototypeOf(circular1, circular2) as unknown
    })(),
    source: `((b,a=Object.setPrototypeOf({},b))=>b.ref=a)({})`,
  },
  {
    name: `directly circular set`,
    value: (() => {
      const circular = new Set()
      circular.add(circular)
      return circular
    })(),
    source: `(a=>a.add(a))(new Set)`,
  },
  {
    name: `set containing value with circular reference`,
    value: (() => {
      const circular = new Set()
      circular.add({ '': circular })
      return circular
    })(),
    source: `((b,a=new Set([b]))=>b[""]=a)({})`,
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
    source: `(a=>(a.add(a),a.add(2)))(new Set([1]))`,
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
    source: `((a,b)=>(a.add(a),a.add(1),b.ref=a,a.add(b)))(new Set,{})`,
  },
  {
    name: `directly circular map entry value`,
    value: (() => {
      const circular = new Map()
      circular.set(`hi`, circular)
      return circular
    })(),
    source: `(a=>a.set("hi",a))(new Map([["hi"]]))`,
  },
  {
    name: `circular map containing value with circular reference`,
    value: (() => {
      const circular = new Map()
      circular.set(`hi`, circular)
      circular.set(`hello`, { circular })
      return circular
    })(),
    source: `((b,a=new Map([["hi"],["hello",b]]))=>(a.set("hi",a),b.circular=a))({})`,
  },
  {
    name: `directly circular map entry key`,
    value: (() => {
      const circular = new Map()
      circular.set(circular, `howdy`)
      return circular
    })(),
    source: `(a=>a.set(a,"howdy"))(new Map)`,
  },
  {
    name: `map containing key with circular reference`,
    value: (() => {
      const circular = new Map()
      circular.set({ '': circular }, circular)
      return circular
    })(),
    source: `((b,a=new Map([[b]]))=>(b[""]=a,a.set(b,a)))({})`,
  },
  {
    name: `map containing entry value map with circular key to outer map`,
    value: (() => {
      const circular = new Map()
      circular.set({}, { '': new Map([[circular, new Map()]]) })
      return circular
    })(),
    source: `((b,a=new Map([[{},{"":b}]]))=>(b.set(a,new Map),a))(new Map)`,
  },
  {
    name: `map containing array key with circular reference to outer map`,
    value: (() => {
      const array: unknown[] = []
      const circular = new Map([[array, {}]])
      array.push(circular)
      return circular
    })(),
    source: `((b,a=new Map([[b,{}]]))=>b[0]=a)([])`,
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
    source: `((d,c={"":d},b=new Map([[c]]),a=[b,[d]])=>(b.set(c,a),a))({})`,
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
    source: `(a=>(a.set(a,"self"),a.set("b",2)))(new Map([["a",1]]))`,
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
    source: `((a,b)=>(a.set(a,"self"),a.set("middle",2),b.map=a,a.set(b,"obj"),a.set("last",3)))(new Map([["first",1]]),{})`,
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
    source: `((a,b)=>(a.set(a,b),a.set("x",b)))(new Map,{})`,
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
    source: `((c,b=[,c],a=new Set([b]))=>(b[0]=a,c[""]=a))({})`,
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
    source: `[,,]`,
    roundtrips: false,
  },

  // Custom
  {
    name: `custom option for functions`,
    value: { x: 42, f: () => `hi` },
    options: {
      custom: value =>
        typeof value === `function` ? String(value) : undefined,
    },
    source: `{x:42,f:() => \`hi\`}`,
    roundtrips: false,
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
      source: `new Person("Tomer")`,
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
    source: `Symbol("HI")`,
    roundtrips: false,
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
      source: `(a=>[a,"OBJECT 2!",a])("OBJECT 1!")`,
      roundtrips: false,
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
      source: `{a:"1",b:"1",c:"1"}`,
      roundtrips: false,
    }
  })(),
])(`uneval $name`, ({ value, source, options, roundtrips = true }) => {
  const actualSource = (roundtrips ? expectUnevalRoundtrips : uneval)(
    value,
    options,
  )

  expect(actualSource).toBe(source)
})

test.each<{
  name: string
  value: unknown
}>([
  // eslint-disable-next-line symbol-description
  { name: `unique symbol`, value: Symbol() },
  { name: `unique symbol with description`, value: Symbol(`howdy`) },
  { name: `function`, value: () => {} },
])(`uneval $name`, ({ value }) => {
  expect(() => uneval(value)).toThrowError()
})

test(`uneval omit root throws Error`, () => {
  expect(() => uneval(42, { custom: () => null })).toThrowError(
    `Cannot omit root`,
  )
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
