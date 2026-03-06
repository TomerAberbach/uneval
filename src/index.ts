// For smaller bundle size.
/* eslint-disable eqeqeq */

import type { TypedArray } from './internal/buffer.ts'
import { generateIdentifier } from './internal/identifier.ts'
import { unevalInternal } from './internal/index.ts'
import { isDefaultObjectPrototype, isObject } from './internal/object.ts'
import {
  ALL_TYPES,
  getType,
  T_ARRAY,
  T_ARRAY_BUFFER,
  T_BUFFER,
  T_MAP,
  T_PRIMITIVE_WRAPPER,
  T_SET,
  T_TYPED_ARRAY,
} from './internal/type.ts'
import type { Binding, State } from './internal/types.ts'

/** Options for {@link uneval}. */
export type UnevalOptions = {
  /**
   * A custom function for unevaling values.
   *
   * Return the following types depending on the desired behavior:
   * - `string` to provide a custom uneval result for {@link value}
   * - `null` to omit {@link value} from the output (e.g. in arrays, objects,
   *   Sets, Maps). Omitting the root value throws an `Error`.
   * - `undefined` (or don't return anything, which is equivalent) to use the
   *   default behavior for {@link value}
   *
   * It can be used to uneval already supported values differently or to uneval
   * unsupported values such as functions.
   *
   * The {@link uneval} param is the same uneval function these options were
   * passed to. You may use it to delegate back to uneval for sub-objects.
   */
  custom?: (
    value: unknown,
    uneval: (value: unknown) => string,
  ) => string | null | undefined
}

// TODO(#51): Support arbitrary properties on random types (e.g. Arrays, etc.)
/**
 * Converts the given {@link value} to JavaScript source code.
 *
 * @example
 * ```js
 * import assert from 'node:assert'
 * import uneval from '@tomer/uneval'
 *
 * const object = { message: `hello world` }
 *
 * const source = uneval(object)
 * console.log(source)
 * //=> {message:"hello world"}
 *
 * const roundtrippedObject = (0, eval)(`(${source})`)
 * assert.deepEqual(roundtrippedObject, object)
 *
 * const circularObject = {}
 * circularObject.self = circularObject
 *
 * const circularSource = uneval(circularObject)
 * console.log(circularSource)
 * //=> (a=>a.self=a)({})
 *
 * const roundtrippedCircularObject = (0, eval)(`(${circularSource})`)
 * assert.deepEqual(roundtrippedCircularObject, circularObject)
 * ```
 */
const uneval = (value: unknown, { custom }: UnevalOptions = {}): string => {
  const state = createState(value, custom)
  const result = unevalInternal(value, state)
  if (result === undefined) {
    throw new Error(`Root omitted`)
  }

  if (!state._bindings.size) {
    // If no bindings were created, then it's impossible for the returned source
    // to reference one, so it must be a string.
    return result!
  }

  const bodySources = state._mutations.map(result => result._source)
  const returnBinding = state._bindings.get(
    // The value must be an object if we ended up needing to create bindings for
    // it. A primitive value would always result in fully inline source above.
    value as object,
  )
  if (!returnBinding) {
    // The value the returned source evaluates to doesn't have a binding, so we
    // add its source inline at the end of the body expression to return it.
    bodySources.push(
      // Guaranteed to be non-null because that only happens when it's circular,
      // which it can't be if it has no binding.
      result!,
    )
  } else if (state._mutations.at(-1)?._evaluatesTo != returnBinding._name) {
    // The value the returned source evaluates to does have a binding, but the
    // last mutation in the body does not evaluate to it, so we have to add a
    // reference to the value's binding at the end of the body expression to
    // return it.
    bodySources.push(returnBinding._name)
  }

  let bodySource = bodySources.join()
  // eslint-disable-next-line @typescript-eslint/prefer-string-starts-ends-with
  if (bodySources.length > 1 || bodySource[0] == `{`) {
    // If the body is a comma expression, then it requires a parentheses to be a
    // syntactically correct expression return. If the body is an object, then
    // it also needs parentheses so that it isn't interpreted as a block.
    bodySource = `(${bodySource})`
  }

  // We use an IIFE's lambda parameters to declare bindings because it's fewer
  // bytes than using `var` or `let`. We place the binding values in the call
  // arguments for the leading bindings that don't have dependencies and place
  // in the default parameter values for the rest. This is because default
  // parameter values require more bytes than call arguments (due to the `=`).
  const parameterSources: string[] = []
  const argSources: string[] = []
  let hasDependency: boolean | undefined
  for (const binding of state._bindingOrder) {
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    hasDependency ||= binding._hasDependency
    if (hasDependency) {
      parameterSources.push(`${binding._name}=${binding._source}`)
    } else {
      parameterSources.push(binding._name)
      argSources.push(binding._source!)
    }
  }

  const parametersSource = parameterSources.join()
  return `(${
    parameterSources.length > 1 ? `(${parametersSource})` : parametersSource
  }=>${bodySource})(${argSources.join()})`
}

