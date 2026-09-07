import assert from 'node:assert'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { findPackageJSON } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { JsonTestResults } from 'vitest/node'
import { unevals } from '../src/testing/package.ts'

const writeOrCheckTables = () => {
  const readme = readFileSync(readmePath, `utf8`)
  const comparison = readFileSync(comparisonPath, `utf8`)
  const packageStatsByCategory = computePackageStatsByCategory()
  const comparisonTable = generateComparisonTable(packageStatsByCategory)
  const comparisonChanges = describeChanges(comparison, packageStatsByCategory)
  const benchmarkDigest = computeBenchmarkDigest()

  if (!process.argv.includes(`--check`)) {
    const benchmarkTable = generateBenchmarkTable(runBenchmark(), {
      packageStatsByCategory,
      digest: benchmarkDigest,
    })
    writeFileSync(
      comparisonPath,
      replaceComparisonTable(comparison, comparisonTable),
    )
    writeFileSync(readmePath, replaceBenchmarkTable(readme, benchmarkTable))
    console.log(`✅ Comparison table updated`)
    console.log(comparisonChanges)
    console.log(`✅ Benchmark table updated`)
    return
  }

  let outdated = false

  if (comparison === replaceComparisonTable(comparison, comparisonTable)) {
    console.log(`✅ Comparison table is up-to-date`)
  } else {
    outdated = true
    console.error(
      `❌ Comparison table is outdated. Run \`pnpm generate-comparison-table\` to update it`,
    )
    console.error(comparisonChanges)
  }

  // The benchmark's numbers vary between runs, so instead of comparing the
  // table's contents, compare a digest of the inputs that determine them.
  const embeddedDigest = readEmbeddedBenchmarkDigest(readme)
  if (embeddedDigest === benchmarkDigest) {
    console.log(`✅ Benchmark table is up-to-date`)
  } else {
    outdated = true
    console.error(
      `❌ Benchmark table is outdated. Run \`pnpm generate-comparison-table\` to update it`,
    )
    console.error(
      `  embedded: ${embeddedDigest ?? `none`}\n  expected: ${benchmarkDigest}`,
    )
  }

  if (outdated) {
    process.exit(1)
  }
}

const replaceComparisonTable = (
  comparison: string,
  comparisonTable: string,
): string =>
  comparison.replace(
    /<!-- COMPARISON TABLE START -->[\s\S]*?<!-- COMPARISON TABLE END -->/u,
    [
      `<!-- COMPARISON TABLE START -->`,
      comparisonTable,
      `<!-- COMPARISON TABLE END -->`,
    ].join(`\n\n`),
  )

const replaceBenchmarkTable = (
  readme: string,
  benchmarkTable: string,
): string =>
  readme.replace(
    /<!-- BENCHMARK TABLE START -->[\s\S]*?<!-- BENCHMARK TABLE END -->/u,
    [
      `<!-- BENCHMARK TABLE START -->`,
      benchmarkTable,
      `<!-- BENCHMARK TABLE END -->`,
    ].join(`\n\n`),
  )

type Cell = {
  passed: number
  total: number
  statuses: Map<string, `passed` | `failed`>
}

type ParsedTable = {
  versions: Map<string, string>
  cellsByCategory: Map<string, Map<string, Cell>>
}

const describeChanges = (
  comparison: string,
  packageStatsByCategory: Map<string, Map<string, Stats>>,
): string => {
  const previous = parseComparisonTable(comparison)
  const lines: string[] = []

  for (const pkg of packages) {
    const previousVersion = previous.versions.get(pkg)
    const version = packageVersion(pkg)
    if (previousVersion !== undefined && previousVersion !== version) {
      lines.push(`${pkg}: ${previousVersion} → ${version}`)
    }
  }

  for (const [category, statsByPackage] of packageStatsByCategory) {
    for (const [pkg, stats] of statsByPackage) {
      const cell = toCell(stats)
      const previousCell = previous.cellsByCategory.get(category)?.get(pkg)
      if (!previousCell) {
        lines.push(`${category} ${pkg}: new, ${cell.passed}/${cell.total}`)
        continue
      }

      // A single-test cell contains only a summary, so its test is unnamed.
      const testLines = []
      if (previousCell.statuses.size > 0) {
        for (const name of new Set([
          ...previousCell.statuses.keys(),
          ...cell.statuses.keys(),
        ])) {
          const previousStatus = previousCell.statuses.get(name)
          const status = cell.statuses.get(name)
          if (previousStatus !== status) {
            testLines.push(
              `  ${name}: ${previousStatus ?? `new`} → ${status ?? `removed`}`,
            )
          }
        }
      }
      if (
        previousCell.passed !== cell.passed ||
        previousCell.total !== cell.total ||
        testLines.length > 0
      ) {
        lines.push(
          `${category} ${pkg}: ${previousCell.passed}/${previousCell.total} → ${cell.passed}/${cell.total}`,
          ...testLines,
        )
      }
    }
  }

  for (const category of previous.cellsByCategory.keys()) {
    if (!packageStatsByCategory.has(category)) {
      lines.push(`${category}: removed`)
    }
  }

  return lines.length > 0 ? lines.join(`\n`) : `No changes`
}

