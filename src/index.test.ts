/* eslint-disable require-unicode-regexp */
/* eslint-disable no-sparse-arrays */
/* eslint-disable unicorn/new-for-builtins */
/* eslint-disable no-new-wrappers */

import { test } from '@fast-check/vitest'
import { expect } from 'vitest'
import { anythingArb } from './arbs.ts'
import srcify from './index.ts'

test.prop([anythingArb], {
  numRuns: 500,
  examples: [
    undefined,
    null,
    false,
    true,
    -0,
    Number.NaN,
    -Infinity,
    Infinity,
    /abc/u,
    /def/,
    Symbol.iterator,
    Symbol.hasInstance,
    Symbol.for(`howdy`),
  ].map(value => [value]),
})(`srcify works`, value => {
  expectSrcifyRoundtrips(value)
})

test(`srcify ArrayBuffer`, () => {
  const emptyNonResizableArrayBuffer = new ArrayBuffer()
  expect(
    expectSrcifyRoundtrips(emptyNonResizableArrayBuffer),
  ).toMatchInlineSnapshot(`"new ArrayBuffer()"`)
  emptyNonResizableArrayBuffer.transfer()
  expect(
    expectSrcifyRoundtrips(emptyNonResizableArrayBuffer),
  ).toMatchInlineSnapshot(`"((a=new ArrayBuffer())=>(a.transfer(),a))()"`)

  const nonResizableArrayBuffer = new ArrayBuffer(8)
  expect(expectSrcifyRoundtrips(nonResizableArrayBuffer)).toMatchInlineSnapshot(
    `"new ArrayBuffer(8)"`,
  )
  new Uint8Array(nonResizableArrayBuffer).set([1, 2, 3])
  expect(expectSrcifyRoundtrips(nonResizableArrayBuffer)).toMatchInlineSnapshot(
    `"new Uint8Array([1,2,3,0,0,0,0,0]).buffer"`,
  )
  new Uint8Array(nonResizableArrayBuffer).set([0])
  expect(expectSrcifyRoundtrips(nonResizableArrayBuffer)).toMatchInlineSnapshot(
    `"new Uint8Array([0,2,3,0,0,0,0,0]).buffer"`,
  )
  nonResizableArrayBuffer.transfer()
  expect(expectSrcifyRoundtrips(nonResizableArrayBuffer)).toMatchInlineSnapshot(
    `"((a=new ArrayBuffer())=>(a.transfer(),a))()"`,
  )

  let resizableArrayBuffer = new ArrayBuffer(8, { maxByteLength: 10 })
  expect(expectSrcifyRoundtrips(resizableArrayBuffer)).toMatchInlineSnapshot(
    `"new ArrayBuffer(8,{maxByteLength:10})"`,
  )
  new Uint8Array(resizableArrayBuffer).set([1, 2, 3])
  expect(expectSrcifyRoundtrips(resizableArrayBuffer)).toMatchInlineSnapshot(
    `"((a=new ArrayBuffer(8,{maxByteLength:10}))=>(new Uint8Array(a).set([1,2,3]),a))()"`,
  )
  new Uint8Array(resizableArrayBuffer).set([0])
  expect(expectSrcifyRoundtrips(resizableArrayBuffer)).toMatchInlineSnapshot(
    `"((a=new ArrayBuffer(8,{maxByteLength:10}))=>(new Uint8Array(a).set([2,3],1),a))()"`,
  )
  resizableArrayBuffer.transfer()
  expect(expectSrcifyRoundtrips(resizableArrayBuffer)).toMatchInlineSnapshot(
    `"((a=new ArrayBuffer(0,{maxByteLength:0}))=>(a.transfer(),a))()"`,
  )

  resizableArrayBuffer = new ArrayBuffer(8, { maxByteLength: 8 })
  expect(expectSrcifyRoundtrips(resizableArrayBuffer)).toMatchInlineSnapshot(
    `"new ArrayBuffer(8,{maxByteLength:8})"`,
  )
  new Uint8Array(resizableArrayBuffer).set([1, 2, 3])
  expect(expectSrcifyRoundtrips(resizableArrayBuffer)).toMatchInlineSnapshot(
    `"((a=new ArrayBuffer(8,{maxByteLength:8}))=>(new Uint8Array(a).set([1,2,3]),a))()"`,
  )
  new Uint8Array(resizableArrayBuffer).set([0])
  expect(expectSrcifyRoundtrips(resizableArrayBuffer)).toMatchInlineSnapshot(
    `"((a=new ArrayBuffer(8,{maxByteLength:8}))=>(new Uint8Array(a).set([2,3],1),a))()"`,
  )
  resizableArrayBuffer.transfer()
  expect(expectSrcifyRoundtrips(resizableArrayBuffer)).toMatchInlineSnapshot(
    `"((a=new ArrayBuffer(0,{maxByteLength:0}))=>(a.transfer(),a))()"`,
  )

  resizableArrayBuffer = new ArrayBuffer(0, { maxByteLength: 3 })
  expect(expectSrcifyRoundtrips(resizableArrayBuffer)).toMatchInlineSnapshot(
    `"new ArrayBuffer(0,{maxByteLength:3})"`,
  )
  resizableArrayBuffer.transfer()
  expect(expectSrcifyRoundtrips(resizableArrayBuffer)).toMatchInlineSnapshot(
    `"((a=new ArrayBuffer(0,{maxByteLength:0}))=>(a.transfer(),a))()"`,
  )

  resizableArrayBuffer = new ArrayBuffer(0, { maxByteLength: 0 })
  expect(expectSrcifyRoundtrips(resizableArrayBuffer)).toMatchInlineSnapshot(
    `"new ArrayBuffer(0,{maxByteLength:0})"`,
  )
  resizableArrayBuffer.transfer()
  expect(expectSrcifyRoundtrips(resizableArrayBuffer)).toMatchInlineSnapshot(
    `"((a=new ArrayBuffer(0,{maxByteLength:0}))=>(a.transfer(),a))()"`,
  )
})

