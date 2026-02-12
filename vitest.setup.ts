import type { Tester } from '@vitest/expect'
import * as matchers from 'jest-extended'
import { expect } from 'vitest'

expect.extend(matchers)

function strictPlainObjectEqualityTester(
  this: ThisParameterType<Tester>,
  a: unknown,
  b: unknown,
): boolean | undefined {
  if (!isPlainObject(a) || !isPlainObject(b)) {
    return undefined
  }

  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) {
    return false
  }

  const keysA = Reflect.ownKeys(a)
  const keysB = Reflect.ownKeys(b)
  if (keysA.length !== keysB.length) {
    return false
  }

  for (const key of keysA) {
    const descriptorA = Object.getOwnPropertyDescriptor(a, key)!
    const descriptorB = Object.getOwnPropertyDescriptor(b, key)
    if (!descriptorB) {
      return false
    }

    for (const key of DESCRIPTOR_KEYS) {
      if (key in descriptorA !== key in descriptorB) {
        return false
      }

      if (!this.equals(descriptorA[key], descriptorB[key])) {
        return false
      }
    }
  }

  return true
}

const isPlainObject = (value: unknown): value is object => {
  if (typeof value !== `object` || value === null) {
    return false
  }
  const prototype = Object.getPrototypeOf(value) as unknown
  return prototype === Object.prototype || prototype === null
}

const DESCRIPTOR_KEYS = [
  `configurable`,
  `enumerable`,
  `writable`,
  `value`,
  `get`,
  `set`,
] as const

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
  strictPlainObjectEqualityTester,
  strictArrayBufferEqualityTester,
  strictTypedArrayEqualityTester,
  strictBufferEqualityTester,
])
