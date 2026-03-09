// For smaller bundle size.
/* eslint-disable eqeqeq */

import { isObject, unevalObject } from './object.ts'
import {
  unevalBigint,
  unevalBoolean,
  unevalNumber,
  unevalString,
  unevalSymbol,
} from './primitive.ts'
import type { State } from './types.ts'

export const unevalWithoutCustom = ((
  value: unknown,
  state: State,
): string | null => unevalInternal(value, state, false)!) as {
  (
    value: string | number | boolean | bigint | symbol | null | undefined,
    state: State,
  ): string
  (value: unknown, state: State): string | null
}

export const unevalInternal = ((
  value: unknown,
  state: State,
  withoutCustom = true,
): string | null | undefined => {
  // Don't check the custom source for objects now because we may need to create
  // a binding in `unevalObject`.
  if (withoutCustom && !isObject(value)) {
    const customSource = state._customSources.get(value)
    if (customSource === null) {
      // The user decided to omit this value.
      return undefined
    }
    if (customSource !== undefined) {
      // The user provided a custom source for this value.
      return customSource
    }
  }

  const type = typeof value
  if (type == `undefined`) {
    return `void 0`
  } else if (type == `boolean`) {
    return unevalBoolean(value as boolean)
  } else if (type == `number`) {
    return unevalNumber(value as number)
  } else if (type == `bigint`) {
    return unevalBigint(value as bigint)
  } else if (type == `string`) {
    return unevalString(value as string)
  } else if (type == `symbol`) {
    return unevalSymbol(value as symbol, state)
  } else {
    return value == null ? `null` : unevalObject(value, state, withoutCustom)
  }
}) as {
  (
    value: string | number | boolean | bigint | symbol | null | undefined,
    state: State,
    withoutCustom?: boolean,
  ): string | undefined
  (
    value: unknown,
    state: State,
    withoutCustom?: boolean,
  ): string | null | undefined
}
