import { assertWithinNpmLimit, readReadme, toNpmReadme } from './npm-readme.ts'

const readme = readReadme()

if (process.argv.includes(`--raw`)) {
  assertWithinNpmLimit(readme, {
    label: `readme.md`,
    hint: `Publish the tarball produced by \`pnpm pack:npm\` instead, which ships a readme with collapsed \`<details>\` blocks`,
  })
} else {
  assertWithinNpmLimit(toNpmReadme(readme), { label: `npm readme` })
}
