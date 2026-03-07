import type { State } from './types.ts'

export const newInstance = (name: string, args: string | number = ``): string =>
  `new ${name}${args === `` ? `` : `(${args})`}`

export const bindingName = (value: object, state: State): string =>
  state._bindings.get(value)!._name

export const PROPERTY_REG_EXP = /^[$_\p{ID_Start}][$_\p{ID_Continue}]*$/u
