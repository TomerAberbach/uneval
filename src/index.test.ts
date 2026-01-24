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
  ].map(value => [value]),
})(`srcify works`, value => {
  const source = srcify(value)

  let roundtrippedValue: unknown
  try {
    // eslint-disable-next-line no-eval
    roundtrippedValue = (0, eval)(`(${source})`) as unknown
  } catch (error: unknown) {
    console.log(value)
    console.log(source)
    throw error
  }
  expect(roundtrippedValue, source).toStrictEqual(value)
})

test(`srcify snapshots`, () => {
  // Undefined and null
  expect(srcify(undefined)).toMatchInlineSnapshot(`"undefined"`)
  expect(srcify(null)).toMatchInlineSnapshot(`"null"`)

  // Booleans
  expect(srcify(false)).toMatchInlineSnapshot(`"false"`)
  expect(srcify(true)).toMatchInlineSnapshot(`"true"`)
  expect(srcify(new Boolean())).toMatchInlineSnapshot(`"new Boolean()"`)
  expect(srcify(new Boolean(false))).toMatchInlineSnapshot(`"new Boolean()"`)
  expect(srcify(new Boolean(true))).toMatchInlineSnapshot(`"new Boolean(true)"`)

  // Numbers
  expect(srcify(0)).toMatchInlineSnapshot(`"0"`)
  expect(srcify(-0)).toMatchInlineSnapshot(`"-0"`)
  expect(srcify(42)).toMatchInlineSnapshot(`"42"`)
  expect(srcify(-42)).toMatchInlineSnapshot(`"-42"`)
  expect(srcify(3.14)).toMatchInlineSnapshot(`"3.14"`)
  expect(srcify(-3.14)).toMatchInlineSnapshot(`"-3.14"`)
  expect(srcify(Number.NaN)).toMatchInlineSnapshot(`"NaN"`)
  expect(srcify(Infinity)).toMatchInlineSnapshot(`"Infinity"`)
  expect(srcify(-Infinity)).toMatchInlineSnapshot(`"-Infinity"`)
  expect(srcify(new Number())).toMatchInlineSnapshot(`"new Number()"`)
  expect(srcify(new Number(0))).toMatchInlineSnapshot(`"new Number()"`)
  expect(srcify(new Number(-0))).toMatchInlineSnapshot(`"new Number(-0)"`)
  expect(srcify(new Number(42))).toMatchInlineSnapshot(`"new Number(42)"`)

  // Bigints
  expect(srcify(0n)).toMatchInlineSnapshot(`"0n"`)
  expect(srcify(42n)).toMatchInlineSnapshot(`"42n"`)
  expect(srcify(-42n)).toMatchInlineSnapshot(`"-42n"`)
  expect(srcify(2_347_623_847_628_347_263n)).toMatchInlineSnapshot(
    `"2347623847628347263n"`,
  )

  // Strings
  expect(srcify(``)).toMatchInlineSnapshot(`""""`)
  expect(srcify(`a b c`)).toMatchInlineSnapshot(`""a b c""`)
  expect(srcify(`"""`)).toMatchInlineSnapshot(`""\\"\\"\\"""`)
  expect(srcify(`\\"\\"`)).toMatchInlineSnapshot(`""\\\\\\"\\\\\\"""`)
  expect(srcify(new String())).toMatchInlineSnapshot(`"new String()"`)
  expect(srcify(new String(``))).toMatchInlineSnapshot(`"new String()"`)
  expect(srcify(new String(`Hello World!`))).toMatchInlineSnapshot(
    `"new String("Hello World!")"`,
  )

  // Symbols
  expect(srcify(Symbol.iterator)).toMatchInlineSnapshot(`"Symbol.iterator"`)
  expect(srcify(Symbol.hasInstance)).toMatchInlineSnapshot(
    `"Symbol.hasInstance"`,
  )

  // Arrays
  expect(srcify([])).toMatchInlineSnapshot(`"[]"`)
  expect(srcify([1, 2, 3])).toMatchInlineSnapshot(`"[1,2,3]"`)
  expect(srcify([1, , 3])).toMatchInlineSnapshot(`"[1,,3]"`)
  expect(srcify([1, , , , , 3])).toMatchInlineSnapshot(`"[1,,,,,3]"`)
  expect(srcify([1, 2, 3, ,])).toMatchInlineSnapshot(`"[1,2,3,,]"`)

  // Objects
  expect(srcify({})).toMatchInlineSnapshot(`"{}"`)
  expect(srcify({ a: 2 })).toMatchInlineSnapshot(`"{a:2}"`)
  expect(srcify({ ab: 2 })).toMatchInlineSnapshot(`"{ab:2}"`)
  expect(srcify({ 1: 2 })).toMatchInlineSnapshot(`"{1:2}"`)
  expect(srcify({ 1: 1 })).toMatchInlineSnapshot(`"{1:1}"`)
  expect(srcify({ '1': 2 })).toMatchInlineSnapshot(`"{1:2}"`)
  expect(srcify({ 'a b c': 2 })).toMatchInlineSnapshot(`"{"a b c":2}"`)
  expect(srcify(Object.create(null))).toMatchInlineSnapshot(
    `"Object.setPrototypeOf({},null)"`,
  )
  expect(
    srcify(Object.assign(Object.create(null), { a: 2 })),
  ).toMatchInlineSnapshot(`"Object.setPrototypeOf({a:2},null)"`)
  expect(srcify({ __proto__: null })).toMatchInlineSnapshot(
    `"Object.setPrototypeOf({},null)"`,
  )
  expect(
    srcify(
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
  expect(srcify({ [Symbol.toStringTag]: `howdy` })).toMatchInlineSnapshot(
    `"{[Symbol.toStringTag]:"howdy"}"`,
  )

  // Dates
  expect(srcify(new Date(42))).toMatchInlineSnapshot(`"new Date(42)"`)
  expect(srcify(new Date(Number.NaN))).toMatchInlineSnapshot(`"new Date(NaN)"`)

  // URLs
  expect(srcify(new URL(`https://tomeraberba.ch`))).toMatchInlineSnapshot(
    `"new URL("https://tomeraberba.ch/")"`,
  )

  // RegExps
  expect(srcify(/abc/)).toMatchInlineSnapshot(`"new RegExp("abc")"`)
  expect(srcify(/abc/iu)).toMatchInlineSnapshot(`"new RegExp("abc","iu")"`)

  // Maps
  expect(srcify(new Map())).toMatchInlineSnapshot(`"new Map()"`)
  expect(srcify(new Map([]))).toMatchInlineSnapshot(`"new Map()"`)
  expect(srcify(new Map([[1, 2]]))).toMatchInlineSnapshot(`"new Map([[1,2]])"`)

  // Sets
  expect(srcify(new Set())).toMatchInlineSnapshot(`"new Set()"`)
  expect(srcify(new Set([]))).toMatchInlineSnapshot(`"new Set()"`)
  expect(srcify(new Set([1, 2]))).toMatchInlineSnapshot(`"new Set([1,2])"`)

  // Int8Arrays
  expect(srcify(new Int8Array())).toMatchInlineSnapshot(`"new Int8Array()"`)
  expect(srcify(new Int8Array(1024))).toMatchInlineSnapshot(
    `"new Int8Array(1024)"`,
  )
  expect(srcify(new Int8Array([1, -2, 3, 4]))).toMatchInlineSnapshot(
    `"new Int8Array([1,-2,3,4])"`,
  )

  // Uint8Arrays
  expect(srcify(new Uint8Array())).toMatchInlineSnapshot(`"new Uint8Array()"`)
  expect(srcify(new Uint8Array(1024))).toMatchInlineSnapshot(
    `"new Uint8Array(1024)"`,
  )
  expect(srcify(new Uint8Array([1, 2, 3, 4]))).toMatchInlineSnapshot(
    `"new Uint8Array([1,2,3,4])"`,
  )

  // Uint8ClampedArrays
  expect(srcify(new Uint8ClampedArray())).toMatchInlineSnapshot(
    `"new Uint8ClampedArray()"`,
  )
  expect(srcify(new Uint8ClampedArray(1024))).toMatchInlineSnapshot(
    `"new Uint8ClampedArray(1024)"`,
  )
  expect(srcify(new Uint8ClampedArray([1, 2, 3, 4]))).toMatchInlineSnapshot(
    `"new Uint8ClampedArray([1,2,3,4])"`,
  )

  // Int16Arrays
  expect(srcify(new Int16Array())).toMatchInlineSnapshot(`"new Int16Array()"`)
  expect(srcify(new Int16Array(1024))).toMatchInlineSnapshot(
    `"new Int16Array(1024)"`,
  )
  expect(srcify(new Int16Array([1, -2, 3, 4]))).toMatchInlineSnapshot(
    `"new Int16Array([1,-2,3,4])"`,
  )

  // Uint16Arrays
  expect(srcify(new Uint16Array())).toMatchInlineSnapshot(`"new Uint16Array()"`)
  expect(srcify(new Uint16Array(1024))).toMatchInlineSnapshot(
    `"new Uint16Array(1024)"`,
  )
  expect(srcify(new Uint16Array([1, 2, 3, 4]))).toMatchInlineSnapshot(
    `"new Uint16Array([1,2,3,4])"`,
  )

  // Int32Arrays
  expect(srcify(new Int32Array())).toMatchInlineSnapshot(`"new Int32Array()"`)
  expect(srcify(new Int32Array(1024))).toMatchInlineSnapshot(
    `"new Int32Array(1024)"`,
  )
  expect(srcify(new Int32Array([1, -2, 3, 4]))).toMatchInlineSnapshot(
    `"new Int32Array([1,-2,3,4])"`,
  )

  // Uint32Arrays
  expect(srcify(new Uint32Array())).toMatchInlineSnapshot(`"new Uint32Array()"`)
  expect(srcify(new Uint32Array(1024))).toMatchInlineSnapshot(
    `"new Uint32Array(1024)"`,
  )
  expect(srcify(new Uint32Array([1, 2, 3, 4]))).toMatchInlineSnapshot(
    `"new Uint32Array([1,2,3,4])"`,
  )

  // Float32Arrays
  expect(srcify(new Float32Array())).toMatchInlineSnapshot(
    `"new Float32Array()"`,
  )
  expect(srcify(new Float32Array(1024))).toMatchInlineSnapshot(
    `"new Float32Array(1024)"`,
  )
  expect(
    srcify(new Float32Array([1, -2, 3.140_000_104_904_175, 4])),
  ).toMatchInlineSnapshot(`"new Float32Array([1,-2,3.140000104904175,4])"`)

  // Float64Arrays
  expect(srcify(new Float64Array())).toMatchInlineSnapshot(
    `"new Float64Array()"`,
  )
  expect(srcify(new Float64Array(1024))).toMatchInlineSnapshot(
    `"new Float64Array(1024)"`,
  )
  expect(srcify(new Float64Array([1, -2, 3.14, 4]))).toMatchInlineSnapshot(
    `"new Float64Array([1,-2,3.14,4])"`,
  )

  // BigInt64Arrays
  expect(srcify(new BigInt64Array())).toMatchInlineSnapshot(
    `"new BigInt64Array()"`,
  )
  expect(srcify(new BigInt64Array(1024))).toMatchInlineSnapshot(
    `"new BigInt64Array(1024)"`,
  )
  expect(srcify(new BigInt64Array([1n, -2n, 3n, 4n]))).toMatchInlineSnapshot(
    `"new BigInt64Array([1n,-2n,3n,4n])"`,
  )

  // BigUint64Arrays
  expect(srcify(new BigUint64Array())).toMatchInlineSnapshot(
    `"new BigUint64Array()"`,
  )
  expect(srcify(new BigUint64Array(1024))).toMatchInlineSnapshot(
    `"new BigUint64Array(1024)"`,
  )
  expect(srcify(new BigUint64Array([1n, 2n, 3n, 4n]))).toMatchInlineSnapshot(
    `"new BigUint64Array([1n,2n,3n,4n])"`,
  )

  // Shared
  const object = {}
  expect(srcify({ a: object, b: object })).toMatchInlineSnapshot(
    `"((a={})=>({a,b:a}))()"`,
  )
  const objects = Array.from({ length: 100 }, () => ({}))
  expect(srcify([...objects, ...objects])).toMatchInlineSnapshot(
    `"((a={},b={},c={},d={},e={},f={},g={},h={},i={},j={},k={},l={},m={},n={},o={},p={},q={},r={},s={},t={},u={},v={},w={},x={},y={},z={},A={},B={},C={},D={},E={},F={},G={},H={},I={},J={},K={},L={},M={},N={},O={},P={},Q={},R={},S={},T={},U={},V={},W={},X={},Y={},Z={},$aa={},$ab={},$ac={},$ad={},$ae={},$af={},$ag={},$ah={},$ai={},$aj={},$ak={},$al={},$am={},$an={},$ao={},$ap={},$aq={},$ar={},$as={},$at={},$au={},$av={},$aw={},$ax={},$ay={},$az={},$aA={},$aB={},$aC={},$aD={},$aE={},$aF={},$aG={},$aH={},$aI={},$aJ={},$aK={},$aL={},$aM={},$aN={},$aO={},$aP={},$aQ={},$aR={},$aS={},$aT={},$aU={},$aV={})=>[a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z,A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z,$aa,$ab,$ac,$ad,$ae,$af,$ag,$ah,$ai,$aj,$ak,$al,$am,$an,$ao,$ap,$aq,$ar,$as,$at,$au,$av,$aw,$ax,$ay,$az,$aA,$aB,$aC,$aD,$aE,$aF,$aG,$aH,$aI,$aJ,$aK,$aL,$aM,$aN,$aO,$aP,$aQ,$aR,$aS,$aT,$aU,$aV,a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z,A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z,$aa,$ab,$ac,$ad,$ae,$af,$ag,$ah,$ai,$aj,$ak,$al,$am,$an,$ao,$ap,$aq,$ar,$as,$at,$au,$av,$aw,$ax,$ay,$az,$aA,$aB,$aC,$aD,$aE,$aF,$aG,$aH,$aI,$aJ,$aK,$aL,$aM,$aN,$aO,$aP,$aQ,$aR,$aS,$aT,$aU,$aV])()"`,
  )

  // Circular
  const circular: { ref?: unknown } = {}
  circular.ref = circular
  expect(srcify(circular)).toMatchInlineSnapshot(`"((a={})=>a.ref=a)()"`)
  expect(srcify({ circular })).toMatchInlineSnapshot(
    `"((a={})=>(a.ref=a,{circular:a}))()"`,
  )
  expect(srcify({ a: circular })).toMatchInlineSnapshot(
    `"((a={})=>(a.ref=a,{a}))()"`,
  )
  const circular1: { ref?: unknown } = {}
  const circular2 = { ref: circular1 }
  circular1.ref = circular2
  expect(srcify(circular1)).toMatchInlineSnapshot(
    `"((a={ref:{}})=>a.ref.ref=a)()"`,
  )
  expect(srcify(circular2)).toMatchInlineSnapshot(
    `"((a={ref:{}})=>a.ref.ref=a)()"`,
  )
  expect(srcify({ circular: circular1 })).toMatchInlineSnapshot(
    `"((a={ref:{}})=>(a.ref.ref=a,{circular:a}))()"`,
  )
  expect(srcify({ a: circular1, b: circular2 })).toMatchInlineSnapshot(
    `"((b={},a={ref:b})=>(b.ref=a,{a,b}))()"`,
  )
  const circularArray: unknown[] = []
  circularArray.push(circularArray)
  expect(srcify(circularArray)).toMatchInlineSnapshot(`"((a=[])=>a[0]=a)()"`)
  const circularWithStringKey: { 'a b c'?: unknown } = {}
  circularWithStringKey[`a b c`] = circularWithStringKey
  expect(srcify(circularWithStringKey)).toMatchInlineSnapshot(
    `"((a={})=>a["a b c"]=a)()"`,
  )
  const circularArrayInner: unknown[] = []
  const circularArrayOuter: unknown[] = []
  circularArrayInner.push(circularArrayOuter, circularArrayInner)
  circularArrayOuter.push(circularArrayInner)
  expect(srcify(circularArrayOuter)).toMatchInlineSnapshot(
    `"((b=[,],a=[b])=>(b[0]=a,b[1]=b,a))()"`,
  )
  const circularOwnProto = {}
  Object.defineProperty(circularOwnProto, `__proto__`, {
    value: circularOwnProto,
    configurable: true,
    enumerable: true,
    writable: true,
  })
  expect(srcify(circularOwnProto)).toMatchInlineSnapshot(
    `"((a={})=>(Object.defineProperty(a,"__proto__",{value:a,writable:true,enumerable:true,configurable:true}),a))()"`,
  )
  const circularProto1 = {}
  const circularProto2 = { ref: circularProto1 }
  Object.setPrototypeOf(circularProto1, circularProto2)
  expect(srcify(circularProto1)).toMatchInlineSnapshot(
    `"((a=Object.setPrototypeOf({},{}))=>Object.getPrototypeOf(a).ref=a)()"`,
  )
  const circularMap = new Map()
  circularMap.set(`hi`, circularMap)
  expect(srcify(circularMap)).toMatchInlineSnapshot(
    `"((a=new Map([["hi"]]))=>(a.set("hi",a),a))()"`,
  )
  circularMap.set(`hello`, { circularMap })
  expect(srcify(circularMap)).toMatchInlineSnapshot(
    `"((a=new Map([["hi"],["hello",{}]]))=>(a.set("hi",a),a.get("hello").circularMap=a))()"`,
  )
  const circularMap2 = new Map()
  circularMap2.set(circularMap2, `howdy`)
  expect(srcify(circularMap2)).toMatchInlineSnapshot(
    `"((a=new Map())=>(a.set(a,"howdy"),a))()"`,
  )
  const circularMap3 = new Map()
  circularMap3.set({ '': circularMap3 }, circularMap3)
  expect(srcify(circularMap3)).toMatchInlineSnapshot(
    `"((b={},a=new Map([[b]]))=>(b[""]=a,a.set(b,a),a))()"`,
  )
  const circularMap4 = new Map()
  circularMap4.set({}, { '': new Map([[circularMap4, new Map()]]) })
  expect(srcify(circularMap4)).toMatchInlineSnapshot(
    `"((b={},a=new Map([[b,{"":new Map()}]]))=>(a.get(b)[""].set(a,new Map()),a))()"`,
  )
  const arrayKey: unknown[] = []
  const circularMap5 = new Map([[arrayKey, {}]])
  arrayKey.push(circularMap5)
  expect(srcify(circularMap5)).toMatchInlineSnapshot(
    `"((b=[],a=new Map([[b,{}]]))=>b[0]=a)()"`,
  )

  // Unsupported
  expect(() =>
    srcify(Symbol(`Hello World!`)),
  ).toThrowErrorMatchingInlineSnapshot(`[TypeError: Unsupported: symbol]`)
  expect(() => srcify(() => {})).toThrowErrorMatchingInlineSnapshot(
    `[TypeError: Unsupported: function]`,
  )
})
