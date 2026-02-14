// For smaller bundle size.
/* eslint-disable eqeqeq */

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

/** An mutation of a binding. */
type Mutation = {
  /** The source of the mutation itself. */
  _source: string
  /**
   * What the mutation statement evaluates to when used as an expression.
   *
   * Undefined if it doesn't evaluate to anything worth mentioning.
   */
  _evaluatesTo?: string
}

/** State maintained while converting a value to source. */
type State = {
  /**
   * A map from object to the binding where it should be stored.
   *
   * Bindings are used to share objects that are referenced multiple times or to
   * create circular references in conjunction with {@link State._mutations}.
   */
  _bindings: Map<object, Binding>

  /** A map from value to user provided custom source. */
  _customSources: Map<unknown, string>

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

  /** A list of mutations of bindings. */
  _mutations: Mutation[]
}

/** Options for {@link uneval}. */
export type UnevalOptions = {
  /**
   * A custom function for unevaling values.
   *
   * Return the following types depending on the desired behavior:
   * - `string` to provide a custom uneval result for {@link value}
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
  ) => string | undefined
}

// TODO(#17): Support ignoring unsupported things (like functions and symbols).
/**
 * Converts the given {@link value} to JavaScript source code.
 *
 * @example
 * ```js
 * import assert from 'node:assert'
 * import uneval from 'uneval'
 *
 * const object = { message: `hello world` }
 *
 * const source = uneval(object)
 * console.log(source)
 * //=> {message:"hello world"}
 *
 * const roundtrippedObject = (0, eval)(`(${source})`)
 * assert.deepEqual(roundtrippedObject, object)
 * ```
 */
const uneval = (value: unknown, { custom }: UnevalOptions = {}): string => {
  const state = createState(value, custom)
  const result = unevalInternal(value, state)
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
  if (bodySources.length > 1 || bodySource.startsWith(`{`)) {
    // If the body is a comma expression, then it requires a parentheses to be a
    // syntactically correct expression return. If the body is an object, then
    // it also needs parentheses so that it isn't interpreted as a block.
    bodySource = `(${bodySource})`
  }

  const bindings = [...topologicallySortBindings(state._bindings)]

  // We use an IIFE's lambda parameters to declare bindings because it's fewer
  // bytes than using `var` or `let`. We place the binding values in the call
  // arguments for the leading bindings that don't have dependencies and place
  // in the default parameter values for the rest. This is because default
  // parameter values require more bytes than call arguments (due to the `=`).
  const parameterSources: string[] = []
  const argSources: string[] = []
  let hasDependency = false
  for (const binding of bindings) {
    hasDependency ||= !!binding._dependencies.size
    if (hasDependency) {
      parameterSources.push(`${binding._name}=${binding._source}`)
    } else {
      parameterSources.push(binding._name)
      argSources.push(binding._source!)
    }
  }

  const parametersSource = parameterSources.join()
  return `(${
    bindings.length > 1 ? `(${parametersSource})` : parametersSource
  }=>${bodySource})(${argSources.join()})`
}

const createState = (
  value: unknown,
  custom: UnevalOptions[`custom`],
): State => {
  const bindings = new Map<object, Binding>()
  const customSources = new Map<unknown, string>()

  const ensureBinding = (value: object) => {
    if (!bindings.has(value)) {
      bindings.set(value, {
        _name: generateIdentifier(bindings.size),
        _dependencies: new Set(),
      })
    }
  }

  // Values seen at any point during traversal. Used to detect circular and
  // shared references.
  const SOMEWHERE = 1
  const PARENT = 2
  const seenLocation = new Map<object, typeof SOMEWHERE | typeof PARENT>()

  /**
   * Computes the custom source for the given {@link value} and returns whether
   * it has any custom source.
   */
  const computeCustomSource = custom
    ? (value: unknown): boolean => {
        if (customSources.has(value)) {
          return true
        }

        const source = custom(value, value => uneval(value, { custom }))
        if (source == null) {
          return false
        }

        customSources.set(value, source)
        return true
      }
    : () => false

  const traverse = (value: unknown, parent?: object) => {
    // Note that we purposefully do not traverse functions here because we don't
    // support them natively.
    if (!value || typeof value != `object`) {
      computeCustomSource(value)
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
    if (computeCustomSource(value)) {
      return
    }

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
      case `Boolean`:
      case `Number`:
      case `String`:
      case `Date`:
      case `Instant`:
      case `PlainDate`:
      case `PlainTime`:
      case `PlainDateTime`:
      case `PlainYearMonth`:
      case `PlainMonthDay`:
      case `ZonedDateTime`:
      case `Duration`:
      case `URL`:
      case `RegExp`:
      case `URLSearchParams`:
        // These are leaf values.
        break
      case `Buffer`:
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
        traverse(
          (
            value as
              | Buffer
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
          ).buffer,
          value,
        )
        break
      default: {
        for (const key of Reflect.ownKeys(value)) {
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
        break
      }
    }
  }

  traverse(value)

  return {
    _bindings: bindings,
    _customSources: customSources,
    _currentParents: new Set(),
    _mutations: [],
  }
}

/**
 * Topologically sorts the bindings so that binding dependencies appear before
 * dependent bindings.
 */
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

const unevalInternal = ((value: unknown, state: State): string | null => {
  const customSource = isObject(value)
    ? // Don't check the custom source now because we may need to create a
      // binding in `unevalObject`.
      undefined
    : state._customSources.get(value)
  if (customSource != null) {
    return customSource
  }

  switch (typeof value) {
    case `undefined`:
      return `void 0`
    case `boolean`:
      return unevalBoolean(value)
    case `number`:
      return unevalNumber(value)
    case `bigint`:
      return `${value}n`
    case `string`:
      return unevalString(value)
    case `symbol`:
      return unevalSymbol(value, state)
    case `object`:
    case `function`:
      return value == null ? `null` : unevalObject(value, state)
  }
}) as {
  (
    value: string | number | boolean | bigint | symbol | null | undefined,
    state: State,
  ): string
  (value: unknown, state: State): string | null
}

const unevalBoolean = (value: boolean): string =>
  // Convert `false` to `!1` and `true` to `!0`
  `!${+!value}`

const unevalNumber = (value: number): string => {
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
  if (source.startsWith(`0.`)) {
    return source.slice(1)
  } else if (source.startsWith(`-0.`)) {
    return `-${source.slice(2)}`
  }

  return source
}

// `charCodeAt` is more performant for our use-case because we're dealing with
// strings known to be single code units.
/* eslint-disable unicorn/prefer-code-point */
const unevalString = (value: string): string => {
  let source = ``

  let lastIndex = 0
  for (let i = 0; i < value.length; i += 1) {
    const codeUnit = value[i]!
    const escaped = CODE_UNIT_ESCAPES[codeUnit]
    if (escaped) {
      source += value.slice(lastIndex, i) + escaped
      lastIndex = i + 1
      continue
    }

    const code = codeUnit.charCodeAt(0)

    // https://en.wikipedia.org/wiki/UTF-16#U+D800_to_U+DFFF_(surrogates)
    let isUnpairedSurrogate: boolean
    const isLowSurrogate = code >= 0xd800 && code <= 0xdbff
    if (isLowSurrogate) {
      const next = value.charCodeAt(i + 1)
      const isHighSurrogate = next >= 0xdc00 && next <= 0xdfff
      if (isHighSurrogate) {
        i++
        isUnpairedSurrogate = false
      } else {
        isUnpairedSurrogate = true
      }
    } else {
      const isHighSurrogate = code >= 0xdc00 && code <= 0xdfff
      // If this is a high surrogate, then it's unpaired. If it were paired,
      // then we would have skipped it in the previous iteration of the loop.
      isUnpairedSurrogate = isHighSurrogate
    }

    if (isUnpairedSurrogate) {
      // Escape unpaired surrogates in the source.
      source += `${value.slice(lastIndex, i)}\\u${code.toString(16)}`
      lastIndex = i + 1
      continue
    }

    // Prevent XSS attack via closing an inline script tag.
    if (
      codeUnit == `/` &&
      i > 0 &&
      value[i - 1] == `<` &&
      value.slice(i + 1, i + 7).toLowerCase() == `script`
    ) {
      source += `${value.slice(lastIndex, i)}\\u002f`
      lastIndex = i + 1
    }
  }

  source += value.slice(lastIndex)
  return `"${source}"`
}
/* eslint-enable unicorn/prefer-code-point */

const CODE_UNIT_ESCAPES: Readonly<Record<string, string>> = {
  '"': `\\"`,
  '\\': `\\\\`,
  '\0': `\\0`,
  '\n': `\\n`,
  '\r': `\\r`,
  '\t': `\\t`,
  '\b': `\\b`,
  '\f': `\\f`,
  '\v': `\\v`,
  // https://stackoverflow.com/a/9168133
  '\u2028': `\\u2028`,
  '\u2029': `\\u2029`,
}

const unevalSymbol = (value: symbol, state: State): string => {
  let key = WELL_KNOWN_SYMBOL_TO_KEY.get(value)
  if (key) {
    return `Symbol.${key}`
  }

  key = Symbol.keyFor(value)
  if (key) {
    return `Symbol.for(${unevalInternal(key, state)})`
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

const unevalObject = (value: object, state: State): string | null => {
  const binding = state._bindings.get(value)
  if (!binding) {
    // This value has no binding so we can render its source inline.
    return unevalObjectInternal(value, state)
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
    binding._source = unevalObjectInternal(value, state)
    state._currentParents.delete(value)
    state._currentBinding = previousBinding
  }

  return binding._name
}

const unevalObjectInternal = (value: object, state: State): string => {
  const customSource = state._customSources.get(value)
  if (customSource != null) {
    return customSource
  }

  if (typeof value == `function`) {
    throw new TypeError(`Unsupported function`)
  }

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

        const item = array[i]
        const result = unevalInternal(item, state)
        if (result == null) {
          const valueName = state._bindings.get(value)!._name
          const itemName = state._bindings.get(
            // `item` must be an object if it's circular.
            item as object,
          )!._name
          state._mutations.push({
            _source: `${valueName}[${i}]=${itemName}`,
            // An assignment evaluates to the right-hand side.
            _evaluatesTo: itemName,
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
      return `[${itemSources.join()}]`
    }
    case `Boolean`:
    case `Number`:
    case `String`:
      return `Object(${unevalInternal(value.valueOf(), state)})`
    case `Date`:
      return newInstance(type, unevalInternal((value as Date).valueOf(), state))
    case `Instant`:
    case `PlainDate`:
    case `PlainTime`:
    case `PlainDateTime`:
    case `PlainYearMonth`:
    case `PlainMonthDay`:
    case `ZonedDateTime`:
    case `Duration`:
      return `Temporal.${type}.from(${unevalInternal(
        // eslint-disable-next-line @typescript-eslint/no-base-to-string, @typescript-eslint/restrict-template-expressions
        `${value}`,
        state,
      )})`
    case `URL`:
      return newInstance(type, unevalInternal((value as URL).href, state))
    // TODO(#11): Serialize RegExp objects as literals.
    case `RegExp`: {
      const { source, flags } = value as RegExp
      return newInstance(
        type,
        `${unevalInternal(source, state)}${
          flags && `,${unevalInternal(flags, state)}`
        }`,
      )
    }
    case `Map`: {
      let foundCircularKey = false
      const argSources: string[] = []
      for (const [key, item] of value as Iterable<[unknown, unknown]>) {
        // If we've seen a circular key, then all remaining entries will end
        // up in mutations so we uneval them without the current binding to
        // not add unnecessary dependencies to the current binding.
        const keyResult = (
          foundCircularKey ? unevalWithoutCurrentBinding : unevalInternal
        )(key, state)
        if (keyResult == null) {
          foundCircularKey = true
        }
        const itemResult = (
          foundCircularKey ? unevalWithoutCurrentBinding : unevalInternal
        )(item, state)

        const keySource =
          keyResult ??
          state._bindings.get(
            // `key` must be an object if it's circular.
            key as object,
          )!._name
        const itemSource =
          itemResult ??
          state._bindings.get(
            // `item` must be an object if it's circular.
            item as object,
          )!._name

        if (foundCircularKey) {
          // After and including the first circular key, we add entries via
          // mutation to preserve iteration order.
          const valueName = state._bindings.get(value)!._name
          state._mutations.push({
            _source: `${valueName}.set(${keySource},${itemSource})`,
            // `Map.set` always returns `this`.
            _evaluatesTo: valueName,
          })
          continue
        }

        if (itemResult != null) {
          argSources.push(`[${keySource},${itemSource}]`)
          continue
        }

        // If the item is circular, include the key in the constructor, but set
        // the value later via mutation.
        const valueName = state._bindings.get(value)!._name
        state._mutations.push({
          _source: `${valueName}.set(${keySource},${itemSource})`,
          // `Map.set` always returns `this`.
          _evaluatesTo: valueName,
        })
        argSources.push(`[${keySource}]`)
      }

      const argsSource = argSources.join()
      return newInstance(type, argsSource ? `[${argsSource}]` : ``)
    }
    case `Set`: {
      let foundCircular = false
      const argSources: string[] = []
      for (const item of value as Iterable<unknown>) {
        // If we've seen a circular value, then all remaining values will end
        // up in mutations so we uneval them without the current binding to not
        // add unnecessary dependencies to the current binding.
        let result = (
          foundCircular ? unevalWithoutCurrentBinding : unevalInternal
        )(item, state)
        if (result == null) {
          foundCircular = true
          result = state._bindings.get(
            // `item` must be an object if it's circular.
            item as object,
          )!._name
        }

        if (!foundCircular) {
          argSources.push(result)
          continue
        }

        // After and including the first circular value, we add set values
        // via mutation to preserve iteration order.
        const valueName = state._bindings.get(value)!._name
        state._mutations.push({
          _source: `${valueName}.add(${result})`,
          // `Set.add` always returns `this`.
          _evaluatesTo: valueName,
        })
      }

      const argsSource = argSources.join()
      return newInstance(type, argsSource ? `[${argsSource}]` : ``)
    }
    case `URLSearchParams`: {
      const values = [...(value as Iterable<[string, string]>)]
      return newInstance(
        type,
        values.length
          ? // Must be non-null because `[string, string][]` can't be circular.
            unevalInternal(values, state)!
          : ``,
      )
    }
    case `Buffer`: {
      const buffer = value as Buffer
      const arrayBuffer = buffer.buffer as ArrayBuffer
      if (
        !buffer.byteOffset &&
        !buffer.byteLength &&
        !arrayBuffer.resizable &&
        !arrayBuffer.detached
      ) {
        return `${type}.alloc(0)`
      }

      return `${type}.from(${unevalInternal(arrayBuffer, state)!}${
        buffer.byteOffset + buffer.byteLength == arrayBuffer.byteLength
          ? buffer.byteOffset > 0
            ? `,${buffer.byteOffset}`
            : ``
          : `,${buffer.byteOffset},${buffer.byteLength}`
      })`
    }
    case `ArrayBuffer`: {
      const arrayBuffer = value as ArrayBuffer
      const { detached, resizable, byteLength, maxByteLength } = arrayBuffer

      if (detached) {
        const valueName = state._bindings.get(value)!._name
        state._mutations.push({ _source: `${valueName}.transfer()` })
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
          type,
          resizable
            ? `${byteLength},{maxByteLength:${maxByteLength}}`
            : byteLength > 0
              ? byteLength
              : ``,
        )
      }

      if (!resizable) {
        return `${unevalInternal(uint8Array, state)!}.buffer`
      }

      const valueName = state._bindings.get(value)!._name
      const lastNonZeroIndex = uint8Array.findLastIndex(value => value != 0)
      state._mutations.push({
        _source: `new Uint8Array(${valueName}).set([${
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          uint8Array.slice(firstNonZeroIndex, lastNonZeroIndex + 1)
        }]${firstNonZeroIndex > 0 ? `,${firstNonZeroIndex}` : ``})`,
      })
      return newInstance(type, `${byteLength},{maxByteLength:${maxByteLength}}`)
    }
    // TODO(#8): Serialize extremely sparse typed arrays more efficiently.
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
      return unevalTypedArray(
        value as
          | Int8Array
          | Uint8Array
          | Uint8ClampedArray
          | Int16Array
          | Uint16Array
          | Int32Array
          | Uint32Array
          | Float16Array
          | Float32Array
          | Float64Array,
        type,
        0,
        state,
      )
    // TODO(#8): Serialize extremely sparse typed arrays more efficiently.
    case `BigInt64Array`:
    case `BigUint64Array`:
      return unevalTypedArray(
        value as BigInt64Array | BigUint64Array,
        type,
        0n,
        state,
      )
    default:
      return unevalObjectLike(value, state)
  }
}

const unevalTypedArray = (
  typedArray:
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
    | BigUint64Array,
  type: string,
  zero: 0n | 0,
  state: State,
) => {
  const isFloatingPoint =
    type == `Float16Array` || type == `Float32Array` || type == `Float64Array`
  const hasNonCanonicalNaN =
    isFloatingPoint &&
    [...(typedArray as Float16Array | Float32Array | Float64Array)].some(
      isNonCanonicalNaN,
    )

  if (
    // We have to construct from a buffer if it has a binding, meaning that it's
    // shared between multiple values.
    state._bindings.has(typedArray.buffer) ||
    // Also, if the byte lengths differ between the typed array and the buffer,
    // then that means this typed array is a view of a slice of a buffer. The
    // only way to achieve that is by constructing from a buffer.
    typedArray.byteLength != typedArray.buffer.byteLength ||
    // Lastly, if the underlying buffer is resizable, then we must also
    // construct from a buffer. The default buffer created from
    // `new TypedArray(...)` is not resizable.
    (typedArray.buffer as ArrayBuffer).resizable ||
    // For floating-point arrays with non-canonical NaN values, we must
    // construct from the buffer to preserve the exact NaN bit pattern.
    hasNonCanonicalNaN
  ) {
    const bufferSource = unevalInternal(typedArray.buffer, state)!

    return newInstance(
      type,
      `${bufferSource}${
        typedArray.byteOffset + typedArray.byteLength ==
        typedArray.buffer.byteLength
          ? typedArray.byteOffset > 0
            ? `,${typedArray.byteOffset}`
            : ``
          : `,${typedArray.byteOffset},${
              typedArray.byteLength / typedArray.BYTES_PER_ELEMENT
            }`
      }`,
    )
  }

  if (typedArray.some(value => !Object.is(value, zero))) {
    return `${type}.of(${Array.from<number | bigint, string>(
      typedArray,
      value => unevalInternal(value, state),
    ).join()})`
  }

  return newInstance(type, typedArray.length || ``)
}

const isNonCanonicalNaN = (value: number): boolean => {
  if (!Number.isNaN(value)) {
    return false
  }

  float64ScratchView.setFloat64(0, value)
  return float64ScratchView.getBigUint64(0) != CANONICAL_NAN_BITS
}

const float64ScratchView = new DataView(new ArrayBuffer(8))
float64ScratchView.setFloat64(0, Number.NaN)
const CANONICAL_NAN_BITS = float64ScratchView.getBigUint64(0)

const newInstance = (type: string, args: string | number = ``) =>
  `new ${type}${args === `` ? `` : `(${args})`}`

const unevalObjectLike = (object: object, state: State): string => {
  const entries: ObjectEntry[] = []

  const keys = Reflect.ownKeys(object)
  let keyIndex: number
  for (keyIndex = 0; keyIndex < keys.length; keyIndex++) {
    const key = keys[keyIndex]!
    const descriptor = Object.getOwnPropertyDescriptor(object, key)!
    if (!isRegularDataDescriptor(descriptor)) {
      // All properties from this index onward will be rendered via
      // `Object.defineProperties` to preserve property order.
      break
    }

    const value = descriptor.value as unknown
    const valueResult = unevalInternal(value, state)
    if (valueResult != null) {
      const { _source: keySource, _isIdentifier: isIdentifier } =
        unevalObjectLiteralKey(key, state)
      entries.push({
        _isCircular: false,
        _source:
          isIdentifier && keySource == valueResult
            ? keySource
            : `${keySource}:${valueResult}`,
      })
      continue
    }

    const objectName = state._bindings.get(object)!._name
    const valueName = state._bindings.get(
      // `value` must be an object if it's circular.
      value as object,
    )!._name
    const mutation: Mutation =
      typeof key == `symbol`
        ? {
            _source: `${objectName}[${unevalInternal(key, state)}]=${valueName}`,
            // An assignment evaluates to the right-hand side.
            _evaluatesTo: valueName,
          }
        : key == __PROTO__
          ? {
              _source: `Object.defineProperty(${objectName},"${__PROTO__}",{value:${
                valueName
              },writable:!0,enumerable:!0,configurable:!0})`,
              // `Object.defineProperty` always returns the input object.
              _evaluatesTo: objectName,
            }
          : {
              _source: `${objectName}${
                PROPERTY_REG_EXP.test(key)
                  ? `.${key}`
                  : `[${unevalInternal(key, state)}]`
              }=${valueName}`,
              // An assignment evaluates to the right-hand side.
              _evaluatesTo: valueName,
            }
    entries.push({
      _isCircular: true,
      // This is a placeholder property for preserving property order. We'll set
      // the property's actual value later with the mutation below.
      _source: `${unevalObjectLiteralKey(key, state)._source}:null`,
      _mutation: () => mutation,
    })
  }

  const firstDescriptorIndex = keyIndex
  if (firstDescriptorIndex < keys.length) {
    for (; keyIndex < keys.length; keyIndex++) {
      const key = keys[keyIndex]!
      const descriptor = Object.getOwnPropertyDescriptor(object, key)!
      entries.push(unevalDescriptorEntry(key, descriptor, object, state))
    }
  }

  // We use this to trim trailing circular placeholders because they're not
  // necessary for preserving property order. The mutations of trailing circular
  // properties will end up placing them in the right order.
  let trailingCircularEntriesStartIndex = entries.length
  while (
    trailingCircularEntriesStartIndex > 0 &&
    entries[trailingCircularEntriesStartIndex - 1]!._isCircular
  ) {
    trailingCircularEntriesStartIndex--
  }

  // Push all circular mutations now that we know which entries have
  // placeholders (non-trailing) vs which don't (trailing).
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!
    if (entry._isCircular) {
      const hasPlaceholder = i < trailingCircularEntriesStartIndex
      state._mutations.push(entry._mutation(hasPlaceholder))
    }
  }

  // Create the initial object literal source.
  const leadingEntries = entries.slice(0, trailingCircularEntriesStartIndex)
  let source = `{${leadingEntries
    .slice(0, firstDescriptorIndex)
    .map(entry => entry._source)
    .join()}}`
  // Then set the trailing object descriptors if they are any.
  const descriptorEntrySources = leadingEntries
    .slice(firstDescriptorIndex)
    .map(entry => entry._source)
  if (descriptorEntrySources.length) {
    source = `Object.defineProperties(${source},{${descriptorEntrySources.join()}})`
  }

  const prototype = Object.getPrototypeOf(object) as unknown
  // TODO(#31): Check if an object is a plain object based on properties on the
  // prototype.
  if (!isDefaultObjectPrototype(prototype)) {
    // We only render the prototype if it's not equal the default one in this
    // realm.
    source = `Object.setPrototypeOf(${source},${
      // This must be non-null because prototypes cannot be circular. Trying
      // to make them circular results in an error.
      unevalInternal(prototype, state)!
    })`
  }

  return source
}

/**
 * Whether the {@link descriptor} is for a regular property, meaning its
 * descriptor attributes are the ones you'd get from a regular object literal
 * property (not through `Object.defineProperty`).
 */
const isRegularDataDescriptor = (descriptor: PropertyDescriptor): boolean =>
  `value` in descriptor &&
  descriptor.enumerable! &&
  descriptor.configurable! &&
  descriptor.writable!

const unevalDescriptorEntry = (
  key: PropertyKey,
  descriptor: PropertyDescriptor,
  object: object,
  state: State,
): ObjectEntry => {
  const descriptorEntrySources: string[] = []

  let isCircular = false
  let isGetSet = false
  for (const key of UNKNOWN_DESCRIPTOR_KEYS) {
    if (!(key in descriptor)) {
      continue
    }

    const value = descriptor[key] as unknown
    if (
      GET_SET_DESCRIPTOR_KEYS.includes(
        key as (typeof GET_SET_DESCRIPTOR_KEYS)[number],
      )
    ) {
      if (value == null && isGetSet) {
        // We only need one of `get` and `set` to be set in order for the
        // descriptor to not be a data descriptor. If `get` or `set` is already
        // set, and this other one is `undefined`, then setting it wouldn't do
        // anything.
        continue
      }
      isGetSet = true
    }

    let result = unevalInternal(value, state)
    if (result == null) {
      isCircular = true
      result = state._bindings.get(value as object)!._name
    }

    descriptorEntrySources.push(`${key}:${result}`)
  }

  // Set any non-`false` (the default) descriptor values.
  for (const key of BOOLEAN_DESCRIPTOR_KEYS) {
    if (descriptor[key]) {
      descriptorEntrySources.push(`${key}:!0`)
    }
  }
  const descriptorSource = `{${descriptorEntrySources.join()}}`

  if (!isCircular) {
    return {
      _isCircular: false,
      _source: `${unevalObjectLiteralKey(key, state)._source}:${descriptorSource}`,
    }
  }

  return {
    _isCircular: true,
    // This is a placeholder property for preserving property order. We'll set
    // the property's actual value later with the mutation.
    //
    // We leave all descriptor properties defaulting to `false` and `undefined`
    // so we only need to explicitly list the `true` and non-`undefined`
    // descriptor properties in the mutation. However, we must set
    // `configurable: true` because otherwise we can't modify the property
    // later at all.
    _source: `${unevalObjectLiteralKey(key, state)._source}:{configurable:!0}`,
    _mutation: hasPlaceholder => {
      const objectName = state._bindings.get(object)!._name

      // When a placeholder with `configurable: true` was emitted, the
      // mutation must explicitly set `configurable: false` to overwrite it.
      const mutationDescriptorSource =
        hasPlaceholder && !descriptor.configurable
          ? `{${[...descriptorEntrySources, `configurable:!1`].join()}}`
          : descriptorSource

      return {
        _source: `Object.defineProperty(${
          objectName
        },${unevalInternal(key, state)},${mutationDescriptorSource})`,
        // `Object.defineProperty` always returns the input object.
        _evaluatesTo: objectName,
      }
    },
  }
}

type ObjectEntry = { _source: string } & (
  | { _isCircular: false }
  | { _isCircular: true; _mutation: (hasPlaceholder: boolean) => Mutation }
)

const BOOLEAN_DESCRIPTOR_KEYS = [
  `configurable`,
  `enumerable`,
  `writable`,
] as const
const GET_SET_DESCRIPTOR_KEYS = [`get`, `set`] as const
const UNKNOWN_DESCRIPTOR_KEYS = [`value`, ...GET_SET_DESCRIPTOR_KEYS] as const

const unevalObjectLiteralKey = (
  key: PropertyKey,
  state: State,
): { _source: string; _isIdentifier: boolean } => {
  if (typeof key == `symbol`) {
    return { _source: `[${unevalInternal(key, state)}]`, _isIdentifier: false }
  }

  if (key == __PROTO__) {
    // `{ ['__proto__']: ...}` is a hack for setting `__proto__` as an own
    // property rather than setting `Object.prototype`.
    return {
      _source: `[${unevalInternal(__PROTO__, state)}]`,
      _isIdentifier: false,
    }
  }

  key = key as string

  // The vast majority of keys are non-numeric so don't bother with the
  // expensive numeric key check below if the key is definitely not numeric
  // based on the first character.
  const firstChar = key[0]!
  if (firstChar >= `0` && firstChar <= `9`) {
    const number = +key
    const isNumericKey =
      // Negative numbers must be quoted.
      number >= 0 &&
      // Numbers that can't be safely represented as integers (e.g. because
      // they are too large) must be quoted.
      Number.isSafeInteger(number) &&
      // If the key doesn't roundtrip through numeric conversion, then it's
      // padded (e.g. `01`) and must be quoted to retain that.
      key == `${number}`
    return {
      _source: isNumericKey ? key : unevalInternal(key, state),
      _isIdentifier: false,
    }
  }

  if (PROPERTY_REG_EXP.test(key)) {
    return { _source: key, _isIdentifier: true }
  }

  return { _source: unevalInternal(key, state), _isIdentifier: false }
}

const unevalWithoutCurrentBinding = (
  value: unknown,
  state: State,
): string | null => {
  const previousBinding = state._currentBinding
  state._currentBinding = undefined
  const result = unevalInternal(value, state)
  state._currentBinding = previousBinding
  return result
}

const __PROTO__ = `__proto__`
const PROPERTY_REG_EXP = /^[$_\p{ID_Start}][$_\p{ID_Continue}]*$/u

const isDefaultObjectPrototype = (value: unknown): boolean =>
  value == Object.prototype ||
  (isObject(value) &&
    ownKeysString(value) == DEFAULT_OBJECT_PROTOTYPE_KEYS_STRING)

const ownKeysString = (value: object) =>
  Object.getOwnPropertyNames(value).sort().join(`\0`)

const DEFAULT_OBJECT_PROTOTYPE_KEYS_STRING = ownKeysString(Object.prototype)

const isObject = (value: unknown): value is object => {
  const type = typeof value
  return (type == `object` && !!value) || type == `function`
}

const getType = (value: object): string =>
  // `.constructor` returns `undefined` for objects with null prototype.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  value.constructor?.name ?? `Object`

export default uneval
