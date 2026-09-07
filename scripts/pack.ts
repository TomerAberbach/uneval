import { spawnSync } from 'node:child_process'
import { cpSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assertWithinNpmLimit, readReadme, toNpmReadme } from './npm-readme.ts'

const rootDir = join(import.meta.dirname, `..`)

const run = (cmd: string, args: string[], cwd = rootDir) => {
  const result = spawnSync(cmd, args, { cwd, stdio: `inherit` })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

run(`pnpm`, [`build`])

const tmpDir = mkdtempSync(join(tmpdir(), `uneval-pack-`))

cpSync(join(rootDir, `dist`), join(tmpDir, `dist`), { recursive: true })
cpSync(join(rootDir, `package.json`), join(tmpDir, `package.json`))
cpSync(join(rootDir, `license`), join(tmpDir, `license`))

const npmReadme = toNpmReadme(readReadme())
assertWithinNpmLimit(npmReadme, { label: `npm readme` })
writeFileSync(join(tmpDir, `readme.md`), npmReadme)

run(`pnpm`, [`pack`, `--pack-destination`, rootDir], tmpDir)
