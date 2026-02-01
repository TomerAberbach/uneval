/* eslint-disable eqeqeq */ // For smaller bundle size.

import { generateIdentifier } from './identifier.ts'

/** An identifier with an assigned value. */
type Binding = {
  /** The name of the binding. */
  _name: string
  /** The value of the binding as a source string. */
  _source?: string
  /**
   * The binding values this binding depends on, corresponding to keys in
   * {@link State._bindings}.
   */
  _dependencies: Set<object>
}

const SET_OBJECT_STRING_PROPERTY = 0
const SET_OBJECT_SYMBOL_PROPERTY = 1
const SET_ARRAY_INDEX = 2
const SET_MAP_ENTRY = 3
const ADD_TO_SET = 4
const TRANSFER_ARRAY_BUFFER = 5
const SET_ARRAY_BUFFER = 6

/** An mutation of a binding. */
type Mutation = {
  /** The value being mutated. The value is assumed to have a binding. */
  _target: object
  /**
   * The source or value with a binding that's the "input" to the mutation, or
   * undefined if there is not input for the mutation.
   */
  _input?: string | object
} & (
  | { _type: typeof SET_OBJECT_STRING_PROPERTY; _property: string }
  | { _type: typeof SET_OBJECT_SYMBOL_PROPERTY; _property: string }
  | { _type: typeof SET_ARRAY_INDEX; _index: number }
  | { _type: typeof SET_MAP_ENTRY; _key: string }
  | { _type: typeof ADD_TO_SET }
  | { _type: typeof TRANSFER_ARRAY_BUFFER }
  | { _type: typeof SET_ARRAY_BUFFER }
)

/** State maintained while converting a value to source. */
type State = {
  /**
   * Parents objects that have already been visited above the current object
   * tree being traversed.
   *
   * Used to detect circular references.
   */
  _currentParents: Set<object>

  /**
   * The current binding being rendered, or `undefined` if an inline value is
   * being rendered (e.g. directly returned).
   */
  _currentBinding?: Binding

  /**
   * A map from object to the binding where it should be stored.
   *
   * Bindings are used to share objects that are referenced multiple times or to
   * create circular references in conjunction with {@link State._mutations}.
   */
  _bindings: Map<object, Binding>

  /** A list of mutations of bindings. */
  _mutations: Mutation[]
}

// TODO(#16): Support custom srcify handlers.
// TODO(#17): Support ignoring unsupported things (like functions and symbols).
/**
 * Converts the given {@link value} to JavaScript source code.
 *
 * @example
 * ```js
 * import assert from 'node:assert'
 * import srcify from 'srcify'
 *
 * const object = { message: `hello world` }
 *
 * const source = srcify(object)
 * console.log(source)
 * //=> {message:"hello world"}
 *
 * const roundtrippedObject = (0, eval)(`(${source})`)
 * assert.deepEqual(roundtrippedObject, object)
 * ```
 */
const srcify = (value: unknown): string => {
  const state: State = {
    _currentParents: new Set(),
    _bindings: createBindings(value),
    _mutations: [],
  }
  const result = srcifyInternal(value, state)

  if (!state._bindings.size) {
    // If no bindings were created, then it's impossible for the returned source
    // to reference one, so it must be a string.
    return result!
  }

  const parametersSource = Array.from(
    topologicallySortBindings(state._bindings),
    binding => `${binding._name}=${binding._source}`,
  ).join(`,`)

  const bodyResults = state._mutations.map(mutation =>
    srcifyMutation(mutation, state),
  )
  const bodySources = bodyResults.map(result => result._source)

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
  } else if (bodyResults.at(-1)?._evaluatesTo != returnBinding._name) {
    // The value the returned source evaluates to does have a binding, but the
    // last mutation in the body does not evaluate to it, so we have to add a
    // reference to the value's binding at the end of the body expression to
    // return it.
    bodySources.push(returnBinding._name)
  }

  let bodySource = bodySources.join(`,`)
  if (bodySources.length > 1 || bodySource.startsWith(`{`)) {
    // If the body is a comma expression, then it requires a parentheses to be a
    // syntactically correct expression return. If the body is an object, then
    // it also needs parentheses so that it isn't interpreted as a block.
    bodySource = `(${bodySource})`
  }

  return `((${parametersSource})=>${bodySource})()`
}

