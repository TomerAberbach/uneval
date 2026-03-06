// For smaller bundle size.
/* eslint-disable eqeqeq */

import { isObject, unevalObject } from './object.ts'
import {
  STRING_CODE_UNIT_ESCAPES,
  unevalBigint,
  unevalBoolean,
  unevalLiteral,
  unevalNumber,
  unevalSymbol,
} from './primitive.ts'
import type { State } from './types.ts'

export const unevalInternal = ((
  value: unknown,
  state: State,
): string | null | undefined => {
  // Don't check the custom source for objects now because we may need to create
  // a binding in `unevalObject`.
  if (!isObject(value)) {
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
    return `"${unevalLiteral(value as string, STRING_CODE_UNIT_ESCAPES)}"`
  } else if (type == `symbol`) {
    return unevalSymbol(value as symbol, state)
  } else {
    return value == null ? `null` : unevalObject(value, state)
  }
}) as {
  (
    value: string | number | boolean | bigint | symbol | null | undefined,
    state: State,
  ): string | undefined
  (value: unknown, state: State): string | null | undefined
}