test(`srcify null and undefined`, () => {
  expect(expectSrcifyRoundtrips(undefined)).toMatchInlineSnapshot(`"undefined"`)
  expect(expectSrcifyRoundtrips(null)).toMatchInlineSnapshot(`"null"`)
})

test(`srcify boolean`, () => {
  expect(expectSrcifyRoundtrips(false)).toMatchInlineSnapshot(`"false"`)
  expect(expectSrcifyRoundtrips(true)).toMatchInlineSnapshot(`"true"`)
  expect(expectSrcifyRoundtrips(new Boolean())).toMatchInlineSnapshot(
    `"new Boolean()"`,
  )
  expect(expectSrcifyRoundtrips(new Boolean(false))).toMatchInlineSnapshot(
    `"new Boolean()"`,
  )
  expect(expectSrcifyRoundtrips(new Boolean(true))).toMatchInlineSnapshot(
    `"new Boolean(true)"`,
  )
})

test(`srcify number`, () => {
  expect(expectSrcifyRoundtrips(0)).toMatchInlineSnapshot(`"0"`)
  expect(expectSrcifyRoundtrips(-0)).toMatchInlineSnapshot(`"-0"`)
  expect(expectSrcifyRoundtrips(42)).toMatchInlineSnapshot(`"42"`)
  expect(expectSrcifyRoundtrips(-42)).toMatchInlineSnapshot(`"-42"`)
  expect(expectSrcifyRoundtrips(3.14)).toMatchInlineSnapshot(`"3.14"`)
  expect(expectSrcifyRoundtrips(-3.14)).toMatchInlineSnapshot(`"-3.14"`)
  expect(expectSrcifyRoundtrips(Number.NaN)).toMatchInlineSnapshot(`"NaN"`)
  expect(expectSrcifyRoundtrips(Infinity)).toMatchInlineSnapshot(`"Infinity"`)
  expect(expectSrcifyRoundtrips(-Infinity)).toMatchInlineSnapshot(`"-Infinity"`)
  expect(expectSrcifyRoundtrips(new Number())).toMatchInlineSnapshot(
    `"new Number()"`,
  )
  expect(expectSrcifyRoundtrips(new Number(0))).toMatchInlineSnapshot(
    `"new Number()"`,
  )
  expect(expectSrcifyRoundtrips(new Number(-0))).toMatchInlineSnapshot(
    `"new Number(-0)"`,
  )
  expect(expectSrcifyRoundtrips(new Number(42))).toMatchInlineSnapshot(
    `"new Number(42)"`,
  )
})

