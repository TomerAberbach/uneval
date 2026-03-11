// For smaller bundle size.
/* eslint-disable unicorn/prefer-number-properties */

import { bindingName, newInstance } from './common.ts'
import { unevalInternal } from './index.ts'
import type { State, Uneval } from './types.ts'

export const unevalArray: Uneval<unknown[]> = (array, state) => {
  const indices = state._cache.get(array)!._keys!.map(key => +key)

  const hasTrailingEmptySlots = !(array.length - 1 in array)
  const emptyArraySource = hasTrailingEmptySlots
    ? // We'll have to set the length explicitly if there's no entry that
      // implicitly grows the array to its length.
      `Array(${array.length})`
    : `[]`

  // A comma for each sparse slot in a dense array.
  const denseOverhead = array.length - indices.length
  // A `${index}: ,` for each non-sparse slot in a sparse array.
  const maxIndexLength = `${array.length}`.length
  const entryOverhead = (maxIndexLength + 2) * indices.length
  const sparseOverhead =
    unevalObjectAssign(emptyArraySource).length + entryOverhead
  if (sparseOverhead < denseOverhead) {
    // The array is sparse enough that the `Object.assign` representation is
    // likely more compact.
    const entriesSource = indices
      .flatMap(index => {
        const item = array[index]
        const result = unevalInternal(item, state)
        if (result) {
          return `${index}:${result}`
        }

        if (result === null) {
          const itemName = bindingName(item as object, state)
          state._mutations.push({
            _source: `${bindingName(array, state)}[${index}]=${itemName}`,
            _evaluatesTo: itemName,
          })
        }
        return []
      })
      .join()
    return entriesSource
      ? unevalObjectAssign(`${emptyArraySource},{${entriesSource}}`)
      : emptyArraySource
  }

  let trailingEmptySlot: boolean | undefined
  const itemSources = Array.from(array, (item, index) => {
    if (!(index in array)) {
      trailingEmptySlot = true
      return ``
    }

    trailingEmptySlot = false
    const result = unevalInternal(item, state)
    if (result) {
      return result
    }

    if (result === null) {
      const itemName = bindingName(item as object, state)
      state._mutations.push({
        _source: `${bindingName(array, state)}[${index}]=${itemName}`,
        // An assignment evaluates to the right-hand side.
        _evaluatesTo: itemName,
      })
    } else {
      // Omitted value. Render it as an empty slot.
      trailingEmptySlot = true
    }
    return ``
  })
  if (trailingEmptySlot) {
    // The array has a trailing empty slot (either sparse input or custom
    // omitted). This requires an extra comma because otherwise the last
    // comma is interpreted as a no-op trailing comma.
    itemSources.push(``)
  }
  return `[${itemSources.join()}]`
}

const unevalObjectAssign = (args: string) => `Object.assign(${args})`

export const unevalSet: Uneval<Set<unknown>> = (set, state, name) => {
  let foundCircular: true | undefined
  const argSources: string[] = []
  for (const value of set) {
    // If we've seen a circular value, then all remaining values will end
    // up in mutations so we uneval them without the current binding to not
    // add unnecessary dependencies to the current binding.
    let result = (foundCircular ? unevalWithoutCurrentBinding : unevalInternal)(
      value,
      state,
    )
    if (result === undefined) {
      // Skip if omitted.
      continue
    }
    if (result === null) {
      foundCircular = true
      result = bindingName(value as object, state)
    }

    if (!foundCircular) {
      argSources.push(result)
      continue
    }

    // After and including the first circular value, we add set values
    // via mutation to preserve iteration order.
    const valueName = bindingName(set, state)
    state._mutations.push({
      _source: `${valueName}.add(${result})`,
      // `Set.add` always returns `this`.
      _evaluatesTo: valueName,
    })
  }

  const argsSource = argSources.join()
  return newInstance(name, argsSource && `[${argsSource}]`)
}

export const unevalMap: Uneval<Map<unknown, unknown>> = (map, state, name) => {
  let foundCircularKey: true | undefined
  const argSources: string[] = []
  for (const [key, value] of map) {
    // If we've seen a circular key, then all remaining entries will end
    // up in mutations so we uneval them without the current binding to
    // not add unnecessary dependencies to the current binding.
    const keyResult = (
      foundCircularKey ? unevalWithoutCurrentBinding : unevalInternal
    )(key, state)
    if (keyResult === null) {
      foundCircularKey = true
    }
    const valueResult = (
      foundCircularKey ? unevalWithoutCurrentBinding : unevalInternal
    )(value, state)
    if (keyResult === undefined || valueResult === undefined) {
      // Skip the entire entry if key or value is omitted.
      continue
    }

    const keySource = keyResult ?? bindingName(key as object, state)
    const valueSource = valueResult ?? bindingName(value as object, state)

    if (
      // After and including the first circular key, we add entries via
      // mutation below to preserve iteration order.
      !foundCircularKey &&
      valueResult != null
    ) {
      argSources.push(`[${keySource},${valueSource}]`)
      continue
    }

    const valueName = bindingName(map, state)
    state._mutations.push({
      _source: `${valueName}.set(${keySource},${valueSource})`,
      // `Map.set` always returns `this`.
      _evaluatesTo: valueName,
    })
    if (!foundCircularKey) {
      // If the value is circular, but we've not seen a circular key, then
      // include the key in the constructor, but set the value later via
      // mutation.
      argSources.push(`[${keySource}]`)
    }
  }

  const argsSource = argSources.join()
  return newInstance(name, argsSource && `[${argsSource}]`)
}

const unevalWithoutCurrentBinding = (
  value: unknown,
  state: State,
): string | null | undefined => {
  const previousBinding = state._currentBinding
  state._currentBinding = undefined
  const result = unevalInternal(value, state)
  state._currentBinding = previousBinding
  return result
}
