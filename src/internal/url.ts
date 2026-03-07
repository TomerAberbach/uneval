import { newInstance } from './common.ts'
import { unevalInternal } from './index.ts'
import type { Uneval } from './types.ts'

export const unevalURL: Uneval<URL | URLSearchParams> = (url, state, name) => {
  // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
  const source = `${url}`
  return newInstance(name, source && unevalInternal(source, state))
}