const createBindings = (value: unknown): Map<object, Binding> => {
  const bindings = new Map<object, Binding>()
  const ensureBinding = (value: object) => {
    if (!bindings.has(value)) {
      bindings.set(value, {
        _name: generateIdentifier(bindings.size),
        _dependencies: new Set(),
      })
    }
  }

  // Values seen at any point during traversal. Used to detect shared references.
  const seen = new Set<object>()
  // Values seen above the current value during traversal. Used to detect
  // circular references. This is always a subset of `seen`.
  const parents = new Set<object>()

  const traverse = (value: unknown, parent?: object) => {
    if (!value || typeof value != `object`) {
      return
    }

    if (seen.has(value)) {
      // If a object value is used more than once, then it needs a binding for
      // the shared reference.
      ensureBinding(value)

      if (parents.has(value)) {
        // If this value is referenced circularly, then we'll need a binding for
        // its parent so that we can mutate it later to attach the circular
        // reference.
        ensureBinding(parent!)
      }
      return
    }

    seen.add(value)
    parents.add(value)
    traverseObject(value)
    parents.delete(value)
  }

  const traverseObject = (value: object) => {
    switch (getType(value)) {
      case `Array`:
      case `Set`:
        for (const item of value as Iterable<unknown>) {
          traverse(item, value)
        }
        break
      case `Map`:
        for (const [key, item] of value as Map<unknown, unknown>) {
          traverse(key, value)
          traverse(item, value)

          if (
            parents.has(
              // Not guaranteed to be an object, but that doesn't matter because
              // it's just a lookup, and this saves bytes.
              item as object,
            ) &&
            key &&
            typeof key == `object`
          ) {
            // If the item is circular and the key is an object, then the key
            // also needs a binding so we can reference it in mutations.
            ensureBinding(key)
          }
        }
        break
      case `ArrayBuffer`: {
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
        break
      }
      // TODO(#13): Support Node `Buffer`
      case `Boolean`:
      case `Number`:
      case `String`:
      case `Date`:
      case `URL`:
      case `RegExp`:
      case `URLSearchParams`:
      case `Int8Array`:
      case `Uint8Array`:
      case `Uint8ClampedArray`:
      case `Int16Array`:
      case `Uint16Array`:
      case `Int32Array`:
      case `Uint32Array`:
      case `Float16Array`:
      case `Float32Array`:
      case `Float64Array`:
      case `BigInt64Array`:
      case `BigUint64Array`:
        break
      default: {
        // TODO(#9): Support all property types, including non-enumerable ones.
        for (const key of Reflect.ownKeys(value)) {
          traverse(Reflect.get(value, key), value)
        }

        const prototype = Object.getPrototypeOf(value) as unknown
        // TODO(#31): Check if an object is a plain object based on properties
        // on the prototype.
        if (prototype != Object.prototype) {
          // We only render the prototype if it's not equal the default one in
          // this realm.
          traverse(prototype, value)
        }
        break
      }
    }
  }

  traverse(value)

  return bindings
}

const topologicallySortBindings = (bindings: State[`_bindings`]): Binding[] => {
  const visited = new Set<object>()
  const sortedBindings: Binding[] = []

  const dfs = (value: object) => {
    visited.add(value)

    const binding = bindings.get(value)!
    for (const dependency of binding._dependencies) {
      if (!visited.has(dependency)) {
        dfs(dependency)
      }
    }

    sortedBindings.push(binding)
  }

  for (const [value] of bindings) {
    if (!visited.has(value)) {
      dfs(value)
    }
  }

  return sortedBindings
}

