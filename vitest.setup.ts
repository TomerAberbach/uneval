import * as matchers from 'jest-extended'
import { expect } from 'vitest'

expect.extend(matchers)

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer
const strictArrayBufferEqualityTester = (
  a: unknown,
  b: unknown,
): boolean | undefined => {
  if (!(a instanceof ArrayBuffer) || !(b instanceof ArrayBuffer)) {
    // Defer to other equality testers.
    return undefined
  }

  if (
    a.byteLength !== b.byteLength ||
    a.maxByteLength !== b.maxByteLength ||
    a.resizable !== b.resizable ||
    a.detached !== b.detached
  ) {
    return false
  }

  if (a.detached) {
    return true
  }

  const viewA = new Uint8Array(a)
  const viewB = new Uint8Array(b)
  for (let i = 0; i < viewA.length; i++) {
    if (viewA[i] !== viewB[i]) {
      return false
    }
  }

  return true
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray
const strictTypedArrayEqualityTester = (
  a: unknown,
  b: unknown,
): boolean | undefined => {
  if (!(a instanceof TypedArray) || !(b instanceof TypedArray)) {
    // Defer to other equality testers.
    return undefined
  }

  if (
    a.constructor !== b.constructor ||
    a.length !== b.length ||
    a.byteLength !== b.byteLength ||
    a.byteOffset !== b.byteOffset
  ) {
    return false
  }

  return strictArrayBufferEqualityTester(a.buffer, b.buffer)
}

// https://nodejs.org/api/buffer.html
const strictBufferEqualityTester = (
  a: unknown,
  b: unknown,
): boolean | undefined => {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    // Defer to other equality testers.
    return undefined
  }

  if (
    a.length !== b.length ||
    a.byteLength !== b.byteLength ||
    a.byteOffset !== b.byteOffset
  ) {
    return false
  }

  if (strictArrayBufferEqualityTester(a.buffer, b.buffer) === false) {
    return false
  }

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false
    }
  }

  return true
}

const TypedArray = Object.getPrototypeOf(Int8Array) as
  | typeof Int8Array
  | typeof Uint8Array
  | typeof Uint8ClampedArray
  | typeof Int16Array
  | typeof Uint16Array
  | typeof Int32Array
  | typeof Uint32Array
  | typeof Float16Array
  | typeof Float32Array
  | typeof Float64Array
  | typeof BigInt64Array
  | typeof BigUint64Array

expect.addEqualityTesters([
  strictArrayBufferEqualityTester,
  strictTypedArrayEqualityTester,
  strictBufferEqualityTester,
])
