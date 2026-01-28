/* eslint-disable @typescript-eslint/no-wrapper-object-types */

import { generateIdentifier } from './identifier.ts'

/** An identifier with an assigned value. */
type Binding = {
  /** The name of the binding. */
  _name: string
  /** The value of the binding as a source string. */
  _source: string
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

/** An mutation of a binding. */
type Mutation = {
  _binding: Binding
  /** The source or value with a binding that's the "input" to the mutation. */
  _value: string | object
} & (
  | { _type: typeof SET_OBJECT_STRING_PROPERTY; _property: string }
  | { _type: typeof SET_OBJECT_SYMBOL_PROPERTY; _property: string }
  | { _type: typeof SET_ARRAY_INDEX; _index: number }
  | { _type: typeof SET_MAP_ENTRY; _key: string }
  | { _type: typeof ADD_TO_SET }
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
  } else if (bodyResults.at(-1)?._evaluatesTo !== returnBinding._name) {
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
        _source: ``,
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
    if (value === null || typeof value !== `object`) {
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
            typeof key === `object`
          ) {
            // If the item is circular and the key is an object, then the key
            // also needs a binding so we can reference it in mutations.
            ensureBinding(key)
          }
        }
        break
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
      case `Float32Array`:
      case `Float64Array`:
      case `BigInt64Array`:
      case `BigUint64Array`:
        break
      default: {
        for (const key of Reflect.ownKeys(value)) {
          traverse(Reflect.get(value, key), value)
        }

        const prototype = Object.getPrototypeOf(value) as unknown
        // TODO: Find a better alternative to this that works cross-realm.
        if (prototype !== Object.prototype) {
          // We only render the prototype if it's not equal the default one.
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

const srcifyInternal = ((value: unknown, state: State): string | null => {
  switch (typeof value) {
    case `undefined`:
      return `undefined`
    case `boolean`:
      return String(value)
    case `number`:
      // `String(-0)` becomes `'0'` so we have to special-case it.
      return Object.is(value, -0) ? `-0` : String(value)
    case `bigint`:
      return `${value}n`
    case `string`:
      return JSON.stringify(value)
    case `object`:
      return value === null ? `null` : srcifyObject(value, state)
    case `symbol`: {
      const key = WELL_KNOWN_SYMBOL_TO_KEY.get(value)
      if (!key) {
        throw new TypeError(`Unsupported: symbol`)
      }
      return `Symbol.${key}`
    }
    case `function`:
      throw new TypeError(`Unsupported: function`)
  }
}) as {
  (
    value: string | number | boolean | bigint | symbol | null | undefined,
    state: State,
  ): string
  (value: unknown, state: State): string | null
}

const WELL_KNOWN_SYMBOL_TO_KEY: ReadonlyMap<symbol, string> = new Map(
  Reflect.ownKeys(Symbol).flatMap(key => {
    // This doesn't happen in practice, but best to be safe if one day a
    // non-string key as added to `Symbol`.
    /* c8 ignore next -- @preserve */
    if (typeof key !== `string`) {
      return []
    }
    const value = Symbol[key as keyof typeof Symbol]
    return typeof value === `symbol` ? [[value, key]] : []
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
  /** What the mutation statement evaluates to when used as an expression. */
  _evaluatesTo: string
} => {
  const bindingName = mutation._binding._name
  const valueSource =
    typeof mutation._value === `string`
      ? mutation._value
      : state._bindings.get(mutation._value)!._name
  switch (mutation._type) {
    case SET_OBJECT_STRING_PROPERTY:
      return mutation._property === __PROTO__
        ? {
            _source: objectDefineProperty(bindingName, valueSource),
            // `Object.defineProperty` always returns the input object.
            _evaluatesTo: bindingName,
          }
        : {
            _source: `${bindingName}${
              PROPERTY_REG_EXP.test(mutation._property)
                ? `.${mutation._property}`
                : `[${JSON.stringify(mutation._property)}]`
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
  }
}

const srcifyObjectInternal = (value: object, state: State): string => {
  const type = getType(value)
  switch (type) {
    // TODO: Serialize extremely sparse arrays more efficiently.
    case `Array`: {
      const array = value as unknown[]
      const itemSources: string[] = []
      const binding = state._bindings.get(value)
      for (let i = 0; i < array.length; i++) {
        if (!(i in array)) {
          itemSources.push(``)
          continue
        }

        const result = srcifyInternal(array[i], state)
        if (result === null) {
          state._mutations.push({
            _binding: binding!,
            _type: SET_ARRAY_INDEX,
            _index: i,
            // `array[i]` must be an object if it's circular.
            _value: array[i] as object,
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
    case `String`: {
      const primitive = (value as Boolean).valueOf()
      return newInstance(
        type,
        primitive ? srcifyInternal(primitive, state) : ``,
      )
    }
    case `Number`: {
      const primitive = (value as Number).valueOf()
      return newInstance(
        type,
        Object.is(primitive, 0) ? `` : srcifyInternal(primitive, state),
      )
    }
    case `Date`:
      return newInstance(type, srcifyInternal((value as Date).valueOf(), state))
    case `URL`:
      return newInstance(type, srcifyInternal((value as URL).href, state))
    // TODO: Serialize RegExp objects as literals.
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
      const binding = state._bindings.get(value)
      const entries = [...(value as Iterable<[unknown, unknown]>)]
        .flatMap(([key, value]) => {
          const keyResult = srcifyInternal(key, state)
          const valueResult = srcifyInternal(value, state)

          if (keyResult === null) {
            // If the key is circular, then omit this entry for now and set it
            // later.
            state._mutations.push({
              _binding: binding!,
              _type: SET_MAP_ENTRY,
              _key: state._bindings.get(key as object)!._name,
              _value:
                valueResult ??
                // `value` must be an object if it's circular.
                (value as object),
            })
            return []
          }

          if (valueResult === null) {
            // If the value is circular, then omit the value part of the entry
            // for now and set it later.
            state._mutations.push({
              _binding: binding!,
              _type: SET_MAP_ENTRY,
              _key: keyResult,
              // `value` must be an object if it's circular.
              _value: value as object,
            })
            return [`[${keyResult}]`]
          }

          return [`[${keyResult},${valueResult}]`]
        })
        .join(`,`)
      return newInstance(type, entries ? `[${entries}]` : ``)
    }
    case `Set`: {
      const binding = state._bindings.get(value)
      const values = [...(value as Iterable<unknown>)]
        .flatMap(value => {
          const result = srcifyInternal(value, state)
          if (result === null) {
            state._mutations.push({
              _binding: binding!,
              _type: ADD_TO_SET,
              // `value` must be an object if it's circular.
              _value: value as object,
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
    case `Int8Array`:
    case `Uint8Array`:
    case `Uint8ClampedArray`:
    case `Int16Array`:
    case `Uint16Array`:
    case `Int32Array`:
    case `Uint32Array`:
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
    case `BigInt64Array`:
    case `BigUint64Array`: {
      const values = [...(value as Iterable<bigint>)]
      return newInstance(
        type,
        values.length
          ? values.every(value => value === 0n)
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

const newInstance = (type: string, args: string | number) =>
  `new ${type}(${args})`

const srcifyObjectLike = (object: object, state: State): string => {
  const binding = state._bindings.get(object)

  let __proto__: { _value: unknown } | undefined
  let source = `{${Reflect.ownKeys(object)
    .filter(key => {
      if (key === __PROTO__) {
        // TODO: Use `Object.assign` after `Object.defineProperty` if
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
        typeof key === `symbol` ? srcifyInternal(key, state) : null

      const value = Reflect.get(object, key) as unknown
      const valueResult = srcifyInternal(value, state)
      if (valueResult === null) {
        state._mutations.push({
          _binding: binding!,
          // `value` must be an object if it's circular.
          _value: value as object,
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
      if (NAT_REG_EXP.test(key)) {
        return [`${key}:${valueResult}`]
      }

      if (!PROPERTY_REG_EXP.test(key)) {
        return [`${JSON.stringify(key)}:${valueResult}`]
      }

      return [key === valueResult ? key : `${key}:${valueResult}`]
    })
    .join(`,`)}}`
  if (__proto__) {
    const result = srcifyInternal(__proto__._value, state)
    if (result === null) {
      state._mutations.push({
        _binding: binding!,
        _type: SET_OBJECT_STRING_PROPERTY,
        _property: __PROTO__,
        // `__proto__._value` must be an object if it's circular.
        _value: __proto__._value as object,
      })
    } else {
      source = objectDefineProperty(source, result)
    }
  }

  const prototype = Object.getPrototypeOf(object) as unknown
  // TODO: Find a better alternative to this that works cross-realm.
  if (prototype !== Object.prototype) {
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
const NAT_REG_EXP = /^[1-9][0-9]*$/u

const getType = (value: object): string =>
  // `.constructor` returns `undefined` for objects with null prototype.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  value.constructor?.name ?? `Object`

export default srcify