// TODO(#19): Support `Temporal` objects.
const srcifyInternal = ((value: unknown, state: State): string | null => {
  switch (typeof value) {
    case `undefined`:
      return `void 0`
    case `boolean`:
      return srcifyBoolean(value)
    case `number`:
      return srcifyNumber(value)
    case `bigint`:
      return `${value}n`
    case `string`:
      return srcifyString(value)
    case `symbol`:
      return srcifySymbol(value, state)
    case `object`:
      return value == null ? `null` : srcifyObject(value, state)
    case `function`:
      throw new TypeError(`Unsupported function`)
  }
}) as {
  (
    value: string | number | boolean | bigint | symbol | null | undefined,
    state: State,
  ): string
  (value: unknown, state: State): string | null
}

const srcifyBoolean = (value: boolean): string =>
  // Convert `false` to `!1` and `true` to `!0`
  `!${
    // eslint-disable-next-line no-implicit-coercion
    +!value
  }`

const srcifyNumber = (value: number): string => {
  if (value == Infinity) {
    return `1/0`
  } else if (value == -Infinity) {
    return `-1/0`
  }

  const source = `${value}`
  if (Object.is(value, -0)) {
    // Converting -0 to a string becomes `0` so we have to special-case it.
    return `-${source}`
  }

  // Convert `0.123` to `.123` and  `-0.123` to `-.123`.
  return source.replace(ZERO_POINT_REG_EXP, match => match.slice(0, -1))
}

// eslint-disable-next-line require-unicode-regexp
const ZERO_POINT_REG_EXP = /^-?0(?=\.)/

// TODO(#29): Correctly handle lone surrogates.
// TODO(#30): Stringify `\0` as `\0` instead of `\u0000`
const srcifyString = (value: string): string =>
  JSON.stringify(value)
    // Prevent XSS attack via closing an inline script tag.
    // eslint-disable-next-line unicorn/prefer-string-replace-all
    .replace(/<\/(?=script)/giu, `<\\u002f`)
    // These whitespace characters are safe JSON, but not safe JS:
    // https://stackoverflow.com/a/9168133
    .replaceAll(`\u2028`, `\\u2028`)
    .replaceAll(`\u2029`, `\\u2029`)

const srcifySymbol = (value: symbol, state: State): string => {
  let key = WELL_KNOWN_SYMBOL_TO_KEY.get(value)
  if (key) {
    return `Symbol.${key}`
  }

  key = Symbol.keyFor(value)
  if (key) {
    return `Symbol.for(${srcifyInternal(key, state)})`
  }

  throw new TypeError(`Unsupported symbol`)
}

const WELL_KNOWN_SYMBOL_TO_KEY: ReadonlyMap<symbol, string> = new Map(
  Reflect.ownKeys(Symbol).flatMap(key => {
    // This doesn't happen in practice, but best to be safe if one day a
    // non-string key as added to `Symbol`.
    if (typeof key != `string`) {
      return []
    }
    const value = Symbol[key as keyof typeof Symbol]
    return typeof value == `symbol` ? [[value, key]] : []
  }),
)

const srcifyObject = (value: object, state: State): string | null => {
  const binding = state._bindings.get(value)
  if (!binding) {
    // This value has no binding so we can render its source inline.
    return srcifyObjectInternal(value, state)
  }

  if (state._currentParents.has(value)) {
    // Return null to indicate that this value is circularly referenced and
    // should not be rendered here. Instead, we'll add a mutation to attach the
    // circular reference later (in the caller).
    return null
  }

  if (state._currentBinding) {
    // Register the current binding we're rendering as dependent on this value's
    // binding (we return the binding name below) so that we can topologically
    // sort the bindings later.
    state._currentBinding._dependencies.add(value)
  }

  if (!binding._source) {
    const previousBinding = state._currentBinding

    // If this is the first time we're encountering this binding, then we must
    // compute and set its source.
    state._currentBinding = binding
    state._currentParents.add(value)
    binding._source = srcifyObjectInternal(value, state)
    state._currentParents.delete(value)
    state._currentBinding = previousBinding
  }

  return binding._name
}

