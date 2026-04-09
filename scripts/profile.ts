import fc from 'fast-check'
import uneval from '../src/index.ts'

const values = fc.sample(fc.anything(), { seed: 42, numRuns: 5000 })

// Warmup to let V8 JIT optimize before profiling starts.
for (let i = 0; i < 20; i++) {
  for (const value of values) {
    uneval(value)
  }
}

// Profile run. Many iterations to get good signal.
for (let i = 0; i < 100; i++) {
  for (const value of values) {
    uneval(value)
  }
}