test(`srcify bigint`, () => {
  expect(expectSrcifyRoundtrips(0n)).toMatchInlineSnapshot(`"0n"`)
  expect(expectSrcifyRoundtrips(42n)).toMatchInlineSnapshot(`"42n"`)
  expect(expectSrcifyRoundtrips(-42n)).toMatchInlineSnapshot(`"-42n"`)
  expect(
    expectSrcifyRoundtrips(2_347_623_847_628_347_263n),
  ).toMatchInlineSnapshot(`"2347623847628347263n"`)
})

test(`srcify string`, () => {
  expect(expectSrcifyRoundtrips(``)).toMatchInlineSnapshot(`""""`)
  expect(expectSrcifyRoundtrips(`a b c`)).toMatchInlineSnapshot(`""a b c""`)
  expect(expectSrcifyRoundtrips(`"""`)).toMatchInlineSnapshot(`""\\"\\"\\"""`)
  expect(expectSrcifyRoundtrips(`\\"\\"`)).toMatchInlineSnapshot(
    `""\\\\\\"\\\\\\"""`,
  )
  expect(expectSrcifyRoundtrips(new String())).toMatchInlineSnapshot(
    `"new String()"`,
  )
  expect(expectSrcifyRoundtrips(new String(``))).toMatchInlineSnapshot(
    `"new String()"`,
  )
  expect(
    expectSrcifyRoundtrips(new String(`Hello World!`)),
  ).toMatchInlineSnapshot(`"new String("Hello World!")"`)
  expect(expectSrcifyRoundtrips(`</script>`)).toMatchInlineSnapshot(
    `""<\\u002fscript>""`,
  )
  expect(expectSrcifyRoundtrips(`</SCRIPT>`)).toMatchInlineSnapshot(
    `""<\\u002fSCRIPT>""`,
  )
  expect(expectSrcifyRoundtrips(`</sCrIpT>`)).toMatchInlineSnapshot(
    `""<\\u002fsCrIpT>""`,
  )
  expect(expectSrcifyRoundtrips(`\0`)).toMatchInlineSnapshot(`""\\u0000""`)
  expect(expectSrcifyRoundtrips(`\b`)).toMatchInlineSnapshot(`""\\b""`)
  expect(expectSrcifyRoundtrips(`\t`)).toMatchInlineSnapshot(`""\\t""`)
  expect(expectSrcifyRoundtrips(`\n`)).toMatchInlineSnapshot(`""\\n""`)
  expect(expectSrcifyRoundtrips(`\r`)).toMatchInlineSnapshot(`""\\r""`)
  expect(expectSrcifyRoundtrips(`\\`)).toMatchInlineSnapshot(`""\\\\""`)
  expect(expectSrcifyRoundtrips(`\u2028`)).toMatchInlineSnapshot(`""\\u2028""`)
  expect(expectSrcifyRoundtrips(`\u2028\u2028\u2028`)).toMatchInlineSnapshot(
    `""\\u2028\\u2028\\u2028""`,
  )
  expect(expectSrcifyRoundtrips(`\u2029`)).toMatchInlineSnapshot(`""\\u2029""`)
  expect(expectSrcifyRoundtrips(`\u2029\u2029\u2029`)).toMatchInlineSnapshot(
    `""\\u2029\\u2029\\u2029""`,
  )
})

test(`srcify symbol`, () => {
  expect(expectSrcifyRoundtrips(Symbol.iterator)).toMatchInlineSnapshot(
    `"Symbol.iterator"`,
  )
  expect(expectSrcifyRoundtrips(Symbol.hasInstance)).toMatchInlineSnapshot(
    `"Symbol.hasInstance"`,
  )
  expect(expectSrcifyRoundtrips(Symbol.for(`howdy`))).toMatchInlineSnapshot(
    `"Symbol.for("howdy")"`,
  )
  expect(() =>
    srcify(Symbol(`Hello World!`)),
  ).toThrowErrorMatchingInlineSnapshot(`[TypeError: Unsupported symbol]`)
})