const srcifyMutation = (
  mutation: Mutation,
  state: State,
): {
  /** The source of the mutation itself. */
  _source: string
  /**
   * What the mutation statement evaluates to when used as an expression.
   *
   * Undefined if it doesn't evaluate to anything worth mentioning.
   */
  _evaluatesTo?: string
} => {
  const bindingName = state._bindings.get(mutation._target)!._name
  const valueSource = mutation._input
    ? typeof mutation._input == `string`
      ? mutation._input
      : state._bindings.get(mutation._input)!._name
    : ``
  switch (mutation._type) {
    case SET_OBJECT_STRING_PROPERTY:
      return mutation._property == __PROTO__
        ? {
            _source: objectDefineProperty(bindingName, valueSource),
            // `Object.defineProperty` always returns the input object.
            _evaluatesTo: bindingName,
          }
        : {
            _source: `${bindingName}${
              PROPERTY_REG_EXP.test(mutation._property)
                ? `.${mutation._property}`
                : `[${srcifyInternal(mutation._property, state)}]`
            }=${valueSource}`,
            // An assignment evaluates to the right-hand side.
            _evaluatesTo: valueSource,
          }
    case SET_OBJECT_SYMBOL_PROPERTY:
      return {
        _source: `${bindingName}[${mutation._property}]=${valueSource}`,
        // An assignment evaluates to the right-hand side.
        _evaluatesTo: valueSource,
      }
    case SET_ARRAY_INDEX:
      return {
        _source: `${bindingName}[${mutation._index}]=${valueSource}`,
        // An assignment evaluates to the right-hand side.
        _evaluatesTo: valueSource,
      }
    case SET_MAP_ENTRY:
      return {
        _source: `${bindingName}.set(${mutation._key},${valueSource})`,
        // `Map.set` always returns `this`.
        _evaluatesTo: bindingName,
      }
    case ADD_TO_SET:
      return {
        _source: `${bindingName}.add(${valueSource})`,
        // `Set.add` always returns `this`.
        _evaluatesTo: bindingName,
      }
    case TRANSFER_ARRAY_BUFFER:
      return { _source: `${bindingName}.transfer()` }
    case SET_ARRAY_BUFFER:
      return { _source: `new Uint8Array(${bindingName}).set(${valueSource})` }
  }
}

