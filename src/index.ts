/* eslint-disable @typescript-eslint/no-wrapper-object-types */

import { generateIdentifier } from './identifier.ts'

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
    _refCounts: countRefs(value),
    _currentParents: new Set(),
    _currentPath: [],
    _bindings: new Map(),
    _circularAssignments: [],
  }
  const source = srcifyInternal(value, state)

  if (!state._bindings.size) {
    // If no bindings were created, then it's impossible for the returned source
    // to reference one, so it must be a string.
    return source!
  }

  const parametersSource = Array.from(
    topologicallySortBindings(state._bindings),
    binding => `${binding._name}=${binding._source}`,
  ).join(`,`)
  const bodySources = state._circularAssignments.map(path => {
    const circularName = path[0]!._name
    for (let i = path.length - 2; i >= 0; i--) {
      const binding = state._bindings.get(path[i]!._value as object)
      if (binding) {
        return `${binding._name}${srcifyPath(path.slice(i + 1))}=${circularName}`
      }
    }
    /* c8 ignore next -- @preserve */
    return undefined
  })

  const returnBinding = state._bindings.get(value as object)
  if (!returnBinding) {
    bodySources.push(source!)
  } else if (state._circularAssignments.at(-1)?.at(-1)?._value !== value) {
    bodySources.push(returnBinding._name)
  }

  let bodySource = bodySources.join(`,`)
  if (bodySources.length > 1 || bodySource.startsWith(`{`)) {
    bodySource = `(${bodySource})`
  }

  return `((${parametersSource})=>${bodySource})()`
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

/** A path from a root object to some sub-object within it. */
type Path = {
  /**
   * The name associated with the path segment.
   *
   * If it's the root, then it will be a variable name. Otherwise it will be a
   * property name or array index.
   */
  _name: string | number

  /**
   * The value at this point of the path.
   *
   * If it's the first path segment, then it's the root object.
   */
  _value: unknown
}[]

type Binding = {
  /** The name of the binding. */
  _name: string
  /** The value of the binding as a source string. */
  _source: string
  /** The binding values this binding depends on. */
  _dependencies: Set<object>
}

/** State maintained while converting a value to source. */
type State = {
  /**
   * The number of times each object is referenced.
   *
   * Used to decide whether to extract a binding for a value or render it inline.
   */
  _refCounts: Map<object, number>

  /**
   * Parents objects that have already been visited above the current object
   * tree being traversed.
   *
   * Used to detect circular references.
   */
  _currentParents: Set<object>

  /** The path from the root value to the current value being traversed. */
  _currentPath: Path

  /**
   * The current binding being rendered, or `undefined` if an inline value is
   * being rendered (e.g. directly returned).
   */
  _currentBinding?: Binding

  /**
   * A map from object to the binding where it should be stored.
   *
   * Bindings are used to share objects that are referenced multiple times or to
   * create circular references in conjunction with
   * {@link State._circularAssignments}.
   */
  _bindings: Map<object, Binding>

  /**
   * A list of circular assignments of bindings.
   *
   * The value of the first segment in the path will be assigned as the new
   * value for the last segment of the path.
   */
  _circularAssignments: Path[]
}