test(`srcify array`, () => {
  expect(expectSrcifyRoundtrips([])).toMatchInlineSnapshot(`"[]"`)
  expect(expectSrcifyRoundtrips([1, 2, 3])).toMatchInlineSnapshot(`"[1,2,3]"`)
  expect(expectSrcifyRoundtrips([1, , 3])).toMatchInlineSnapshot(`"[1,,3]"`)
  expect(expectSrcifyRoundtrips([1, , , , , 3])).toMatchInlineSnapshot(
    `"[1,,,,,3]"`,
  )
  expect(expectSrcifyRoundtrips([1, 2, 3, ,])).toMatchInlineSnapshot(
    `"[1,2,3,,]"`,
  )
})

test(`srcify object`, () => {
  expect(expectSrcifyRoundtrips({})).toMatchInlineSnapshot(`"{}"`)
  expect(expectSrcifyRoundtrips({ a: 2 })).toMatchInlineSnapshot(`"{a:2}"`)
  expect(expectSrcifyRoundtrips({ ab: 2 })).toMatchInlineSnapshot(`"{ab:2}"`)
  expect(expectSrcifyRoundtrips({ 1: 2 })).toMatchInlineSnapshot(`"{1:2}"`)
  expect(expectSrcifyRoundtrips({ 1: 1 })).toMatchInlineSnapshot(`"{1:1}"`)
  expect(expectSrcifyRoundtrips({ '1': 2 })).toMatchInlineSnapshot(`"{1:2}"`)
  expect(expectSrcifyRoundtrips({ 'a b c': 2 })).toMatchInlineSnapshot(
    `"{"a b c":2}"`,
  )
  expect(
    expectSrcifyRoundtrips({ [Symbol.toStringTag]: `hi` }),
  ).toMatchInlineSnapshot(`"{[Symbol.toStringTag]:"hi"}"`)
  expect(expectSrcifyRoundtrips(Object.create(null))).toMatchInlineSnapshot(
    `"Object.setPrototypeOf({},null)"`,
  )
  expect(
    expectSrcifyRoundtrips(Object.assign(Object.create(null), { a: 2 })),
  ).toMatchInlineSnapshot(`"Object.setPrototypeOf({a:2},null)"`)
  expect(expectSrcifyRoundtrips({ __proto__: null })).toMatchInlineSnapshot(
    `"Object.setPrototypeOf({},null)"`,
  )
  expect(
    expectSrcifyRoundtrips(
      Object.defineProperty({ a: 2 }, `__proto__`, {
        value: null,
        configurable: true,
        enumerable: true,
        writable: true,
      }),
    ),
  ).toMatchInlineSnapshot(
    `"Object.defineProperty({a:2},"__proto__",{value:null,writable:true,enumerable:true,configurable:true})"`,
  )
  expect(
    expectSrcifyRoundtrips({ [Symbol.toStringTag]: `howdy` }),
  ).toMatchInlineSnapshot(`"{[Symbol.toStringTag]:"howdy"}"`)
})

test(`srcify Date`, () => {
  expect(expectSrcifyRoundtrips(new Date(42))).toMatchInlineSnapshot(
    `"new Date(42)"`,
  )
  expect(expectSrcifyRoundtrips(new Date(Number.NaN))).toMatchInlineSnapshot(
    `"new Date(NaN)"`,
  )
})

test(`srcify URL`, () => {
  expect(
    expectSrcifyRoundtrips(new URL(`https://tomeraberba.ch`)),
  ).toMatchInlineSnapshot(`"new URL("https://tomeraberba.ch/")"`)
})

test(`srcify URLSearchParams`, () => {
  expect(expectSrcifyRoundtrips(new URLSearchParams())).toMatchInlineSnapshot(
    `"new URLSearchParams()"`,
  )
  expect(
    expectSrcifyRoundtrips(new URLSearchParams([[`a`, `b`]])),
  ).toMatchInlineSnapshot(`"new URLSearchParams([["a","b"]])"`)
})

