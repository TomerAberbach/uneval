import { fc } from '@fast-check/vitest'
import * as devalue from 'devalue'
import jsesc from 'jsesc'
import serializeJavaScript from 'serialize-javascript'
import toSource from 'tosource'
import { bench } from 'vitest'
import { anythingArb } from './arbs.ts'
import srcify from './index.ts'

const values = fc.sample(anythingArb, { seed: 42, numRuns: 5000 })

bench(`srcify`, () => {
  for (const value of values) {
    srcify(value)
  }
})

bench(`devalue`, () => {
  for (const value of values) {
    devalue.uneval(value)
  }
})

bench(`jsesc`, () => {
  for (const value of values) {
    jsesc(value)
  }
})

bench(`serialize-javascript`, () => {
  for (const value of values) {
    serializeJavaScript(value)
  }
})

bench(`tosource`, () => {
  for (const value of values) {
    toSource(value)
  }
})