const toCell = ({ passed, failed }: Stats): Cell => ({
  passed: passed.length,
  total: passed.length + failed.length,
  statuses: new Map([
    ...passed.map(name => [name, `passed`] as const),
    ...failed.map(name => [name, `failed`] as const),
  ]),
})

const parseComparisonTable = (comparison: string): ParsedTable => {
  const versions = new Map<string, string>()
  const cellsByCategory = new Map<string, Map<string, Cell>>()

  const tableMatch =
    /<!-- COMPARISON TABLE START -->(?<table>[\s\S]*?)<!-- COMPARISON TABLE END -->/u.exec(
      comparison,
    )
  if (!tableMatch) {
    return { versions, cellsByCategory }
  }

  const [headerRow, ...dataRows] = Array.from(
    tableMatch.groups!.table!.matchAll(/<tr>(?<row>[\s\S]*?)<\/tr>/gu),
    match => match.groups!.row!,
  )
  if (!headerRow) {
    return { versions, cellsByCategory }
  }

  const columns = headerRow
    .split(`<th>`)
    .slice(1)
    .flatMap(header => {
      const match = /<code>(?<name>.*?)<\/code>/u.exec(header)
      if (!match) {
        return []
      }
      const [pkg, version] = decodeHtml(match.groups!.name!).split(`@`)
      if (version !== undefined) {
        versions.set(pkg!, version)
      }
      return [pkg!]
    })

  for (const row of dataRows) {
    const [categoryCell, ...cells] = row.split(`<td>`).slice(1)
    const category = decodeHtml(
      /<code>(?<name>.*?)<\/code>/u.exec(categoryCell!)!.groups!.name!,
    )
    const cellsByPackage = new Map<string, Cell>()
    for (const [index, cell] of cells.entries()) {
      const summary = /(?<passed>\d+)\/(?<total>\d+)/u.exec(cell)!.groups!
      const statuses = new Map(
        Array.from(
          cell.matchAll(
            /(?<status>✅|❌)\u00A0<a [^>]*><code>(?<name>.*?)<\/code>/gu,
          ),
          match => [
            decodeHtml(match.groups!.name!),
            match.groups!.status === `✅`
              ? (`passed` as const)
              : (`failed` as const),
          ],
        ),
      )
      cellsByPackage.set(columns[index]!, {
        passed: Number(summary.passed),
        total: Number(summary.total),
        statuses,
      })
    }
    cellsByCategory.set(category, cellsByPackage)
  }

  return { versions, cellsByCategory }
}

type Stats = {
  passed: string[]
  failed: string[]
}