test(`srcify RegExp`, () => {
  expect(expectSrcifyRoundtrips(/abc/)).toMatchInlineSnapshot(
    `"new RegExp("abc")"`,
  )
  expect(expectSrcifyRoundtrips(/abc/iu)).toMatchInlineSnapshot(
    `"new RegExp("abc","iu")"`,
  )
})

test(`srcify Map`, () => {
  expect(expectSrcifyRoundtrips(new Map())).toMatchInlineSnapshot(`"new Map()"`)
  expect(expectSrcifyRoundtrips(new Map([]))).toMatchInlineSnapshot(
    `"new Map()"`,
  )
  expect(expectSrcifyRoundtrips(new Map([[1, 2]]))).toMatchInlineSnapshot(
    `"new Map([[1,2]])"`,
  )
})

test(`srcify Set`, () => {
  expect(expectSrcifyRoundtrips(new Set())).toMatchInlineSnapshot(`"new Set()"`)
  expect(expectSrcifyRoundtrips(new Set([]))).toMatchInlineSnapshot(
    `"new Set()"`,
  )
  expect(expectSrcifyRoundtrips(new Set([1, 2]))).toMatchInlineSnapshot(
    `"new Set([1,2])"`,
  )
})

test(`srcify Int8Array`, () => {
  expect(expectSrcifyRoundtrips(new Int8Array())).toMatchInlineSnapshot(
    `"new Int8Array()"`,
  )
  expect(expectSrcifyRoundtrips(new Int8Array(1024))).toMatchInlineSnapshot(
    `"new Int8Array(1024)"`,
  )
  expect(
    expectSrcifyRoundtrips(new Int8Array([1, -2, 3, 4])),
  ).toMatchInlineSnapshot(`"new Int8Array([1,-2,3,4])"`)
})

test(`srcify Uint8Array`, () => {
  expect(expectSrcifyRoundtrips(new Uint8Array())).toMatchInlineSnapshot(
    `"new Uint8Array()"`,
  )
  expect(expectSrcifyRoundtrips(new Uint8Array(1024))).toMatchInlineSnapshot(
    `"new Uint8Array(1024)"`,
  )
  expect(
    expectSrcifyRoundtrips(new Uint8Array([1, 2, 3, 4])),
  ).toMatchInlineSnapshot(`"new Uint8Array([1,2,3,4])"`)
})

test(`srcify Uint8ClampedArray`, () => {
  expect(expectSrcifyRoundtrips(new Uint8ClampedArray())).toMatchInlineSnapshot(
    `"new Uint8ClampedArray()"`,
  )
  expect(
    expectSrcifyRoundtrips(new Uint8ClampedArray(1024)),
  ).toMatchInlineSnapshot(`"new Uint8ClampedArray(1024)"`)
  expect(
    expectSrcifyRoundtrips(new Uint8ClampedArray([1, 2, 3, 4])),
  ).toMatchInlineSnapshot(`"new Uint8ClampedArray([1,2,3,4])"`)
})

test(`srcify Int16Array`, () => {
  expect(expectSrcifyRoundtrips(new Int16Array())).toMatchInlineSnapshot(
    `"new Int16Array()"`,
  )
  expect(expectSrcifyRoundtrips(new Int16Array(1024))).toMatchInlineSnapshot(
    `"new Int16Array(1024)"`,
  )
  expect(
    expectSrcifyRoundtrips(new Int16Array([1, -2, 3, 4])),
  ).toMatchInlineSnapshot(`"new Int16Array([1,-2,3,4])"`)
})

test(`srcify Uint16Array`, () => {
  expect(expectSrcifyRoundtrips(new Uint16Array())).toMatchInlineSnapshot(
    `"new Uint16Array()"`,
  )
  expect(expectSrcifyRoundtrips(new Uint16Array(1024))).toMatchInlineSnapshot(
    `"new Uint16Array(1024)"`,
  )
  expect(
    expectSrcifyRoundtrips(new Uint16Array([1, 2, 3, 4])),
  ).toMatchInlineSnapshot(`"new Uint16Array([1,2,3,4])"`)
})

