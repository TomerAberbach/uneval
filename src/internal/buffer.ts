// For smaller bundle size.
/* eslint-disable unicorn/prefer-number-properties */
/* eslint-disable eqeqeq */

import { bindingName, newInstance } from './common.ts'
import { unevalInternal, unevalWithoutCustom } from './index.ts'
import type { State, Uneval } from './types.ts'

export type TypedArray =
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float16Array
  | Float32Array
  | Float64Array
  | BigInt64Array
  | BigUint64Array

export const unevalTypedArray = (
  typedArray: TypedArray,
  state: State,
  name: string,
): string => {
  const arrayBuffer = typedArray.buffer as ArrayBuffer
  if (arrayBuffer.detached) {
    state._mutations.push({
      _source: `${bindingName(typedArray, state)}.buffer.transfer()`,
    })
    return newInstance(name)
  }

  // eslint-disable-next-line @typescript-eslint/prefer-string-starts-ends-with
  const isFloatingPoint = name[0] == `F`
  const hasNonCanonicalNaN =
    isFloatingPoint &&
    [...(typedArray as Float16Array | Float32Array | Float64Array)].some(
      isNonCanonicalNaN,
    )
  if (
    // We have to construct from a buffer if the end-user provided custom source
    // for it.
    state._customSources.has(arrayBuffer) ||
    // We have to construct from a buffer if it has a binding, meaning that it's
    // shared between multiple values.
    state._bindings.has(arrayBuffer) ||
    // Also, if the byte lengths differ between the typed array and the buffer,
    // then that means this typed array is a view of a slice of a buffer. The
    // only way to achieve that is by constructing from a buffer.
    typedArray.byteLength != arrayBuffer.byteLength ||
    // Lastly, if the underlying buffer is resizable, then we must also
    // construct from a buffer. The default buffer created from
    // `new TypedArray(...)` is not resizable.
    arrayBuffer.resizable ||
    // For floating-point arrays with non-canonical NaN values, we must
    // construct from the buffer to preserve the exact NaN bit pattern.
    hasNonCanonicalNaN
  ) {
    return newInstance(name, unevalBufferWrapperArgs(typedArray, state))
  }

  // eslint-disable-next-line @typescript-eslint/prefer-string-starts-ends-with
  const zero = name[0] == `B` ? 0n : 0
  if (typedArray.some(value => !Object.is(value, zero))) {
    return `${name}.of(${Array.from<number | bigint, string>(
      typedArray,
      value => unevalWithoutCustom(value, state),
    ).join()})`
  }

  return newInstance(name, typedArray.length || ``)
}

const isNonCanonicalNaN = (value: number): boolean => {
  if (!isNaN(value)) {
    return false
  }

  float64ScratchView.setFloat64(0, value)
  return float64ScratchView.getBigUint64(0) != CANONICAL_NAN_BITS
}

const float64ScratchView = new DataView(new ArrayBuffer(8))
float64ScratchView.setFloat64(0, NaN)
const CANONICAL_NAN_BITS = float64ScratchView.getBigUint64(0)

export const unevalBuffer: Uneval<Buffer> = (buffer, state, name) => {
  const arrayBuffer = buffer.buffer as ArrayBuffer
  if (
    !buffer.byteOffset &&
    !buffer.byteLength &&
    !arrayBuffer.byteLength &&
    !arrayBuffer.resizable &&
    !arrayBuffer.detached
  ) {
    return `${name}.alloc(0)`
  }

  return `${name}.from(${unevalBufferWrapperArgs(buffer, state)})`
}

const unevalBufferWrapperArgs = (
  {
    byteOffset,
    byteLength,
    buffer,
    BYTES_PER_ELEMENT,
  }: {
    byteOffset: number
    byteLength: number
    buffer: ArrayBufferLike
    BYTES_PER_ELEMENT: number
  },
  state: State,
): string =>
  `${unevalInternal(buffer, state)!}${
    byteOffset + byteLength == buffer.byteLength
      ? byteOffset > 0
        ? `,${byteOffset}`
        : ``
      : `,${+byteOffset},${byteLength / BYTES_PER_ELEMENT}`
  }`

export const unevalArrayBuffer: Uneval<ArrayBuffer> = (
  arrayBuffer,
  state,
  name,
) => {
  const { detached, resizable, byteLength, maxByteLength } = arrayBuffer

  if (detached) {
    state._mutations.push({
      _source: `${bindingName(arrayBuffer, state)}.transfer()`,
    })
  }

  let uint8Array: Uint8Array
  let firstNonZeroIndex: number
  if (
    byteLength == 0 ||
    (firstNonZeroIndex = (uint8Array = new Uint8Array(
      arrayBuffer.slice(),
    )).findIndex(value => value != 0)) == -1
  ) {
    return newInstance(
      name,
      resizable
        ? `${+byteLength},{maxByteLength:${+maxByteLength}}`
        : byteLength > 0
          ? byteLength
          : ``,
    )
  }

  if (!resizable) {
    return `${unevalWithoutCustom(uint8Array, state)}.buffer`
  }

  const lastNonZeroIndex = uint8Array.findLastIndex(value => value != 0)
  state._mutations.push({
    _source: `new Uint8Array(${bindingName(arrayBuffer, state)}).set([${
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      uint8Array.slice(firstNonZeroIndex, lastNonZeroIndex + 1)
    }]${firstNonZeroIndex > 0 ? `,${firstNonZeroIndex}` : ``})`,
  })
  return newInstance(name, `${+byteLength},{maxByteLength:${+maxByteLength}}`)
}