const createState = (
  value: unknown,
  custom: UnevalOptions[`custom`],
): State => {
  const bindings = new Map<object, Binding>()
  const customSources = new Map<unknown, string | null>()

  const ensureBinding = (value: object) => {
    if (!bindings.has(value)) {
      bindings.set(value, {
        _name: generateIdentifier(bindings.size),
      })
    }
  }

  // Values seen at any point during traversal. Used to detect circular and
  // shared references.
  const SOMEWHERE = 1
  const PARENT = 2
  const seenLocation = new Map<object, typeof SOMEWHERE | typeof PARENT>()

  const traverse = (value: unknown, parent?: object) => {
    if (custom) {
      let source = customSources.get(value)
      if (source === undefined) {
        source = custom(value, value => uneval(value, { custom }))
        if (source !== undefined) {
          customSources.set(value, source)
        }
      }
      if (source === null) {
        return
      }
    }

    if (!value || typeof value != `object`) {
      // Note that we purposefully do not traverse functions here because we
      // don't support them natively.
      return
    }

    const location = seenLocation.get(value)
    if (location) {
      // If a object value is used more than once, then it needs a binding for
      // the shared reference.
      ensureBinding(value)

      if (location == PARENT) {
        // If this value is referenced circularly, then we'll need a binding for
        // its parent so that we can mutate it later to attach the circular
        // reference.
        ensureBinding(parent!)
      }
      return
    }

    seenLocation.set(value, PARENT)
    traverseObject(value)
    seenLocation.set(value, SOMEWHERE)
  }

  const traverseObject = (value: object) => {
    const [type] = getType(value)
    if (!ALL_TYPES.has(type)) {
      for (const key of Reflect.ownKeys(value)) {
        if (typeof key == `symbol`) {
          traverse(key)
        }
        const descriptor = Object.getOwnPropertyDescriptor(value, key)!
        traverse(descriptor.value as unknown, value)
        // eslint-disable-next-line @typescript-eslint/unbound-method
        traverse(descriptor.get, value)
        // eslint-disable-next-line @typescript-eslint/unbound-method
        traverse(descriptor.set, value)
      }

      const prototype = Object.getPrototypeOf(value) as unknown
      if (!isDefaultObjectPrototype(prototype)) {
        // We only render the prototype if it's not equal the default one in
        // this realm.
        traverse(prototype, value)
      }
    } else if (type == T_PRIMITIVE_WRAPPER) {
      // Traverse the underlying unboxed value to apply `custom` to it.
      const underlyingValue = value.valueOf()
      traverse(underlyingValue)
      if (customSources.get(underlyingValue) === null) {
        customSources.set(value, null)
      }
    } else if (type == T_ARRAY) {
      // Use `Object.keys` to avoid iterating empty slots, which are no-ops for
      // traversal, and to safely handle huge sparse arrays without DoS.
      for (const key of Object.keys(value)) {
        traverse((value as Record<string, unknown>)[key], value)
      }
    } else if (type == T_SET) {
      for (const item of value as Set<unknown>) {
        traverse(item, value)
      }
    } else if (type == T_MAP) {
      for (const [key, item] of value as Map<unknown, unknown>) {
        traverse(key, value)
        traverse(item, value)

        if (
          seenLocation.get(
            // Not guaranteed to be an object, but that doesn't matter because
            // it's just a lookup, and this saves bytes.
            item as object,
          ) == PARENT &&
          isObject(key)
        ) {
          // If the item is circular and the key is an object, then the key
          // also needs a binding so we can reference it in mutations.
          ensureBinding(key)
        }
      }
    } else if (type == T_ARRAY_BUFFER) {
      // TODO(#42): Support TypedArrays containing detached ArrayBuffers.
      const arrayBuffer = value as ArrayBuffer
      if (
        // If the `ArrayBuffer` is detached, then we need a binding to call
        // `.transfer()` on.
        arrayBuffer.detached ||
        // If the `ArrayBuffer` is resizable and has non-zero values, then
        // we'll have to construct it, put it in a binding, then `.set(...)`
        // it.
        (arrayBuffer.resizable &&
          new Uint8Array(arrayBuffer).some(value => value != 0))
      ) {
        ensureBinding(value)
      }
    } else if (type == T_BUFFER || type == T_TYPED_ARRAY) {
      const { buffer } = value as Buffer | TypedArray
      traverse(buffer, value)
      if (customSources.get(buffer) === null) {
        customSources.set(value, null)
      }
    }
  }

  traverse(value)

  return {
    _bindings: bindings,
    _customSources: customSources,
    _currentParents: new Set(),
    _bindingOrder: [],
    _mutations: [],
  }
}

export default uneval
