import { bench } from 'vitest'
import srcify from './index.ts'

bench(`srcify`, () => {
  srcify()
})
