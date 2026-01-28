import * as matchers from 'jest-extended'
import { expect } from 'vitest'

expect.extend(matchers)

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer
const strictArrayBufferEqualityTester = (
  a: unknown,
  b: unknown,
): boolean | undefined => {
  const isArrayBufferA = a instanceof ArrayBuffer
  const isArrayBufferB = b instanceof ArrayBuffer

  if (!isArrayBufferA || !isArrayBufferB) {
    // Defer to other equality testers.
    return undefined
  }

  if (a.byteLength !== b.byteLength) {
    throw new Error(
      `ArrayBuffer byteLength mismatch: expected ${a.byteLength}, got ${b.byteLength}`,
    )
  }

  if (a.maxByteLength !== b.maxByteLength) {
    throw new Error(
      `ArrayBuffer maxByteLength mismatch: expected ${a.maxByteLength}, got ${b.maxByteLength}`,
    )
  }

  if (a.resizable !== b.resizable) {
    throw new Error(
      `ArrayBuffer resizable mismatch: expected ${a.resizable}, got ${b.resizable}`,
    )
  }

  if (a.detached !== b.detached) {
    throw new Error(
      `ArrayBuffer detached mismatch: expected ${a.detached}, got ${b.detached}`,
    )
  }

  if (a.detached) {
    return true
  }

  const viewA = new Uint8Array(a)
  const viewB = new Uint8Array(b)
  for (let i = 0; i < viewA.length; i++) {
    if (viewA[i] !== viewB[i]) {
      throw new Error(
        `ArrayBuffer byte mismatch at index ${i}: expected ${viewA[i]}, got ${viewB[i]}`,
      )
    }
  }

  return true
}

expect.addEqualityTesters([strictArrayBufferEqualityTester])
