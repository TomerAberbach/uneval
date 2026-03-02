import { Temporal as TemporalPolyfill } from '@js-temporal/polyfill'
import type { Tester } from '@vitest/expect'
import * as matchers from 'jest-extended'
import { expect } from 'vitest'

globalThis.Temporal = TemporalPolyfill

expect.extend(matchers)

function strictPlainObjectEqualityTester(
  this: ThisParameterType<Tester>,
  value1: unknown,
  value2: unknown,
): boolean | undefined {
  if (!isPlainObject(value1) || !isPlainObject(value2)) {
    return undefined
  }

  if (Object.getPrototypeOf(value1) !== Object.getPrototypeOf(value2)) {
    return false
  }

  const keysA = Reflect.ownKeys(value1)
  const keysB = Reflect.ownKeys(value2)
  if (keysA.length !== keysB.length) {
    return false
  }

  for (let i = 0; i < keysA.length; i++) {
    if (keysA[i] !== keysB[i]) {
      return false
    }

    const descriptorA = Object.getOwnPropertyDescriptor(value1, keysA[i]!)!
    const descriptorB = Object.getOwnPropertyDescriptor(value2, keysB[i]!)!

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

function strictSetEqualityTester(
  this: ThisParameterType<Tester>,
  value1: unknown,
  value2: unknown,
): boolean | undefined {
  if (!(value1 instanceof Set) || !(value2 instanceof Set)) {
    return undefined
  }

  return this.equals([...value1], [...value2])
}

function strictMapEqualityTester(
  this: ThisParameterType<Tester>,
  value1: unknown,
  value2: unknown,
): boolean | undefined {
  if (!(value1 instanceof Map) || !(value2 instanceof Map)) {
    return undefined
  }

  return this.equals([...value1], [...value2])
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
  value1: unknown,
  value2: unknown,
): boolean | undefined => {
  if (!(value1 instanceof ArrayBuffer) || !(value2 instanceof ArrayBuffer)) {
    // Defer to other equality testers.
    return undefined
  }

  if (
    value1.byteLength !== value2.byteLength ||
    value1.maxByteLength !== value2.maxByteLength ||
    value1.resizable !== value2.resizable ||
    value1.detached !== value2.detached
  ) {
    return false
  }

  if (value1.detached) {
    return true
  }

  const viewA = new Uint8Array(value1)
  const viewB = new Uint8Array(value2)
  for (let i = 0; i < viewA.length; i++) {
    if (viewA[i] !== viewB[i]) {
      return false
    }
  }

  return true
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray
const strictTypedArrayEqualityTester = (
  value1: unknown,
  value2: unknown,
): boolean | undefined => {
  if (!(value1 instanceof TypedArray) || !(value2 instanceof TypedArray)) {
    // Defer to other equality testers.
    return undefined
  }

  if (
    value1.constructor !== value2.constructor ||
    value1.length !== value2.length ||
    value1.byteLength !== value2.byteLength ||
    value1.byteOffset !== value2.byteOffset
  ) {
    return false
  }

  return strictArrayBufferEqualityTester(value1.buffer, value2.buffer)
}

// https://nodejs.org/api/buffer.html
const strictBufferEqualityTester = (
  value1: unknown,
  value2: unknown,
): boolean | undefined => {
  if (!Buffer.isBuffer(value1) || !Buffer.isBuffer(value2)) {
    // Defer to other equality testers.
    return undefined
  }

  if (
    value1.length !== value2.length ||
    value1.byteLength !== value2.byteLength ||
    value1.byteOffset !== value2.byteOffset
  ) {
    return false
  }

  if (strictArrayBufferEqualityTester(value1.buffer, value2.buffer) === false) {
    return false
  }

  for (let i = 0; i < value1.length; i++) {
    if (value1[i] !== value2[i]) {
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
  strictSetEqualityTester,
  strictMapEqualityTester,
  strictArrayBufferEqualityTester,
  strictTypedArrayEqualityTester,
  strictBufferEqualityTester,
])
