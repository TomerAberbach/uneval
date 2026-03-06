import assert from 'node:assert'
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { findPackageJSON } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { JsonTestResults } from 'vitest/reporters'
import { unevals } from '../src/testing/package.ts'

const writeOrCheckComparisonTable = () => {
  const packageStatsByCategory = computePackageStatsByCategory()
  const comparisonTable = generateComparisonTable(packageStatsByCategory)

  const readme = readFileSync(readmePath, `utf8`)
  const newContent = [
    `<!-- COMPARISON TABLE START -->`,
    comparisonTable,
    `<!-- COMPARISON TABLE END -->`,
  ].join(`\n\n`)
  const newReadme = readme.replace(
    /<!-- COMPARISON TABLE START -->[\s\S]*?<!-- COMPARISON TABLE END -->/u,
    newContent,
  )

  if (!process.argv.includes(`--check`)) {
    writeFileSync(readmePath, newReadme)
    console.log(`✅ Comparison table updated`)
  } else if (readme === newReadme) {
    console.log(`✅ Comparison table is up-to-date`)
  } else {
    console.error(
      `❌ Comparison table is outdated. Run \`pnpm generate-comparison-table\` to update it`,
    )
    const tmpPath = join(tmpdir(), `readme-generated.md`)
    writeFileSync(tmpPath, newReadme)
    const { stdout } = spawnSync(`diff`, [`-u`, readmePath, tmpPath], {
      encoding: `utf8`,
    })
    console.error(stdout)
    process.exit(1)
  }
}

type Stats = {
  passed: string[]
  failed: string[]
}

const computePackageStatsByCategory = (): Map<string, Map<string, Stats>> => {
  const packageStatsByCategory = new Map<string, Map<string, Stats>>()

  for (const pkg of packages) {
    const jsonOutput = JSON.parse(
      spawnSync(vitestBinPath, [`run`, `--reporter=json`, testPath], {
        cwd: rootDirectoryPath,
        env: {
          ...process.env,
          UNEVAL_COMPARISON: `true`,
          UNEVAL_PACKAGE: pkg,
        },
        encoding: `utf8`,
      }).stdout,
    ) as JsonTestResults
    assert(jsonOutput.testResults.length === 1)

    for (const assertionResult of jsonOutput.testResults[0]!.assertionResults) {
      if (
        assertionResult.ancestorTitles.length === 0 ||
        (assertionResult.status !== `passed` &&
          assertionResult.status !== `failed`)
      ) {
        continue
      }

      const category = assertionResult.ancestorTitles[0]!
      let statsByPackage = packageStatsByCategory.get(category)
      if (!statsByPackage) {
        statsByPackage = new Map()
        packageStatsByCategory.set(category, statsByPackage)
      }

      let packageStats = statsByPackage.get(pkg)
      if (!packageStats) {
        packageStats = { passed: [], failed: [] }
        statsByPackage.set(pkg, packageStats)
      }

      const testName = assertionResult.title.replace(
        /^uneval '(?<name>.*)'/u,
        `$<name>`,
      )
      packageStats[assertionResult.status].push(testName)
    }
  }

  return packageStatsByCategory
}

const generateComparisonTable = (
  packageStatsByCategory: Map<string, Map<string, Stats>>,
): string => {
  const columns = packages.map(pkg =>
    pkg === `@tomer/uneval` ? `<code>${pkg}</code>` : packageLink(pkg),
  )

  const lineNumbers = computeLineNumbers()
  const { repository } = JSON.parse(
    readFileSync(join(rootDirectoryPath, `package.json`), `utf8`),
  ) as { repository: string }

  const headerCells = [
    `<th>Category</th>`,
    ...columns.map(col => `<th>${col}</th>`),
  ].join(``)
  const rows = Array.from(
    packageStatsByCategory,
    ([category, statsByPackage]) => {
      const lineNumber = lineNumbers.get(category)
      assert(lineNumber, category)
      const dataCells = Array.from(
        statsByPackage.values(),
        stats => `<td>${statsCell(stats, { lineNumbers, repository })}</td>`,
      ).join(``)
      return `<tr><td>${githubCodeLink({
        content: category,
        repository,
        lineNumber,
      })}${dataCells}</td></tr>`
    },
  )

  return [`<table>`, `<tr>${headerCells}</tr>`, ...rows, `</table>`].join(`\n`)
}

const statsCell = (
  { passed, failed }: Stats,
  {
    repository,
    lineNumbers,
  }: { repository: string; lineNumbers: Map<string, number> },
): string => {
  const total = passed.length + failed.length
  const summary = `${emoji(passed.length, total)} ${passed.length}/${total}`
  if (total === 1) {
    return summary
  }

  const testLines = [
    ...passed.map(name => {
      const lineNumber = lineNumbers.get(name)
      assert(lineNumber, name)
      return `✅ ${githubCodeLink({ content: name, repository, lineNumber })}`
    }),
    ...failed.map(name => {
      const lineNumber = lineNumbers.get(name)
      assert(lineNumber, name)
      return `❌ ${githubCodeLink({ content: name, repository, lineNumber })}`
    }),
  ].join(`<br>`)
  return `<details><summary>${summary}</summary>${testLines}</details>`
}

const githubCodeLink = ({
  content,
  repository,
  lineNumber,
}: {
  content: string
  repository: string
  lineNumber: number
}): string =>
  `<a href="https://github.com/${
    repository
  }/blob/main/src/index.test.ts#L${lineNumber}"><code>${escapeHtml(
    content,
  )}</code></a>`

const computeLineNumbers = (): Map<string, number> => {
  const testFileLines = readFileSync(testPath, `utf8`).split(`\n`)
  const lineNumbers = new Map<string, number>()

  for (const [index, line] of testFileLines.entries()) {
    const match =
      /^ {2}'?(?<name>[\w/ ]+)'?: \[/iu.exec(line) ??
      /name: `(?<name>[^`]+)`,/iu.exec(line)
    if (!match) {
      continue
    }

    const name = match.groups!.name!
    if (lineNumbers.has(name)) {
      continue
    }

    const lineNumber = index + 1
    lineNumbers.set(name, lineNumber)
  }

  return lineNumbers
}

const packageLink = (pkg: string): string => {
  const version = (
    JSON.parse(
      readFileSync(findPackageJSON(pkg, import.meta.url)!, `utf8`),
    ) as Record<string, unknown>
  ).version as string
  return `<a href="https://npm.im/package/${pkg}/v/${version}"><code>${escapeHtml(pkg)}@${version}</code></a>`
}

const escapeHtml = (str: string): string =>
  str.replaceAll(`&`, `&amp;`).replaceAll(`<`, `&lt;`).replaceAll(`>`, `&gt;`)

const emoji = (passed: number, total: number): string => {
  const percentage = passed / total
  if (percentage === 0) {
    return `❌`
  }
  if (percentage <= 0.25) {
    return `🔴`
  }
  if (percentage <= 0.5) {
    return `🟠`
  }
  if (percentage <= 0.75) {
    return `🟡`
  }
  if (percentage < 1) {
    return `🟢`
  }
  return `✅`
}

const packages = Object.keys(unevals)
const rootDirectoryPath = join(import.meta.dirname, `..`)
const vitestBinPath = join(rootDirectoryPath, `node_modules/.bin/vitest`)
const testPath = join(rootDirectoryPath, `src/index.test.ts`)
const readmePath = join(rootDirectoryPath, `readme.md`)

writeOrCheckComparisonTable()