const srcifyObjectInternal = (value: object, state: State): string => {
  const type = getType(value)
  switch (type) {
    // TODO(#8): Serialize extremely sparse arrays more efficiently.
    case `Array`: {
      const array = value as unknown[]
      const itemSources: string[] = []
      for (let i = 0; i < array.length; i++) {
        if (!(i in array)) {
          itemSources.push(``)
          continue
        }

        const result = srcifyInternal(array[i], state)
        if (result == null) {
          state._mutations.push({
            _target: value,
            _type: SET_ARRAY_INDEX,
            _index: i,
            // `array[i]` must be an object if it's circular.
            _input: array[i] as object,
          })
          itemSources.push(``)
        } else {
          itemSources.push(result)
        }
      }
      if (!(array.length - 1 in array)) {
        // The array is sparse and has a trailing empty slot. This requires an
        // extra comma because otherwise the last comma is interpreted as a
        // no-op trailing comma.
        itemSources.push(``)
      }
      return `[${itemSources.join(`,`)}]`
    }
    case `Boolean`:
    case `Number`:
    case `String`:
      return `Object(${srcifyInternal(value.valueOf(), state)})`
    case `Date`:
      return newInstance(type, srcifyInternal((value as Date).valueOf(), state))
    case `URL`:
      return newInstance(type, srcifyInternal((value as URL).href, state))
    // TODO(#11): Serialize RegExp objects as literals.
    case `RegExp`: {
      const { source, flags } = value as RegExp
      return newInstance(
        type,
        `${srcifyInternal(source, state)}${
          flags && `,${srcifyInternal(flags, state)}`
        }`,
      )
    }
    case `Map`: {
      const entries = [...(value as Iterable<[unknown, unknown]>)]
        .flatMap(([key, item]) => {
          const keyResult = srcifyInternal(key, state)
          const itemResult = srcifyInternal(item, state)

          if (keyResult == null) {
            // If the key is circular, then omit this entry for now and set it
            // later.
            state._mutations.push({
              _target: value,
              _type: SET_MAP_ENTRY,
              _key: state._bindings.get(key as object)!._name,
              _input:
                itemResult ??
                // `value` must be an object if it's circular.
                (item as object),
            })
            return []
          }

          if (itemResult == null) {
            // If the item is circular, then omit the item part of the entry
            // for now and set it later.
            state._mutations.push({
              _target: value,
              _type: SET_MAP_ENTRY,
              _key: keyResult,
              // `item` must be an object if it's circular.
              _input: item as object,
            })
            return [`[${keyResult}]`]
          }

          return [`[${keyResult},${itemResult}]`]
        })
        .join(`,`)
      return newInstance(type, entries ? `[${entries}]` : ``)
    }
    case `Set`: {
      const values = [...(value as Iterable<unknown>)]
        .flatMap(item => {
          const result = srcifyInternal(item, state)
          if (result == null) {
            state._mutations.push({
              _target: value,
              _type: ADD_TO_SET,
              // `item` must be an object if it's circular.
              _input: item as object,
            })
            return []
          }

          return [result]
        })
        .join(`,`)
      return newInstance(type, values ? `[${values}]` : ``)
    }
    case `URLSearchParams`: {
      const values = [...(value as Iterable<[string, string]>)]
      return newInstance(
        type,
        values.length
          ? // Must be non-null because `[string, string][]` can't be circular.
            srcifyInternal(values, state)!
          : ``,
      )
    }
    // TODO(#13): Support Node `Buffer`
    case `ArrayBuffer`: {
      const arrayBuffer = value as ArrayBuffer
      const { detached, resizable, byteLength, maxByteLength } = arrayBuffer

      if (detached) {
        state._mutations.push({ _target: value, _type: TRANSFER_ARRAY_BUFFER })
      }

      let uint8Array: Uint8Array
      let firstNonZeroIndex: number
      if (
        byteLength == 0 ||
        (firstNonZeroIndex = (uint8Array = new Uint8Array(
          arrayBuffer,
        )).findIndex(value => value != 0)) == -1
      ) {
        return newInstance(
          type,
          resizable
            ? `${byteLength},{maxByteLength:${maxByteLength}}`
            : byteLength > 0
              ? byteLength
              : ``,
        )
      }

      if (!resizable) {
        return `${srcifyInternal(uint8Array, state)!}.buffer`
      }

      const lastNonZeroIndex = uint8Array.findLastIndex(value => value != 0)

      state._mutations.push({
        _target: value,
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        _input: `[${uint8Array.slice(firstNonZeroIndex, lastNonZeroIndex + 1)}]${
          firstNonZeroIndex > 0 ? `,${firstNonZeroIndex}` : ``
        }`,
        _type: SET_ARRAY_BUFFER,
      })
      return newInstance(type, `${byteLength},{maxByteLength:${maxByteLength}}`)
    }
    // TODO(#8): Serialize extremely sparse typed arrays more efficiently.
    // TODO(#14): Support shared buffers between typed arrays.
    case `Int8Array`:
    case `Uint8Array`:
    case `Uint8ClampedArray`:
    case `Int16Array`:
    case `Uint16Array`:
    case `Int32Array`:
    case `Uint32Array`:
    case `Float16Array`:
    case `Float32Array`:
    case `Float64Array`: {
      const values = [...(value as Iterable<number>)]
      return newInstance(
        type,
        values.length
          ? values.every(value => Object.is(value, 0))
            ? values.length
            : // Must be non-null because `number[]` can't be circular.
              srcifyInternal(values, state)!
          : ``,
      )
    }
    // TODO(#8): Serialize extremely sparse typed arrays more efficiently.
    // TODO(#14): Support shared buffers between typed arrays.
    case `BigInt64Array`:
    case `BigUint64Array`: {
      const values = [...(value as Iterable<bigint>)]
      return newInstance(
        type,
        values.length
          ? values.every(value => value == 0n)
            ? values.length
            : // Must be non-null because `bigint[]` can't be circular.
              srcifyInternal(values, state)!
          : ``,
      )
    }
    default:
      return srcifyObjectLike(value, state)
  }
}