test(`srcify Int32Array`, () => {
  expect(expectSrcifyRoundtrips(new Int32Array())).toMatchInlineSnapshot(
    `"new Int32Array()"`,
  )
  expect(expectSrcifyRoundtrips(new Int32Array(1024))).toMatchInlineSnapshot(
    `"new Int32Array(1024)"`,
  )
  expect(
    expectSrcifyRoundtrips(new Int32Array([1, -2, 3, 4])),
  ).toMatchInlineSnapshot(`"new Int32Array([1,-2,3,4])"`)
})

test(`srcify Uint32Array`, () => {
  expect(expectSrcifyRoundtrips(new Uint32Array())).toMatchInlineSnapshot(
    `"new Uint32Array()"`,
  )
  expect(expectSrcifyRoundtrips(new Uint32Array(1024))).toMatchInlineSnapshot(
    `"new Uint32Array(1024)"`,
  )
  expect(
    expectSrcifyRoundtrips(new Uint32Array([1, 2, 3, 4])),
  ).toMatchInlineSnapshot(`"new Uint32Array([1,2,3,4])"`)
})

test(`srcify Float32Array`, () => {
  expect(expectSrcifyRoundtrips(new Float32Array())).toMatchInlineSnapshot(
    `"new Float32Array()"`,
  )
  expect(expectSrcifyRoundtrips(new Float32Array(1024))).toMatchInlineSnapshot(
    `"new Float32Array(1024)"`,
  )
  expect(
    expectSrcifyRoundtrips(new Float32Array([1, -2, 3.140_000_104_904_175, 4])),
  ).toMatchInlineSnapshot(`"new Float32Array([1,-2,3.140000104904175,4])"`)
})

test(`srcify Float64Array`, () => {
  expect(expectSrcifyRoundtrips(new Float64Array())).toMatchInlineSnapshot(
    `"new Float64Array()"`,
  )
  expect(expectSrcifyRoundtrips(new Float64Array(1024))).toMatchInlineSnapshot(
    `"new Float64Array(1024)"`,
  )
  expect(
    expectSrcifyRoundtrips(new Float64Array([1, -2, 3.14, 4])),
  ).toMatchInlineSnapshot(`"new Float64Array([1,-2,3.14,4])"`)
})

test(`srcify BigInt64Array`, () => {
  expect(expectSrcifyRoundtrips(new BigInt64Array())).toMatchInlineSnapshot(
    `"new BigInt64Array()"`,
  )
  expect(expectSrcifyRoundtrips(new BigInt64Array(1024))).toMatchInlineSnapshot(
    `"new BigInt64Array(1024)"`,
  )
  expect(
    expectSrcifyRoundtrips(new BigInt64Array([1n, -2n, 3n, 4n])),
  ).toMatchInlineSnapshot(`"new BigInt64Array([1n,-2n,3n,4n])"`)
})

test(`srcify BigUint64Array`, () => {
  expect(expectSrcifyRoundtrips(new BigUint64Array())).toMatchInlineSnapshot(
    `"new BigUint64Array()"`,
  )
  expect(
    expectSrcifyRoundtrips(new BigUint64Array(1024)),
  ).toMatchInlineSnapshot(`"new BigUint64Array(1024)"`)
  expect(
    expectSrcifyRoundtrips(new BigUint64Array([1n, 2n, 3n, 4n])),
  ).toMatchInlineSnapshot(`"new BigUint64Array([1n,2n,3n,4n])"`)
})