const computePackageStatsByCategory = (): Map<string, Map<string, Stats>> => {
  const packageStatsByCategory = new Map<string, Map<string, Stats>>()

  for (const pkg of packages) {
    const outputPath = join(tmpdir(), `uneval-comparison-${pkg}.json`)
    spawnSync(
      vitestBinPath,
      [`run`, `--reporter=json`, `--outputFile=${outputPath}`, testPath],
      {
        cwd: rootDirectoryPath,
        env: {
          ...process.env,
          UNEVAL_COMPARISON: `true`,
          UNEVAL_PACKAGE: pkg,
        },
        encoding: `utf8`,
      },
    )
    const jsonOutput = JSON.parse(
      readFileSync(outputPath, `utf8`),
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

const sortPackagesByPassCount = (
  packageStatsByCategory: Map<string, Map<string, Stats>>,
): string[] => {
  const passCount = (pkg: string): number =>
    Array.from(packageStatsByCategory.values(), statsByPackage =>
      statsByPackage.get(pkg)!,
    ).reduce((count, { passed }) => count + passed.length, 0)
  return packages.toSorted(
    (package1, package2) => passCount(package2) - passCount(package1),
  )
}

const generateComparisonTable = (
  packageStatsByCategory: Map<string, Map<string, Stats>>,
): string => {
  const sortedPackages = sortPackagesByPassCount(packageStatsByCategory)

  const columns = sortedPackages.map(
    pkg =>
      `${
        pkg === `uneval` ? `<code>${noBreak(pkg)}</code>` : packageLink(pkg)
      }<br>${packageBundleSizeBadge(pkg)}`,
  )

  const lineNumbers = computeLineNumbers()

  const headerCells = [
    `<th>Category</th>`,
    ...columns.map(col => `<th>${col}</th>`),
  ].join(``)
  const rows = Array.from(
    packageStatsByCategory,
    ([category, statsByPackage]) => {
      const lineNumber = lineNumbers.get(category)
      assert(lineNumber, category)
      const dataCells = sortedPackages
        .map(
          pkg =>
            `<td>${statsCell(statsByPackage.get(pkg)!, { lineNumbers })}</td>`,
        )
        .join(``)
      return `<tr><td>${githubCodeLink({
        content: category,
        lineNumber,
      })}</td>${dataCells}</tr>`
    },
  )

  return [`<table>`, `<tr>${headerCells}</tr>`, ...rows, `</table>`].join(`\n`)
}

const statsCell = (
  { passed, failed }: Stats,
  { lineNumbers }: { lineNumbers: Map<string, number> },
): string => {
  const total = passed.length + failed.length
  const summary = `${emoji(passed.length, total)}\u00A0${passed.length}/${total}`
  if (total === 1) {
    return summary
  }

  const testLines = [
    ...passed.map(name => {
      const lineNumber = lineNumbers.get(name)
      assert(lineNumber, name)
      return `✅\u00A0${githubCodeLink({ content: name, lineNumber })}`
    }),
    ...failed.map(name => {
      const lineNumber = lineNumbers.get(name)
      assert(lineNumber, name)
      return `❌\u00A0${githubCodeLink({ content: name, lineNumber })}`
    }),
  ].join(`<br>`)
  return `<details><summary>${summary}</summary>${testLines}</details>`
}

const githubCodeLink = ({
  content,
  lineNumber,
}: {
  content: string
  lineNumber: number
}): string =>
  `<a href="../src/index.test.ts#L${lineNumber}"><code>${noBreak(
    escapeHtml(content),
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

const packageVersion = (pkg: string): string =>
  (
    JSON.parse(
      readFileSync(findPackageJSON(pkg, import.meta.url)!, `utf8`),
    ) as Record<string, unknown>
  ).version as string

const packageLink = (pkg: string): string => {
  const version = packageVersion(pkg)
  const link = `<a href="https://npm.im/package/${pkg}/v/${version}"><code>${noBreak(
    escapeHtml(pkg),
  )}@${noBreak(escapeHtml(version))}</code></a>`
  return `${link}${pkg === `seroval` ? `&nbsp;(sync)` : ``}`
}

const packageBundleSizeBadge = (pkg: string): string =>
  `<img src="https://deno.bundlejs.com/?q=${encodeURIComponent(
    pkg,
  )}&badge" alt="${noBreak(`${pkg} gzip size`)}" />`

const escapeHtml = (string: string): string =>
  string
    .replaceAll(`&`, `&amp;`)
    .replaceAll(`<`, `&lt;`)
    .replaceAll(`>`, `&gt;`)

const decodeHtml = (html: string): string =>
  html
    .replaceAll(`\u2060`, ``)
    .replaceAll(`\u00A0`, ` `)
    .replaceAll(`&lt;`, `<`)
    .replaceAll(`&gt;`, `>`)
    .replaceAll(`&amp;`, `&`)

const noBreak = (html: string): string =>
  html
    .replaceAll(`-`, `\u2060-\u2060`)
    .replaceAll(`/`, `\u2060/\u2060`)
    .replaceAll(`.`, `\u2060.\u2060`)
    .replaceAll(` `, `\u00A0`)

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

type BenchmarkTask = {
  name: string
  hz: number
  mean: number
  rme: number
}

const runBenchmark = (): Map<string, BenchmarkTask> => {
  const outputPath = join(tmpdir(), `uneval-benchmark.json`)
  spawnSync(
    vitestBinPath,
    [
      `bench`,
      `--reporter=verbose`,
      `--reporter=json`,
      `--outputFile.json=${outputPath}`,
      benchPath,
    ],
    {
      cwd: rootDirectoryPath,
      env: { ...process.env, UNEVAL_BUILT: `true` },
      stdio: `inherit`,
    },
  )
  const jsonOutput = JSON.parse(
    readFileSync(outputPath, `utf8`),
  ) as JsonTestResults
  assert(jsonOutput.success)

  const benchmarks = jsonOutput.testResults.flatMap(testResult =>
    testResult.assertionResults.flatMap(
      assertionResult => assertionResult.benchmarks,
    ),
  )
  assert(benchmarks.length === 1)

  const tasks = benchmarks[0]!.tasks.map(
    ({ name, latency, throughput }): BenchmarkTask => ({
      name,
      hz: throughput.mean,
      mean: latency.mean,
      rme: latency.rme,
    }),
  )
  assert(
    new Set(tasks.map(task => task.name)).symmetricDifference(new Set(packages))
      .size === 0,
  )
  return new Map(tasks.map(task => [task.name, task]))
}

// The benchmark's numbers vary between runs, so the table embeds a digest of
// the inputs that determine them: the built package the benchmark runs, the
// benchmark itself, the other packages' adapters, and the other packages'
// versions.
const computeBenchmarkDigest = (): string => {
  spawnSync(tsdownBinPath, [], { cwd: rootDirectoryPath, stdio: `inherit` })

  const hash = createHash(`sha256`)
  for (const path of [distPath, benchPath, adaptersPath]) {
    hash.update(readFileSync(path))
  }

  for (const pkg of packages.toSorted()) {
    if (pkg !== `uneval`) {
      hash.update(`${pkg}@${packageVersion(pkg)}`)
    }
  }

  return hash.digest(`hex`)
}

const benchmarkDigestPattern =
  /<!-- BENCHMARK DIGEST: (?<digest>[\da-f]{64}) -->/u

const readEmbeddedBenchmarkDigest = (readme: string): string | undefined =>
  benchmarkDigestPattern.exec(readme)?.groups!.digest

// Rows are in the comparison table's order rather than by speed, because
// packages with similar speeds swap places between runs.
const generateBenchmarkTable = (
  tasks: Map<string, BenchmarkTask>,
  {
    packageStatsByCategory,
    digest,
  }: {
    packageStatsByCategory: Map<string, Map<string, Stats>>
    digest: string
  },
): string => {
  const testCounts = (pkg: string): { passed: number; total: number } => {
    let passed = 0
    let total = 0
    for (const statsByPackage of packageStatsByCategory.values()) {
      const stats = statsByPackage.get(pkg)!
      passed += stats.passed.length
      total += stats.passed.length + stats.failed.length
    }
    return { passed, total }
  }

  const fastest = [...tasks.values()].reduce((task1, task2) =>
    task2.hz > task1.hz ? task2 : task1,
  )
  const rows = [
    [
      `Package`,
      `[Tests\u00A0passing](./docs/comparison.md)`,
      `Ops/sec`,
      `Mean`,
      `Relative`,
    ],
    [`:--`, `--:`, `--:`, `--:`, `--:`],
    ...sortPackagesByPassCount(packageStatsByCategory).map(pkg => {
      const task = tasks.get(pkg)!
      const { passed, total } = testCounts(pkg)
      return [
        pkg === `uneval` ? `<code>${noBreak(pkg)}</code>` : packageLink(pkg),
        `${emoji(passed, total)}\u00A0${passed}/${total}`,
        task.hz.toFixed(task.hz < 100 ? 1 : 0),
        `${task.mean.toFixed(2)}ms\u00A0±${task.rme.toFixed(2)}%`,
        task === fastest
          ? `fastest`
          : `${(fastest.hz / task.hz).toFixed(2)}×\u00A0slower`,
      ]
    }),
  ]
  return [
    `<!-- BENCHMARK DIGEST: ${digest} -->`,
    rows.map(row => `| ${row.join(` | `)} |`).join(`\n`),
  ].join(`\n\n`)
}

const packages = Object.keys(unevals)
const rootDirectoryPath = join(import.meta.dirname, `..`)
const vitestBinPath = join(rootDirectoryPath, `node_modules/.bin/vitest`)
const tsdownBinPath = join(rootDirectoryPath, `node_modules/.bin/tsdown`)
const distPath = join(rootDirectoryPath, `dist/index.js`)
const sourceDirectoryPath = join(rootDirectoryPath, `src`)
const testPath = join(sourceDirectoryPath, `index.test.ts`)
const benchPath = join(sourceDirectoryPath, `index.bench.ts`)
const adaptersPath = join(sourceDirectoryPath, `testing/package.ts`)
const readmePath = join(rootDirectoryPath, `readme.md`)
const comparisonPath = join(rootDirectoryPath, `docs/comparison.md`)

writeOrCheckTables()
