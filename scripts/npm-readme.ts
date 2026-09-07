import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// The npm registry truncates a package readme at this many Unicode code points
// (not bytes or UTF-16 code units).
export const NPM_README_LIMIT = 65_536

export const readmePath = join(import.meta.dirname, `..`, `readme.md`)

export const readReadme = (): string => readFileSync(readmePath, `utf8`)

// Collapses each `<details>` block in the readme to its summary.
export const toNpmReadme = (readme: string): string =>
  readme.replaceAll(
    /<details><summary>(?<summary>.*?)<\/summary>[\s\S]*?<\/details>/gu,
    `$<summary>`,
  )

export const countCodePoints = (string: string): number => {
  let count = 0
  for (const _ of string) {
    count++
  }
  return count
}

// Exits with an error if the readme content exceeds the npm limit.
export const assertWithinNpmLimit = (
  content: string,
  { label, hint }: { label: string; hint?: string },
): void => {
  const size = countCodePoints(content)
  if (size <= NPM_README_LIMIT) {
    console.log(
      `✅ ${label} is ${size.toLocaleString()} code points (limit ${NPM_README_LIMIT.toLocaleString()})`,
    )
    return
  }

  console.error(
    `❌ ${label} is ${size.toLocaleString()} code points, but npm truncates readmes at ${NPM_README_LIMIT.toLocaleString()}`,
  )
  if (hint) {
    console.error(hint)
  }
  process.exit(1)
}
