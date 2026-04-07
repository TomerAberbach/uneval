import { spawnSync } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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

const readme = readFileSync(join(rootDir, `readme.md`), `utf8`)
// Just use the summary for the npm readme. Otherwise npm truncates it for being
// too large.
const npmReadme = readme.replaceAll(
  // eslint-disable-next-line prefer-named-capture-group
  /<details><summary>(.*?)<\/summary>[\s\S]*?<\/details>/gu,
  `$1`,
)
writeFileSync(join(tmpDir, `readme.md`), npmReadme)

run(`pnpm`, [`pack`, `--pack-destination`, rootDir], tmpDir)
