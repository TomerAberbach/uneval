import { bindingName, newInstance, PROPERTY_REG_EXP } from './common.ts'
import { unevalInternal } from './index.ts'
import type { Uneval } from './types.ts'

export const unevalError: Uneval<Error> = (error, state, _name) => {
  let constructorName = (error.constructor as { name?: string } | undefined)
    ?.name
  if (!constructorName || !PROPERTY_REG_EXP.test(constructorName)) {
    constructorName = `Error`
  }

  let errorSource: string
  const messageSource = Object.hasOwn(error, `message`)
    ? unevalInternal(error.message, state)
    : undefined
  if (Object.hasOwn(error, `cause`)) {
    const causeResult = unevalInternal(error.cause, state)
    if (causeResult === undefined) {
      errorSource = newInstance(constructorName, messageSource)
    } else if (causeResult === null) {
      // Cause is circular. Add a mutation to attach it after construction.
      const errorName = bindingName(error, state)
      const causeName = bindingName(error.cause as object, state)
      const causeEnumerable = Object.getOwnPropertyDescriptor(
        error,
        `cause`,
      )!.enumerable
      state._mutations.push(
        causeEnumerable
          ? {
              _source: `${errorName}.cause=${causeName}`,
              _evaluatesTo: causeName,
            }
          : {
              _source: `Object.defineProperty(${errorName},"cause",{value:${causeName},writable:!0,configurable:!0})`,
              _evaluatesTo: errorName,
            },
      )
      errorSource = newInstance(constructorName, messageSource)
    } else {
      errorSource = newInstance(
        constructorName,
        `${messageSource ?? `void 0`},{cause:${causeResult}}`,
      )
    }
  } else {
    errorSource = newInstance(constructorName, messageSource)
  }

  if (!Object.hasOwn(error, `stack`)) {
    return errorSource
  }

  const stackSource = unevalInternal(error.stack, state)
  if (stackSource === undefined) {
    return errorSource
  }

  return `Object.assign(${errorSource},{stack:${stackSource}})`
}