test(`srcify shared reference`, () => {
  const object = {}
  expect(
    expectSrcifyRoundtrips({ a: object, b: object }),
  ).toMatchInlineSnapshot(`"((a={})=>({a,b:a}))()"`)
  const objects = Array.from({ length: 100 }, () => ({}))
  expect(
    expectSrcifyRoundtrips([...objects, ...objects]),
  ).toMatchInlineSnapshot(
    `"((a={},b={},c={},d={},e={},f={},g={},h={},i={},j={},k={},l={},m={},n={},o={},p={},q={},r={},s={},t={},u={},v={},w={},x={},y={},z={},A={},B={},C={},D={},E={},F={},G={},H={},I={},J={},K={},L={},M={},N={},O={},P={},Q={},R={},S={},T={},U={},V={},W={},X={},Y={},Z={},$aa={},$ab={},$ac={},$ad={},$ae={},$af={},$ag={},$ah={},$ai={},$aj={},$ak={},$al={},$am={},$an={},$ao={},$ap={},$aq={},$ar={},$as={},$at={},$au={},$av={},$aw={},$ax={},$ay={},$az={},$aA={},$aB={},$aC={},$aD={},$aE={},$aF={},$aG={},$aH={},$aI={},$aJ={},$aK={},$aL={},$aM={},$aN={},$aO={},$aP={},$aQ={},$aR={},$aS={},$aT={},$aU={},$aV={})=>[a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z,A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z,$aa,$ab,$ac,$ad,$ae,$af,$ag,$ah,$ai,$aj,$ak,$al,$am,$an,$ao,$ap,$aq,$ar,$as,$at,$au,$av,$aw,$ax,$ay,$az,$aA,$aB,$aC,$aD,$aE,$aF,$aG,$aH,$aI,$aJ,$aK,$aL,$aM,$aN,$aO,$aP,$aQ,$aR,$aS,$aT,$aU,$aV,a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z,A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z,$aa,$ab,$ac,$ad,$ae,$af,$ag,$ah,$ai,$aj,$ak,$al,$am,$an,$ao,$ap,$aq,$ar,$as,$at,$au,$av,$aw,$ax,$ay,$az,$aA,$aB,$aC,$aD,$aE,$aF,$aG,$aH,$aI,$aJ,$aK,$aL,$aM,$aN,$aO,$aP,$aQ,$aR,$aS,$aT,$aU,$aV])()"`,
  )
})

