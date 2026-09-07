import { writeFile } from 'node:fs/promises'
import { Session } from 'node:inspector/promises'
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
const session = new Session()
session.connect()
await session.post(`Profiler.enable`)
await session.post(`Profiler.start`)

for (let i = 0; i < 1000; i++) {
  for (const value of values) {
    uneval(value)
  }
}

const { profile } = await session.post(`Profiler.stop`)
await writeFile(`profile.cpuprofile`, JSON.stringify(profile))
session.disconnect()