const countRefs = (value: unknown) => {
  const counts = new Map<object, number>()

  const traverse = (value: unknown) => {
    if (value === null || typeof value !== `object`) {
      return
    }

    const count = counts.get(value)
    if (count) {
      counts.set(value, count + 1)
      return
    }

    counts.set(value, 1)
    switch (getType(value)) {
      case `Array`:
      case `Set`:
        for (const item of value as Iterable<unknown>) {
          traverse(item)
        }
        break
      case `Map`:
        for (const [key, item] of value as Map<unknown, unknown>) {
          traverse(key)
          traverse(item)
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
      default:
        for (const item of Object.values(value)) {
          traverse(item)
        }
        traverse(Object.getPrototypeOf(value))
        break
    }
  }

  traverse(value)
  return counts
}

const srcifyInternal = (value: unknown, state: State): string | null => {
  switch (typeof value) {
    case `undefined`:
      return `undefined`
    case `boolean`:
      return String(value)
    case `number`:
      return Object.is(value, -0) ? `-0` : String(value)
    case `bigint`:
      return `${value}n`
    case `string`:
      return JSON.stringify(value)
    case `object`:
      return value === null ? `null` : srcifyObject(value, state)
    case `symbol`:
    case `function`:
      throw new Error(`Unsupported: ${typeof value}`)
  }
}

const srcifyObject = (value: object, state: State): string | null => {
  const refCount = state._refCounts.get(value) ?? 1
  if (refCount === 1) {
    return srcifyObjectInternal(value, state)
  }

  let binding = state._bindings.get(value)
  if (binding === undefined) {
    binding = {
      _name: generateIdentifier(state._bindings.size),
      _source: ``,
      _dependencies: new Set(),
    }
    state._bindings.set(value, binding)
  }

  if (state._currentParents.has(value)) {
    state._circularAssignments.push([
      { _name: binding._name, _value: value },
      ...state._currentPath,
    ])
    return null
  }

  if (!binding._source) {
    const previousBinding = state._currentBinding
    state._currentBinding = binding

    state._currentParents.add(value)
    binding._source = srcifyObjectInternal(value, state)
    state._currentParents.delete(value)

    state._currentBinding = previousBinding
  }

  if (state._currentBinding) {
    state._currentBinding._dependencies.add(value)
  }

  return binding._name
}

const srcifyPath = (path: Path): string =>
  path
    .map(({ _name: name }) => {
      if (typeof name === `number`) {
        return `[${name}]`
      }

      return PROPERTY_REG_EXP.test(name)
        ? `.${name}`
        : `[${JSON.stringify(name)}]`
    })
    .join(``)

const srcifyObjectInternal = (value: object, state: State): string => {
  const type = getType(value)
  switch (type) {
    // TODO: Serialize extremely sparse arrays more efficiently.
    case `Array`: {
      const array = value as unknown[]
      const itemSources: string[] = []
      for (let i = 0; i < array.length; i++) {
        if (!(i in array)) {
          itemSources.push(``)
          continue
        }

        const item = array[i]
        state._currentPath.push({ _name: i, _value: item })
        const result = srcifyInternal(item, state)
        state._currentPath.pop()
        itemSources.push(result ?? ``)
      }
      if (!(array.length - 1 in array)) {
        // The array is sparse and has a trailing empty slot. This requires an
        // extra comma because otherwise the last comma is interpreted as a
        // no-op trailing comma.
        itemSources.push(``)
      }
      return `[${itemSources.join(`,`)}]`
    }
    case `Boolean`: {
      const primitive = (value as Boolean).valueOf()
      return newInstance(
        type,
        primitive ? srcifyInternal(primitive, state)! : ``,
      )
    }
    case `Number`: {
      const primitive = (value as Number).valueOf()
      return newInstance(
        type,
        Object.is(primitive, 0) ? `` : srcifyInternal(primitive, state)!,
      )
    }
    case `String`: {
      const primitive = (value as String).valueOf()
      return newInstance(
        type,
        primitive ? srcifyInternal(primitive, state)! : ``,
      )
    }
    case `Date`:
      return newInstance(type, srcifyInternal(value.valueOf(), state)!)
    case `URL`:
      return newInstance(type, srcifyInternal((value as URL).href, state)!)
    // TODO: Serialize RegExp objects as literals.
    case `RegExp`: {
      const { source, flags } = value as RegExp
      return newInstance(
        type,
        `${srcifyInternal(source, state)!}${flags && `,${srcifyInternal(flags, state)!}`}`,
      )
    }
    case `Map`:
    case `Set`:
    case `URLSearchParams`: {
      const values = [...(value as Iterable<unknown>)]
      return newInstance(
        type,
        values.length
          ? // TODO: This won't always return a string.
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
            : srcifyInternal(values, state)!
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
            : srcifyInternal(values, state)!
          : ``,
      )
    }
    default:
      return srcifyObjectLike(value, state)
  }
}

const newInstance = (type: string, args: string | number) =>
  `new ${type}(${args})`

const srcifyObjectLike = (value: object, state: State): string => {
  let __proto__: { value: unknown } | undefined
  let source = `{${Object.entries(value)
    .filter(([key, value]) => {
      if (key === `__proto__`) {
        __proto__ = { value }
        return false
      } else {
        return true
      }
    })
    .flatMap(([key, value]) => {
      state._currentPath.push({ _name: key, _value: value })
      const result = srcifyInternal(value, state)
      state._currentPath.pop()

      if (result === null) {
        return []
      }

      if (!PROPERTY_REG_EXP.test(key)) {
        return [`${JSON.stringify(key)}:${result}`]
      }

      return [key === result ? key : `${key}:${result}`]
    })
    .join(`,`)}}`
  if (__proto__) {
    source = `Object.defineProperty(${source},"__proto__",{value:${
      // TODO: This won't always return a string.
      srcifyInternal(__proto__.value, state)!
    },writable:true,enumerable:true,configurable:true})`
  }

  const prototype = Object.getPrototypeOf(value) as unknown
  if (
    typeof prototype !== `object` ||
    prototype === null ||
    getType(prototype) !== `Object`
  ) {
    source = `Object.setPrototypeOf(${source},${
      // TODO: This won't always return a string.
      srcifyInternal(prototype, state)!
    })`
  }

  return source
}

const PROPERTY_REG_EXP = /^\p{ID_Start}\p{ID_Continue}*$/u

const getType = (value: object): string =>
  // `.constructor` returns `undefined` for objects with null prototype.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  value.constructor?.name ?? `Object`

export default srcify
