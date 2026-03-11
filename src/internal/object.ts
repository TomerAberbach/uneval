// For smaller bundle size.
/* eslint-disable eqeqeq */

import {
  unevalArrayBuffer,
  unevalBuffer,
  unevalDataView,
  unevalTypedArray,
} from './buffer.ts'
import { unevalArray, unevalMap, unevalSet } from './collection.ts'
import { bindingName, PROPERTY_REG_EXP } from './common.ts'
import { unevalInternal, unevalWithoutCustom } from './index.ts'
import { unevalPrimitiveWrapper, unevalRegExp } from './primitive.ts'
import { unevalDate, unevalTemporal } from './temporal.ts'
import { getType } from './type.ts'
import type { Mutation, State, Uneval } from './types.ts'
import { unevalURL } from './url.ts'

export const unevalObject = (
  value: object,
  state: State,
  allowCustom: boolean,
): string | null | undefined => {
  if (allowCustom && state._customSources.get(value) === null) {
    // The user decided to omit this value.
    return undefined
  }

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

  // Note the current binding as having a dependency (on the binding we're
  // rendering below).
  if (state._currentBinding) {
    state._currentBinding._hasDependency = true
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

    // It's important to add the binding to the order after its source is
    // rendered so that it's rendered after its dependencies.
    state._bindingOrder.push(binding)
  }

  return binding._name
}

const unevalObjectInternal = (value: object, state: State): string => {
  const customSource = state._customSources.get(value)
  if (typeof customSource == `string`) {
    return customSource
  }

  const [type, name] = getType(value)
  return unevals[type!]?.(value, state, name!) ?? unevalObjectLike(value, state)
}

const unevalUnsupported: Uneval<unknown> = (_value, _state, name) => {
  throw new Error(`Unsupported: ${name}`)
}

// The order of this array must match the numeric values of `T_*` variables.
const unevals: Uneval<any>[] = [
  unevalPrimitiveWrapper,
  unevalRegExp,
  unevalArray,
  unevalSet,
  unevalMap,
  unevalArrayBuffer,
  unevalBuffer,
  unevalDataView,
  unevalTypedArray,
  unevalDate,
  unevalTemporal,
  unevalURL,
  unevalUnsupported,
]

const unevalObjectLike = (object: object, state: State): string => {
  const cached = state._cache.get(object)!
  const keys = cached._ownKeys!
  const descriptors = cached._descriptors!

  const entries: ObjectEntry[] = []

  let keyIndex: number
  for (keyIndex = 0; keyIndex < keys.length; keyIndex++) {
    const key = keys[keyIndex]!
    const descriptor = descriptors[keyIndex]!
    if (!isRegularDataDescriptor(descriptor)) {
      // All properties from this index onward will be rendered via
      // `Object.defineProperties` to preserve property order.
      break
    }

    const value = descriptor.value as unknown

    if (typeof key == `symbol` && state._customSources.get(key) === null) {
      // Skip properties with omitted symbol keys.
      continue
    }

    const valueResult = unevalInternal(value, state)
    if (valueResult === undefined) {
      // Skip properties with omitted values.
      continue
    }

    const { _source: keySource, _isIdentifier: isIdentifier } =
      unevalObjectLiteralKey(key, state)

    if (valueResult !== null) {
      entries.push({
        _source:
          isIdentifier && keySource == valueResult
            ? keySource
            : `${keySource}:${valueResult}`,
      })
      continue
    }

    const objectName = bindingName(object, state)
    const valueName = bindingName(value as object, state)
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
              },configurable:!0,enumerable:!0,writable:!0})`,
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
      _source: `${keySource}:null`,
      _mutation: () => mutation,
    })
  }

  const firstDescriptorIndex = keyIndex
  if (firstDescriptorIndex < keys.length) {
    for (; keyIndex < keys.length; keyIndex++) {
      const key = keys[keyIndex]!
      const descriptor = descriptors[keyIndex]!
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
  key: string | symbol,
  descriptor: PropertyDescriptor,
  object: object,
  state: State,
): ObjectEntry => {
  const descriptorEntrySources: string[] = []

  let isCircular: true | undefined
  let isGetSet: true | undefined
  for (const key of UNKNOWN_DESCRIPTOR_KEYS) {
    if (!(key in descriptor)) {
      continue
    }

    const value = descriptor[key] as unknown
    if (key != `value`) {
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
    if (result === undefined) {
      // Skip properties with omitted values.
      continue
    }
    if (result === null) {
      isCircular = true
      result = bindingName(value as object, state)
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
      const objectName = bindingName(object, state)

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
  | { _isCircular?: never }
  | { _isCircular: true; _mutation: (hasPlaceholder: boolean) => Mutation }
)

const unevalObjectLiteralKey = (
  key: string | symbol,
  state: State,
): { _source: string; _isIdentifier?: boolean } => {
  if (
    typeof key == `symbol` ||
    // `{ ['__proto__']: ...}` is a hack for setting `__proto__` as an own
    // property rather than setting `Object.prototype`.
    key == __PROTO__
  ) {
    return {
      _source: `[${(key == __PROTO__ ? unevalWithoutCustom : unevalInternal)(
        key,
        state,
      )!}]`,
    }
  }

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
      _source: isNumericKey ? key : unevalWithoutCustom(key, state),
    }
  }

  if (PROPERTY_REG_EXP.test(key)) {
    return { _source: key, _isIdentifier: true }
  }

  return { _source: unevalWithoutCustom(key, state) }
}

export const isDefaultObjectPrototype = (value: unknown): boolean =>
  value == Object.prototype ||
  (isObject(value) &&
    ownKeysString(value) == DEFAULT_OBJECT_PROTOTYPE_KEYS_STRING)

export const isObject = (value: unknown): value is object => {
  const type = typeof value
  return (type == `object` && !!value) || type == `function`
}

const ownKeysString = (value: object) =>
  Object.getOwnPropertyNames(value).sort().join(`\0`)

const __PROTO__ = `__proto__`
const DEFAULT_OBJECT_PROTOTYPE_KEYS_STRING = ownKeysString(Object.prototype)

const BOOLEAN_DESCRIPTOR_KEYS = [
  `configurable`,
  `enumerable`,
  `writable`,
] as const
const UNKNOWN_DESCRIPTOR_KEYS = [`value`, `get`, `set`] as const