const newInstance = (type: string, args: string | number = ``) =>
  `new ${type}(${args})`

const srcifyObjectLike = (object: object, state: State): string => {
  let __proto__: { _value: unknown } | undefined
  // TODO(#9): Support all property types, including non-enumerable ones.
  let source = `{${Reflect.ownKeys(object)
    .filter(key => {
      if (key == __PROTO__) {
        // TODO(#10): Use `Object.assign` after `Object.defineProperty` if
        // `__proto__` is in the middle of the ordering, so that we preserve
        // the property order instead of always putting it at the end.
        __proto__ = { _value: Reflect.get(object, key) as unknown }
        return false
      } else {
        return true
      }
    })
    .flatMap(key => {
      const symbolResult =
        typeof key == `symbol` ? srcifyInternal(key, state) : null

      const value = Reflect.get(object, key) as unknown
      const valueResult = srcifyInternal(value, state)
      if (valueResult == null) {
        state._mutations.push({
          _target: object,
          // `value` must be an object if it's circular.
          _input: value as object,
          ...(symbolResult
            ? { _type: SET_OBJECT_SYMBOL_PROPERTY, _property: symbolResult }
            : { _type: SET_OBJECT_STRING_PROPERTY, _property: key as string }),
        })
        return []
      }

      if (symbolResult) {
        return [`[${symbolResult}]:${valueResult}`]
      }

      key = key as string

      // eslint-disable-next-line no-implicit-coercion
      const number = +key
      const isNumericKey =
        key == `${number}` && number >= 0 && Number.isSafeInteger(number)
      if (isNumericKey) {
        return [`${key}:${valueResult}`]
      }

      if (!PROPERTY_REG_EXP.test(key)) {
        return [`${srcifyInternal(key, state)}:${valueResult}`]
      }

      return [key == valueResult ? key : `${key}:${valueResult}`]
    })
    .join(`,`)}}`
  if (__proto__) {
    const result = srcifyInternal(__proto__._value, state)
    if (result == null) {
      state._mutations.push({
        _target: object,
        _type: SET_OBJECT_STRING_PROPERTY,
        _property: __PROTO__,
        // `__proto__._value` must be an object if it's circular.
        _input: __proto__._value as object,
      })
    } else {
      source = objectDefineProperty(source, result)
    }
  }

  const prototype = Object.getPrototypeOf(object) as unknown
  // TODO(#31): Check if an object is a plain object based on properties on the
  // prototype.
  if (prototype != Object.prototype) {
    // We only render the prototype if it's not equal the default one in this
    // realm.
    source = `Object.setPrototypeOf(${source},${
      // This must be non-null because prototypes cannot be circular. Trying
      // to make them circular results in an error.
      srcifyInternal(prototype, state)!
    })`
  }

  return source
}

const objectDefineProperty = (objectSource: string, valueSource: string) =>
  `Object.defineProperty(${objectSource},"${__PROTO__}",{value:${
    valueSource
  },writable:true,enumerable:true,configurable:true})`

const __PROTO__ = `__proto__`
const PROPERTY_REG_EXP = /^\p{ID_Start}\p{ID_Continue}*$/u

const getType = (value: object): string =>
  // `.constructor` returns `undefined` for objects with null prototype.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  value.constructor?.name ?? `Object`

export default srcify
