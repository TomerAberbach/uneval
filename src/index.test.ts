/* eslint-disable require-unicode-regexp */
/* eslint-disable no-sparse-arrays */
/* eslint-disable unicorn/new-for-builtins */
/* eslint-disable no-new-wrappers */

import { test } from '@fast-check/vitest'
import { expect } from 'vitest'
import { anythingArb } from './arbs.ts'
import srcify from './index.ts'

test.prop([anythingArb], { numRuns: 500 })(`srcify works`, value => {
  expectSrcifyRoundtrips(value)
})

test.each([
  // Undefined and null
  { name: `undefined`, value: undefined, source: `undefined` },
  { name: `null`, value: null, source: `null` },

  // Boolean
  { name: `false`, value: false, source: `false` },
  { name: `boxed false`, value: new Boolean(false), source: `new Boolean()` },
  { name: `true`, value: true, source: `true` },
  { name: `boxed true`, value: new Boolean(true), source: `new Boolean(true)` },

  // Number
  { name: `zero`, value: 0, source: `0` },
  { name: `boxed zero`, value: new Number(0), source: `new Number()` },
  { name: `negative zero`, value: -0, source: `-0` },
  {
    name: `boxed negative zero`,
    value: new Number(-0),
    source: `new Number(-0)`,
  },
  { name: `positive integer`, value: 42, source: `42` },
  {
    name: `boxed positive integer`,
    value: new Number(42),
    source: `new Number(42)`,
  },
  { name: `negative integer`, value: -42, source: `-42` },
  {
    name: `boxed negative integer`,
    value: new Number(-42),
    source: `new Number(-42)`,
  },
  { name: `positive decimal`, value: 3.14, source: `3.14` },
  {
    name: `boxed positive decimal`,
    value: new Number(3.14),
    source: `new Number(3.14)`,
  },
  { name: `negative decimal`, value: -3.14, source: `-3.14` },
  {
    name: `boxed negative decimal`,
    value: new Number(-3.14),
    source: `new Number(-3.14)`,
  },
  {
    name: `max safe integer value`,
    value: Number.MAX_SAFE_INTEGER,
    source: `9007199254740991`,
  },
  {
    name: `boxed max safe integer value`,
    value: new Number(Number.MAX_SAFE_INTEGER),
    source: `new Number(9007199254740991)`,
  },
  {
    name: `max number value`,
    value: Number.MAX_VALUE,
    source: `1.7976931348623157e+308`,
  },
  {
    name: `boxed max number value`,
    value: new Number(Number.MAX_VALUE),
    source: `new Number(1.7976931348623157e+308)`,
  },
  {
    name: `min safe integer value`,
    value: Number.MIN_SAFE_INTEGER,
    source: `-9007199254740991`,
  },
  {
    name: `boxed min safe integer value`,
    value: new Number(Number.MIN_SAFE_INTEGER),
    source: `new Number(-9007199254740991)`,
  },
  {
    name: `min number value`,
    value: Number.MIN_VALUE,
    source: `5e-324`,
  },
  {
    name: `boxed min number value`,
    value: new Number(Number.MIN_VALUE),
    source: `new Number(5e-324)`,
  },
  { name: `NaN`, value: Number.NaN, source: `NaN` },
  {
    name: `boxed NaN`,
    value: new Number(Number.NaN),
    source: `new Number(NaN)`,
  },
  { name: `infinity`, value: Infinity, source: `Infinity` },
  {
    name: `boxed infinity`,
    value: new Number(Infinity),
    source: `new Number(Infinity)`,
  },
  { name: `negative infinity`, value: -Infinity, source: `-Infinity` },
  {
    name: `boxed negative infinity`,
    value: new Number(-Infinity),
    source: `new Number(-Infinity)`,
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

  // String
  { name: `empty string`, value: ``, source: `""` },
  { name: `boxed empty string`, value: new String(``), source: `new String()` },
  { name: `single character string`, value: `a`, source: `"a"` },
  {
    name: `boxed single character string`,
    value: new String(`a`),
    source: `new String("a")`,
  },
  { name: `string with spaces`, value: `a b c`, source: `"a b c"` },
  {
    name: `boxed string with spaces`,
    value: new String(`a b c`),
    source: `new String("a b c")`,
  },
  { name: `string with single quotes`, value: `'''`, source: `"'''"` },
  {
    name: `boxed string with single quotes`,
    value: new String(`'''`),
    source: `new String("'''")`,
  },
  { name: `string with double quote`, value: `"`, source: `"\\""` },
  {
    name: `boxed string with double quote`,
    value: new String(`"`),
    source: `new String("\\"")`,
  },
  {
    name: `string with closing script tag`,
    value: `</script>`,
    source: `"<\\u002fscript>"`,
  },
  {
    name: `boxed string with closing script tag`,
    value: new String(`</script>`),
    source: `new String("<\\u002fscript>")`,
  },
  {
    name: `string with capitalized closing script tag`,
    value: `</SCRIPT>`,
    source: `"<\\u002fSCRIPT>"`,
  },
  {
    name: `boxed string with capitalized closing script tag`,
    value: new String(`</SCRIPT>`),
    source: `new String("<\\u002fSCRIPT>")`,
  },
  {
    name: `string with mixed capitalization closing script tag`,
    value: `</sCrIpT>`,
    source: `"<\\u002fsCrIpT>"`,
  },
  {
    name: `boxed string with mixed capitalization capitalized closing script tag`,
    value: new String(`</sCrIpT>`),
    source: `new String("<\\u002fsCrIpT>")`,
  },
  { name: `null terminator string`, value: `\0`, source: `"\\u0000"` },
  {
    name: `boxed null terminator string`,
    value: new String(`\0`),
    source: `new String("\\u0000")`,
  },
  { name: `backspace string`, value: `\b`, source: `"\\b"` },
  {
    name: `boxed backspace string`,
    value: new String(`\b`),
    source: `new String("\\b")`,
  },
  { name: `tab string`, value: `\t`, source: `"\\t"` },
  {
    name: `boxed tab string`,
    value: new String(`\t`),
    source: `new String("\\t")`,
  },
  { name: `newline string`, value: `\n`, source: `"\\n"` },
  {
    name: `boxed newline string`,
    value: new String(`\n`),
    source: `new String("\\n")`,
  },
  { name: `carriage return string`, value: `\r`, source: `"\\r"` },
  {
    name: `boxed carriage return string`,
    value: new String(`\r`),
    source: `new String("\\r")`,
  },
  { name: `backslash string`, value: `\\`, source: `"\\\\"` },
  {
    name: `boxed backslash string`,
    value: new String(`\\`),
    source: `new String("\\\\")`,
  },
  { name: `line separator string`, value: `\u2028`, source: `"\\u2028"` },
  {
    name: `boxed line separator string`,
    value: new String(`\u2028`),
    source: `new String("\\u2028")`,
  },
  {
    name: `multiple line separator string`,
    value: `\u2028\u2028`,
    source: `"\\u2028\\u2028"`,
  },
  {
    name: `boxed multiple line separator string`,
    value: new String(`\u2028\u2028`),
    source: `new String("\\u2028\\u2028")`,
  },
  { name: `paragraph separator string`, value: `\u2029`, source: `"\\u2029"` },
  {
    name: `boxed paragraph separator string`,
    value: new String(`\u2029`),
    source: `new String("\\u2029")`,
  },
  {
    name: `multiple paragraph separator string`,
    value: `\u2029\u2029`,
    source: `"\\u2029\\u2029"`,
  },
  {
    name: `boxed multiple paragraph separator string`,
    value: new String(`\u2029\u2029`),
    source: `new String("\\u2029\\u2029")`,
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
    source: `Object.defineProperty({},"__proto__",{value:null,writable:true,enumerable:true,configurable:true})`,
  },

  // Set
  { name: `empty Set`, value: new Set(), source: `new Set()` },
  {
    name: `empty Set from empty array`,
    value: new Set([]),
    source: `new Set()`,
  },
  {
    name: `non-empty Set`,
    value: new Set([1, 2, 3]),
    source: `new Set([1,2,3])`,
  },

  // Map
  { name: `empty Map`, value: new Map(), source: `new Map()` },
  {
    name: `empty Map from empty array`,
    value: new Map([]),
    source: `new Map()`,
  },
  {
    name: `non-empty Map`,
    value: new Map([
      [1, 2],
      [3, 4],
    ]),
    source: `new Map([[1,2],[3,4]])`,
  },

  // RegExp
  { name: `RegExp without flags`, value: /abc/, source: `new RegExp("abc")` },
  {
    name: `RegExp with flags`,
    value: /abc/iu,
    source: `new RegExp("abc","iu")`,
  },

  // Date
  { name: `valid Date`, value: new Date(42), source: `new Date(42)` },
  { name: `invalid Date`, value: new Date(`oh no!`), source: `new Date(NaN)` },

  // URL
  {
    name: `URL`,
    value: new URL(`https://tomeraberba.ch`),
    source: `new URL("https://tomeraberba.ch/")`,
  },

  // URLSearchParams
  {
    name: `empty URLSearchParams`,
    value: new URLSearchParams(),
    source: `new URLSearchParams()`,
  },
  {
    name: `non-empty URLSearchParams`,
    value: new URLSearchParams([[`a`, `b`]]),
    source: `new URLSearchParams([["a","b"]])`,
  },

  // Int8Array
  {
    name: `empty Int8Array`,
    value: new Int8Array(),
    source: `new Int8Array()`,
  },
  {
    name: `non-empty uninitialized Int8Array`,
    value: new Int8Array(1024),
    source: `new Int8Array(1024)`,
  },
  {
    name: `non-empty initialized Int8Array`,
    value: new Int8Array([1, -2, 3, 4]),
    source: `new Int8Array([1,-2,3,4])`,
  },

  // Uint8Array
  {
    name: `empty Uint8Array`,
    value: new Uint8Array(),
    source: `new Uint8Array()`,
  },
  {
    name: `non-empty uninitialized Uint8Array`,
    value: new Uint8Array(1024),
    source: `new Uint8Array(1024)`,
  },
  {
    name: `non-empty initialized Uint8Array`,
    value: new Uint8Array([1, 2, 3, 4]),
    source: `new Uint8Array([1,2,3,4])`,
  },

  // Uint8ClampedArray
  {
    name: `empty Uint8ClampedArray`,
    value: new Uint8ClampedArray(),
    source: `new Uint8ClampedArray()`,
  },
  {
    name: `non-empty uninitialized Uint8ClampedArray`,
    value: new Uint8ClampedArray(1024),
    source: `new Uint8ClampedArray(1024)`,
  },
  {
    name: `non-empty initialized Uint8ClampedArray`,
    value: new Uint8ClampedArray([1, 2, 3, 4]),
    source: `new Uint8ClampedArray([1,2,3,4])`,
  },

  // Int16Array
  {
    name: `empty Int16Array`,
    value: new Int16Array(),
    source: `new Int16Array()`,
  },
  {
    name: `non-empty uninitialized Int16Array`,
    value: new Int16Array(1024),
    source: `new Int16Array(1024)`,
  },
  {
    name: `non-empty initialized Int16Array`,
    value: new Int16Array([1, -2, 3, 4]),
    source: `new Int16Array([1,-2,3,4])`,
  },

  // Uint16Array
  {
    name: `empty Uint16Array`,
    value: new Uint16Array(),
    source: `new Uint16Array()`,
  },
  {
    name: `non-empty uninitialized Uint16Array`,
    value: new Uint16Array(1024),
    source: `new Uint16Array(1024)`,
  },
  {
    name: `non-empty initialized Uint16Array`,
    value: new Uint16Array([1, 2, 3, 4]),
    source: `new Uint16Array([1,2,3,4])`,
  },

  // Int32Array
  {
    name: `empty Int32Array`,
    value: new Int32Array(),
    source: `new Int32Array()`,
  },
  {
    name: `non-empty uninitialized Int32Array`,
    value: new Int32Array(1024),
    source: `new Int32Array(1024)`,
  },
  {
    name: `non-empty initialized Int32Array`,
    value: new Int32Array([1, -2, 3, 4]),
    source: `new Int32Array([1,-2,3,4])`,
  },

  // Uint32Array
  {
    name: `empty Uint32Array`,
    value: new Uint32Array(),
    source: `new Uint32Array()`,
  },
  {
    name: `non-empty uninitialized Uint32Array`,
    value: new Uint32Array(1024),
    source: `new Uint32Array(1024)`,
  },
  {
    name: `non-empty initialized Uint32Array`,
    value: new Uint32Array([1, 2, 3, 4]),
    source: `new Uint32Array([1,2,3,4])`,
  },

  // Float32Array
  {
    name: `empty Float32Array`,
    value: new Float32Array(),
    source: `new Float32Array()`,
  },
  {
    name: `non-empty uninitialized Float32Array`,
    value: new Float32Array(1024),
    source: `new Float32Array(1024)`,
  },
  {
    name: `non-empty initialized Float32Array`,
    value: new Float32Array([1, -2, 3.140_000_104_904_175, 4]),
    source: `new Float32Array([1,-2,3.140000104904175,4])`,
  },

  // Float64Array
  {
    name: `empty Float64Array`,
    value: new Float64Array(),
    source: `new Float64Array()`,
  },
  {
    name: `non-empty uninitialized Float64Array`,
    value: new Float64Array(1024),
    source: `new Float64Array(1024)`,
  },
  {
    name: `non-empty initialized Float64Array`,
    value: new Float64Array([1, -2, 3.14, 4]),
    source: `new Float64Array([1,-2,3.14,4])`,
  },

  // BigInt64Array
  {
    name: `empty BigInt64Array`,
    value: new BigInt64Array(),
    source: `new BigInt64Array()`,
  },
  {
    name: `non-empty uninitialized BigInt64Array`,
    value: new BigInt64Array(1024),
    source: `new BigInt64Array(1024)`,
  },
  {
    name: `non-empty initialized BigInt64Array`,
    value: new BigInt64Array([1n, -2n, 3n, 4n]),
    source: `new BigInt64Array([1n,-2n,3n,4n])`,
  },

  // BigUint64Array
  {
    name: `empty BigUint64Array`,
    value: new BigUint64Array(),
    source: `new BigUint64Array()`,
  },
  {
    name: `non-empty uninitialized BigUint64Array`,
    value: new BigUint64Array(1024),
    source: `new BigUint64Array(1024)`,
  },
  {
    name: `non-empty initialized BigUint64Array`,
    value: new BigUint64Array([1n, 2n, 3n, 4n]),
    source: `new BigUint64Array([1n,2n,3n,4n])`,
  },

  // ArrayBuffer
  {
    name: `empty non-resizable ArrayBuffer`,
    value: new ArrayBuffer(),
    source: `new ArrayBuffer()`,
  },
  {
    name: `detached empty non-resizable ArrayBuffer`,
    value: (() => {
      const buffer = new ArrayBuffer()
      buffer.transfer()
      return buffer
    })(),
    source: `((a=new ArrayBuffer())=>(a.transfer(),a))()`,
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
    source: `((a=new ArrayBuffer(0,{maxByteLength:0}))=>(a.transfer(),a))()`,
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
    source: `((a=new ArrayBuffer(0,{maxByteLength:0}))=>(a.transfer(),a))()`,
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
    source: `((a=new ArrayBuffer())=>(a.transfer(),a))()`,
  },
  {
    name: `non-empty non-resizable ArrayBuffer initialized with trailing zeros`,
    value: new Uint8Array([1, 2, 3, 0, 0, 0, 0, 0]).buffer,
    source: `new Uint8Array([1,2,3,0,0,0,0,0]).buffer`,
  },
  {
    name: `detached non-empty non-resizable ArrayBuffer initialized with trailing zeros`,
    value: (() => {
      const { buffer } = new Uint8Array([1, 2, 3, 0, 0, 0, 0, 0])
      buffer.transfer()
      return buffer
    })(),
    source: `((a=new ArrayBuffer())=>(a.transfer(),a))()`,
  },
  {
    name: `non-empty non-resizable ArrayBuffer initialized with leading and trailing zeros`,
    value: new Uint8Array([0, 2, 3, 0, 0, 0, 0, 0]).buffer,
    source: `new Uint8Array([0,2,3,0,0,0,0,0]).buffer`,
  },
  {
    name: `detached non-empty non-resizable ArrayBuffer initialized with leading and trailing zeros`,
    value: (() => {
      const { buffer } = new Uint8Array([0, 2, 3, 0, 0, 0, 0, 0])
      buffer.transfer()
      return buffer
    })(),
    source: `((a=new ArrayBuffer())=>(a.transfer(),a))()`,
  },
  {
    name: `non-empty non-resizable ArrayBuffer initialized with leading zeros`,
    value: new Uint8Array([0, 0, 0, 0, 0, 1, 2, 3]).buffer,
    source: `new Uint8Array([0,0,0,0,0,1,2,3]).buffer`,
  },
  {
    name: `detached non-empty non-resizable ArrayBuffer initialized with leading zeros`,
    value: (() => {
      const { buffer } = new Uint8Array([0, 0, 0, 0, 0, 1, 2, 3])
      buffer.transfer()
      return buffer
    })(),
    source: `((a=new ArrayBuffer())=>(a.transfer(),a))()`,
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
    source: `((a=new ArrayBuffer(0,{maxByteLength:0}))=>(a.transfer(),a))()`,
  },
  {
    name: `non-empty resizable full capacity ArrayBuffer initialized with trailing zeros`,
    value: (() => {
      const buffer = new ArrayBuffer(8, { maxByteLength: 8 })
      new Uint8Array(buffer).set([1, 2, 3])
      return buffer
    })(),
    source: `((a=new ArrayBuffer(8,{maxByteLength:8}))=>(new Uint8Array(a).set([1,2,3]),a))()`,
  },
  {
    name: `detached non-empty resizable full capacity ArrayBuffer initialized with trailing zeros`,
    value: (() => {
      const buffer = new ArrayBuffer(8, { maxByteLength: 8 })
      new Uint8Array(buffer).set([1, 2, 3])
      buffer.transfer()
      return buffer
    })(),
    source: `((a=new ArrayBuffer(0,{maxByteLength:0}))=>(a.transfer(),a))()`,
  },
  {
    name: `non-empty resizable full capacity ArrayBuffer initialized with leading and trailing zeros`,
    value: (() => {
      const buffer = new ArrayBuffer(8, { maxByteLength: 8 })
      new Uint8Array(buffer).set([0, 0, 1, 2, 3])
      return buffer
    })(),
    source: `((a=new ArrayBuffer(8,{maxByteLength:8}))=>(new Uint8Array(a).set([1,2,3],2),a))()`,
  },
  {
    name: `detached non-empty resizable full capacity ArrayBuffer initialized with leading and trailing zeros`,
    value: (() => {
      const buffer = new ArrayBuffer(8, { maxByteLength: 8 })
      new Uint8Array(buffer).set([0, 0, 1, 2, 3])
      buffer.transfer()
      return buffer
    })(),
    source: `((a=new ArrayBuffer(0,{maxByteLength:0}))=>(a.transfer(),a))()`,
  },
  {
    name: `non-empty resizable full capacity ArrayBuffer initialized with leading zeros`,
    value: (() => {
      const buffer = new ArrayBuffer(8, { maxByteLength: 8 })
      new Uint8Array(buffer).set([0, 0, 0, 0, 0, 1, 2, 3])
      return buffer
    })(),
    source: `((a=new ArrayBuffer(8,{maxByteLength:8}))=>(new Uint8Array(a).set([1,2,3],5),a))()`,
  },
  {
    name: `detached non-empty resizable full capacity ArrayBuffer initialized with leading zeros`,
    value: (() => {
      const buffer = new ArrayBuffer(8, { maxByteLength: 8 })
      new Uint8Array(buffer).set([0, 0, 0, 0, 0, 1, 2, 3])
      buffer.transfer()
      return buffer
    })(),
    source: `((a=new ArrayBuffer(0,{maxByteLength:0}))=>(a.transfer(),a))()`,
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
    source: `((a=new ArrayBuffer(0,{maxByteLength:0}))=>(a.transfer(),a))()`,
  },
  {
    name: `non-empty resizable ArrayBuffer initialized with trailing zeros`,
    value: (() => {
      const buffer = new ArrayBuffer(8, { maxByteLength: 10 })
      new Uint8Array(buffer).set([1, 2, 3])
      return buffer
    })(),
    source: `((a=new ArrayBuffer(8,{maxByteLength:10}))=>(new Uint8Array(a).set([1,2,3]),a))()`,
  },
  {
    name: `detached non-empty resizable ArrayBuffer initialized with trailing zeros`,
    value: (() => {
      const buffer = new ArrayBuffer(8, { maxByteLength: 10 })
      new Uint8Array(buffer).set([1, 2, 3])
      buffer.transfer()
      return buffer
    })(),
    source: `((a=new ArrayBuffer(0,{maxByteLength:0}))=>(a.transfer(),a))()`,
  },
  {
    name: `non-empty resizable ArrayBuffer initialized with leading and trailing zeros`,
    value: (() => {
      const buffer = new ArrayBuffer(8, { maxByteLength: 10 })
      new Uint8Array(buffer).set([0, 0, 1, 2, 3])
      return buffer
    })(),
    source: `((a=new ArrayBuffer(8,{maxByteLength:10}))=>(new Uint8Array(a).set([1,2,3],2),a))()`,
  },
  {
    name: `detached non-empty resizable ArrayBuffer initialized with leading and trailing zeros`,
    value: (() => {
      const buffer = new ArrayBuffer(8, { maxByteLength: 10 })
      new Uint8Array(buffer).set([0, 0, 1, 2, 3])
      buffer.transfer()
      return buffer
    })(),
    source: `((a=new ArrayBuffer(0,{maxByteLength:0}))=>(a.transfer(),a))()`,
  },
  {
    name: `non-empty resizable ArrayBuffer initialized with leading zeros`,
    value: (() => {
      const buffer = new ArrayBuffer(8, { maxByteLength: 10 })
      new Uint8Array(buffer).set([0, 0, 0, 0, 0, 1, 2, 3])
      return buffer
    })(),
    source: `((a=new ArrayBuffer(8,{maxByteLength:10}))=>(new Uint8Array(a).set([1,2,3],5),a))()`,
  },
  {
    name: `detached non-empty resizable ArrayBuffer initialized with leading zeros`,
    value: (() => {
      const buffer = new ArrayBuffer(8, { maxByteLength: 10 })
      new Uint8Array(buffer).set([0, 0, 0, 0, 0, 1, 2, 3])
      buffer.transfer()
      return buffer
    })(),
    source: `((a=new ArrayBuffer(0,{maxByteLength:0}))=>(a.transfer(),a))()`,
  },

  // Shared reference
  {
    name: `shared object reference`,
    value: (() => {
      const object = {}
      return { a: object, b: object }
    })(),
    source: `((a={})=>({a,b:a}))()`,
  },
  {
    name: `many shared object references`,
    value: (() => {
      const objects = Array.from({ length: 100 }, () => ({}))
      return [...objects, ...objects]
    })(),
    source: `((a={},b={},c={},d={},e={},f={},g={},h={},i={},j={},k={},l={},m={},n={},o={},p={},q={},r={},s={},t={},u={},v={},w={},x={},y={},z={},A={},B={},C={},D={},E={},F={},G={},H={},I={},J={},K={},L={},M={},N={},O={},P={},Q={},R={},S={},T={},U={},V={},W={},X={},Y={},Z={},$aa={},$ab={},$ac={},$ad={},$ae={},$af={},$ag={},$ah={},$ai={},$aj={},$ak={},$al={},$am={},$an={},$ao={},$ap={},$aq={},$ar={},$as={},$at={},$au={},$av={},$aw={},$ax={},$ay={},$az={},$aA={},$aB={},$aC={},$aD={},$aE={},$aF={},$aG={},$aH={},$aI={},$aJ={},$aK={},$aL={},$aM={},$aN={},$aO={},$aP={},$aQ={},$aR={},$aS={},$aT={},$aU={},$aV={})=>[a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z,A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z,$aa,$ab,$ac,$ad,$ae,$af,$ag,$ah,$ai,$aj,$ak,$al,$am,$an,$ao,$ap,$aq,$ar,$as,$at,$au,$av,$aw,$ax,$ay,$az,$aA,$aB,$aC,$aD,$aE,$aF,$aG,$aH,$aI,$aJ,$aK,$aL,$aM,$aN,$aO,$aP,$aQ,$aR,$aS,$aT,$aU,$aV,a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z,A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z,$aa,$ab,$ac,$ad,$ae,$af,$ag,$ah,$ai,$aj,$ak,$al,$am,$an,$ao,$ap,$aq,$ar,$as,$at,$au,$av,$aw,$ax,$ay,$az,$aA,$aB,$aC,$aD,$aE,$aF,$aG,$aH,$aI,$aJ,$aK,$aL,$aM,$aN,$aO,$aP,$aQ,$aR,$aS,$aT,$aU,$aV])()`,
  },

  // Circular reference
  {
    name: `directly circular object`,
    value: (() => {
      const circular: { ref?: unknown } = {}
      circular.ref = circular
      return circular
    })(),
    source: `((a={})=>a.ref=a)()`,
  },
  {
    name: `object containing directly circular object`,
    value: (() => {
      const circular: { ref?: unknown } = {}
      circular.ref = circular
      return { circular }
    })(),
    source: `((a={})=>(a.ref=a,{circular:a}))()`,
  },
  {
    name: `object containing directly circular object on property with same name as binding`,
    value: (() => {
      const circular: { ref?: unknown } = {}
      circular.ref = circular
      return { a: circular }
    })(),
    source: `((a={})=>(a.ref=a,{a}))()`,
  },
  {
    name: `mutually circular object`,
    value: (() => {
      const circular1: { ref?: unknown } = {}
      const circular2 = { ref: circular1 }
      circular1.ref = circular2
      return circular1
    })(),
    source: `((b={},a={ref:b})=>b.ref=a)()`,
  },
  {
    name: `object containing mutually circular object`,
    value: (() => {
      const circular1: { ref?: unknown } = {}
      const circular2 = { ref: circular1 }
      circular1.ref = circular2
      return { circular: circular1 }
    })(),
    source: `((b={},a={ref:b})=>(b.ref=a,{circular:a}))()`,
  },
  {
    name: `object containing both mutually circular objects`,
    value: (() => {
      const circular1: { ref?: unknown } = {}
      const circular2 = { ref: circular1 }
      circular1.ref = circular2
      return { a: circular1, b: circular2 }
    })(),
    source: `((b={},a={ref:b})=>(b.ref=a,{a,b}))()`,
  },
  {
    name: `circular object through string property with spaces`,
    value: (() => {
      const circular: { 'a b c'?: unknown } = {}
      circular[`a b c`] = circular
      return circular
    })(),
    source: `((a={})=>a["a b c"]=a)()`,
  },
  {
    name: `circular object through symbol property`,
    value: (() => {
      const circular: Record<PropertyKey, unknown> = {}
      circular[Symbol.hasInstance] = circular
      return circular
    })(),
    source: `((a={})=>a[Symbol.hasInstance]=a)()`,
  },
  {
    name: `circular array`,
    value: (() => {
      const circular: unknown[] = []
      circular.push(circular)
      return circular
    })(),
    source: `((a=[])=>a[0]=a)()`,
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
    source: `((b=[,],a=[b])=>(b[0]=a,b[1]=b,a))()`,
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
    source: `((a={})=>Object.defineProperty(a,"__proto__",{value:a,writable:true,enumerable:true,configurable:true}))()`,
  },
  {
    name: `prototype containing circular reference`,
    value: (() => {
      const circular1 = {}
      const circular2 = { ref: circular1 }
      return Object.setPrototypeOf(circular1, circular2) as unknown
    })(),
    source: `((b={},a=Object.setPrototypeOf({},b))=>b.ref=a)()`,
  },
  {
    name: `directly circular set`,
    value: (() => {
      const circular = new Set()
      circular.add(circular)
      return circular
    })(),
    source: `((a=new Set())=>a.add(a))()`,
  },
  {
    name: `set containing value with circular reference`,
    value: (() => {
      const circular = new Set()
      circular.add({ '': circular })
      return circular
    })(),
    source: `((b={},a=new Set([b]))=>b[""]=a)()`,
  },
  {
    name: `directly circular map entry value`,
    value: (() => {
      const circular = new Map()
      circular.set(`hi`, circular)
      return circular
    })(),
    source: `((a=new Map([["hi"]]))=>a.set("hi",a))()`,
  },
  {
    name: `circular map containing value with circular reference`,
    value: (() => {
      const circular = new Map()
      circular.set(`hi`, circular)
      circular.set(`hello`, { circular })
      return circular
    })(),
    source: `((b={},a=new Map([["hi"],["hello",b]]))=>(a.set("hi",a),b.circular=a))()`,
  },
  {
    name: `directly circular map entry key`,
    value: (() => {
      const circular = new Map()
      circular.set(circular, `howdy`)
      return circular
    })(),
    source: `((a=new Map())=>a.set(a,"howdy"))()`,
  },
  {
    name: `map containing key with circular reference`,
    value: (() => {
      const circular = new Map()
      circular.set({ '': circular }, circular)
      return circular
    })(),
    source: `((b={},a=new Map([[b]]))=>(b[""]=a,a.set(b,a)))()`,
  },
  {
    name: `map containing entry value map with circular key to outer map`,
    value: (() => {
      const circular = new Map()
      circular.set({}, { '': new Map([[circular, new Map()]]) })
      return circular
    })(),
    source: `((b=new Map(),a=new Map([[{},{"":b}]]))=>(b.set(a,new Map()),a))()`,
  },
  {
    name: `map containing array key with circular reference to outer map`,
    value: (() => {
      const array: unknown[] = []
      const circular = new Map([[array, {}]])
      array.push(circular)
      return circular
    })(),
    source: `((b=[],a=new Map([[b,{}]]))=>b[0]=a)()`,
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
    source: `((d={},c={"":d},b=new Map([[c]]),a=[b,[d]])=>(b.set(c,a),a))()`,
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
    source: `((c={},b=[,c],a=new Set([b]))=>(b[0]=a,c[""]=a))()`,
  },
] satisfies { name: string; value: unknown; source: string }[])(
  `srcify $name`,
  ({ value, source }) => {
    expect(expectSrcifyRoundtrips(value)).toBe(source)
  },
)

test.each([
  // eslint-disable-next-line symbol-description
  { name: `unique symbol`, value: Symbol() },
  { name: `unique symbol with description`, value: Symbol(`howdy`) },
  { name: `function`, value: () => {} },
] satisfies {
  name: string
  value: unknown
}[])(`srcify $name`, ({ value }) => {
  expect(() => srcify(value)).toThrowError()
})

const expectSrcifyRoundtrips = (value: unknown): string => {
  const source = srcify(value)

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
