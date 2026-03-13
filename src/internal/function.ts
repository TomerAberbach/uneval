import { bindingName } from './common.ts'
import { unevalInternal } from './index.ts'
import type { State } from './types.ts'

export const unevalArguments = (args: IArguments, state: State): string =>
  `(function(){return arguments})(${Array.from(args, (arg, index) => {
    const result = unevalInternal(arg, state)
    if (result === undefined) {
      state._mutations.push({
        _source: `delete ${bindingName(args, state)}[${index}]`,
      })
      return `0`
    } else if (result === null) {
      const argName = bindingName(arg as object, state)
      state._mutations.push({
        _source: `${bindingName(args, state)}[${index}]=${argName}`,
        _evaluatesTo: argName,
      })
      return `0`
    } else {
      return result
    }
  }).join()})`