test(`srcify circular reference`, () => {
  const circular: { ref?: unknown } = {}
  circular.ref = circular
  expect(expectSrcifyRoundtrips(circular)).toMatchInlineSnapshot(
    `"((a={})=>a.ref=a)()"`,
  )
  expect(expectSrcifyRoundtrips({ circular })).toMatchInlineSnapshot(
    `"((a={})=>(a.ref=a,{circular:a}))()"`,
  )
  expect(expectSrcifyRoundtrips({ a: circular })).toMatchInlineSnapshot(
    `"((a={})=>(a.ref=a,{a}))()"`,
  )
  const circular1: { ref?: unknown } = {}
  const circular2 = { ref: circular1 }
  circular1.ref = circular2
  expect(expectSrcifyRoundtrips(circular1)).toMatchInlineSnapshot(
    `"((b={},a={ref:b})=>b.ref=a)()"`,
  )
  expect(expectSrcifyRoundtrips(circular2)).toMatchInlineSnapshot(
    `"((b={},a={ref:b})=>b.ref=a)()"`,
  )
  expect(expectSrcifyRoundtrips({ circular: circular1 })).toMatchInlineSnapshot(
    `"((b={},a={ref:b})=>(b.ref=a,{circular:a}))()"`,
  )
  expect(
    expectSrcifyRoundtrips({ a: circular1, b: circular2 }),
  ).toMatchInlineSnapshot(`"((b={},a={ref:b})=>(b.ref=a,{a,b}))()"`)
  const circular3: Record<PropertyKey, unknown> = {}
  circular3[Symbol.hasInstance] = circular3
  expect(expectSrcifyRoundtrips(circular3)).toMatchInlineSnapshot(
    `"((a={})=>a[Symbol.hasInstance]=a)()"`,
  )
  const circularArray: unknown[] = []
  circularArray.push(circularArray)
  expect(expectSrcifyRoundtrips(circularArray)).toMatchInlineSnapshot(
    `"((a=[])=>a[0]=a)()"`,
  )
  const circularWithStringKey: { 'a b c'?: unknown } = {}
  circularWithStringKey[`a b c`] = circularWithStringKey
  expect(expectSrcifyRoundtrips(circularWithStringKey)).toMatchInlineSnapshot(
    `"((a={})=>a["a b c"]=a)()"`,
  )
  const circularArrayInner: unknown[] = []
  const circularArrayOuter: unknown[] = []
  circularArrayInner.push(circularArrayOuter, circularArrayInner)
  circularArrayOuter.push(circularArrayInner)
  expect(expectSrcifyRoundtrips(circularArrayOuter)).toMatchInlineSnapshot(
    `"((b=[,],a=[b])=>(b[0]=a,b[1]=b,a))()"`,
  )
  const circularOwnProto = {}
  Object.defineProperty(circularOwnProto, `__proto__`, {
    value: circularOwnProto,
    configurable: true,
    enumerable: true,
    writable: true,
  })
  expect(expectSrcifyRoundtrips(circularOwnProto)).toMatchInlineSnapshot(
    `"((a={})=>Object.defineProperty(a,"__proto__",{value:a,writable:true,enumerable:true,configurable:true}))()"`,
  )
  const circularProto1 = {}
  const circularProto2 = { ref: circularProto1 }
  Object.setPrototypeOf(circularProto1, circularProto2)
  expect(expectSrcifyRoundtrips(circularProto1)).toMatchInlineSnapshot(
    `"((b={},a=Object.setPrototypeOf({},b))=>b.ref=a)()"`,
  )
  const circularMap = new Map()
  circularMap.set(`hi`, circularMap)
  expect(expectSrcifyRoundtrips(circularMap)).toMatchInlineSnapshot(
    `"((a=new Map([["hi"]]))=>a.set("hi",a))()"`,
  )
  circularMap.set(`hello`, { circularMap })
  expect(expectSrcifyRoundtrips(circularMap)).toMatchInlineSnapshot(
    `"((b={},a=new Map([["hi"],["hello",b]]))=>(a.set("hi",a),b.circularMap=a))()"`,
  )
  const circularMap2 = new Map()
  circularMap2.set(circularMap2, `howdy`)
  expect(expectSrcifyRoundtrips(circularMap2)).toMatchInlineSnapshot(
    `"((a=new Map())=>a.set(a,"howdy"))()"`,
  )
  const circularMap3 = new Map()
  circularMap3.set({ '': circularMap3 }, circularMap3)
  expect(expectSrcifyRoundtrips(circularMap3)).toMatchInlineSnapshot(
    `"((b={},a=new Map([[b]]))=>(b[""]=a,a.set(b,a)))()"`,
  )
  const circularMap4 = new Map()
  circularMap4.set({}, { '': new Map([[circularMap4, new Map()]]) })
  expect(expectSrcifyRoundtrips(circularMap4)).toMatchInlineSnapshot(
    `"((b=new Map(),a=new Map([[{},{"":b}]]))=>(b.set(a,new Map()),a))()"`,
  )
  const arrayKey: unknown[] = []
  const circularMap5 = new Map([[arrayKey, {}]])
  arrayKey.push(circularMap5)
  expect(expectSrcifyRoundtrips(circularMap5)).toMatchInlineSnapshot(
    `"((b=[],a=new Map([[b,{}]]))=>b[0]=a)()"`,
  )
  ;(() => {
    const d = {}
    const c = { '': d }
    const b = new Map<unknown, unknown>([[c, undefined]])
    const a = [b, [d]]
    b.set(c, a)
    expect(expectSrcifyRoundtrips(a)).toMatchInlineSnapshot(
      `"((d={},c={"":d},b=new Map([[c]]),a=[b,[d]])=>(b.set(c,a),a))()"`,
    )
  })()

  const circularSet1 = new Set()
  circularSet1.add(circularSet1)
  expect(expectSrcifyRoundtrips(circularSet1)).toMatchInlineSnapshot(
    `"((a=new Set())=>a.add(a))()"`,
  )
  const circularSet2 = new Set()
  circularSet2.add({ '': circularSet2 })
  expect(expectSrcifyRoundtrips(circularSet2)).toMatchInlineSnapshot(
    `"((b={},a=new Set([b]))=>b[""]=a)()"`,
  )
  ;(() => {
    const c: Record<string, unknown> = {}
    const b: unknown[] = [, c]
    const a = new Set([b])
    b[0] = a
    c[``] = a
    expect(expectSrcifyRoundtrips(a)).toMatchInlineSnapshot(
      `"((c={},b=[,c],a=new Set([b]))=>(b[0]=a,c[""]=a))()"`,
    )
  })()
})

test(`srcify function`, () => {
  expect(() => srcify(() => {})).toThrowErrorMatchingInlineSnapshot(
    `[TypeError: Unsupported function]`,
  )
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
