import terser from '@rollup/plugin-terser'
import treeShakeable from 'rollup-plugin-tree-shakeable'
import { defineConfig } from 'tsdown/config'

export default defineConfig([
  {
    entry: `src/index.ts`,
    platform: `neutral`,
    sourcemap: `inline`,
    dts: false,
    publint: true,
    plugins: [
      terser({
        mangle: {
          properties: {
            regex: `^_[^_]+`,
          },
        },
      }),
      treeShakeable(),
    ],
  },
  {
    entry: `src/index.ts`,
    dts: { emitDtsOnly: true },
  },
])
