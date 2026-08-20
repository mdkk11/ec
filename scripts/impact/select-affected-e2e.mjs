import { spawnSync } from 'node:child_process'
import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import {
  getChangedFiles,
  normalizeChangedFiles,
} from './select-ci-jobs.mjs'

const DEFAULT_MAP = 'config/impact/e2e-map.json'
const DEFAULT_OUTPUT = '.impact/e2e-selection.json'
const DEFAULT_GRAPH = '.impact/dependency-graph.json'

function globRegex(pattern) {
  let source = '^'
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index]
    if (character === '*' && pattern[index + 1] === '*') {
      source += '.*'
      index += 1
    } else if (character === '*') {
      source += '[^/]*'
    } else {
      source += character.replace(/[|\\{}()[\]^$+?.]/gu, '\\$&')
    }
  }
  return new RegExp(`${source}$`, 'u')
}

export function matchesAny(filePath, patterns) {
  return patterns.some((pattern) => globRegex(pattern).test(filePath))
}

function listE2eSpecs(cwd) {
  return readdirSync(path.join(cwd, 'tests/e2e'))
    .filter((name) => name.endsWith('.spec.ts'))
    .map((name) => `tests/e2e/${name}`)
    .sort()
}

function listProductionFiles(cwd) {
  return readdirSync(path.join(cwd, 'src'), { recursive: true })
    .map((filePath) => `src/${filePath.replaceAll('\\', '/')}`)
    .filter((filePath) => /\.[cm]?[jt]sx?$/u.test(filePath))
}

export function validateCollectedSpecs(specs, output) {
  const missing = specs.filter(
    (spec) => !output.includes(`› ${path.basename(spec)}:`),
  )
  if (missing.length > 0) {
    throw new Error(`Playwright did not collect mapped specs: ${missing.join(', ')}`)
  }
}

export function validateMap(map, { cwd = process.cwd() } = {}) {
  if (map.version !== 1 || !Array.isArray(map.specs)) {
    throw new Error('unsupported or invalid E2E impact map')
  }
  const mappedSpecs = map.specs.map(({ spec }) => spec).sort()
  const discoveredSpecs = listE2eSpecs(cwd)
  if (new Set(mappedSpecs).size !== mappedSpecs.length) {
    throw new Error('E2E impact map contains duplicate specs')
  }
  if (JSON.stringify(mappedSpecs) !== JSON.stringify(discoveredSpecs)) {
    throw new Error(
      `E2E impact map must exactly cover discovered specs: ${discoveredSpecs.join(', ')}`,
    )
  }
  if (!mappedSpecs.includes(map.smokeSpec)) {
    throw new Error('smokeSpec must be present in the E2E impact map')
  }
  const productionFiles = listProductionFiles(cwd)
  for (const entry of map.specs) {
    if (!Array.isArray(entry.roots) || entry.roots.length === 0) {
      throw new Error(`${entry.spec} must declare at least one root`)
    }
    const missingRoots = entry.roots.filter(
      (root) => !productionFiles.some((filePath) => matchesAny(filePath, [root])),
    )
    if (missingRoots.length > 0) {
      throw new Error(`${entry.spec} has unmatched roots: ${missingRoots.join(', ')}`)
    }
  }
  return map
}

function isInternalDependency(dependency) {
  return (
    dependency.module.startsWith('@/') || dependency.module.startsWith('.')
  )
}

export function validateGraph(graph) {
  if (!Array.isArray(graph.modules) || graph.modules.length === 0) {
    throw new Error('dependency graph contains no modules')
  }
  const sources = graph.modules.map(({ source }) => source)
  const sourceSet = new Set(sources)
  if (sourceSet.size !== sources.length) {
    throw new Error('dependency graph contains duplicate modules')
  }
  for (const graphModule of graph.modules) {
    if (!graphModule.source || !Array.isArray(graphModule.dependencies)) {
      throw new Error('dependency graph contains an invalid module')
    }
    for (const dependency of graphModule.dependencies) {
      const allowedStyle = dependency.resolved?.endsWith('.css')
      if (
        isInternalDependency(dependency) &&
        (dependency.couldNotResolve || dependency.followable === false) &&
        !allowedStyle
      ) {
        throw new Error(
          `unresolved internal dependency: ${graphModule.source} -> ${dependency.module}`,
        )
      }
      if (
        isInternalDependency(dependency) &&
        dependency.followable !== false &&
        dependency.resolved &&
        !dependency.resolved.endsWith('.css') &&
        !sourceSet.has(dependency.resolved)
      ) {
        throw new Error(
          `dependency graph is missing a module: ${dependency.resolved}`,
        )
      }
    }
  }
  return graph
}

export function reverseClosure(graph, changedFiles) {
  const reverse = new Map()
  for (const graphModule of graph.modules) {
    for (const dependency of graphModule.dependencies) {
      if (!dependency.resolved) continue
      const dependents = reverse.get(dependency.resolved) ?? []
      dependents.push(graphModule.source)
      reverse.set(dependency.resolved, dependents)
    }
  }
  const impacted = new Set(changedFiles)
  const queue = [...changedFiles]
  while (queue.length > 0) {
    const current = queue.shift()
    for (const dependent of reverse.get(current) ?? []) {
      if (impacted.has(dependent)) continue
      impacted.add(dependent)
      queue.push(dependent)
    }
  }
  return [...impacted].sort()
}

function isSafeIgnore(filePath) {
  return (
    filePath.startsWith('docs/') ||
    filePath.startsWith('.agents/') ||
    ['AGENTS.md', 'CONTEXT.md', 'DESIGN.md', 'README.md'].includes(filePath)
  )
}

function fullSelection(map, changedFiles, fallbackReason) {
  return {
    mode: 'full',
    changedFiles,
    impactedFiles: changedFiles,
    selectedSpecs: map.specs.map(({ spec }) => spec),
    fallbackReason,
  }
}

export function selectAffectedE2e({ map, graph, changedFiles }) {
  const normalized = normalizeChangedFiles(changedFiles)
  if (normalized.length === 0) {
    return fullSelection(map, normalized, 'empty change set')
  }
  const highRisk = normalized.find((filePath) =>
    matchesAny(filePath, map.highRiskPaths),
  )
  if (highRisk) return fullSelection(map, normalized, `high-risk path: ${highRisk}`)

  const moduleSources = new Set(graph.modules.map(({ source }) => source))
  const allRoots = map.specs.flatMap(({ roots }) => roots)
  const unmatched = normalized.find(
    (filePath) =>
      !isSafeIgnore(filePath) &&
      !filePath.endsWith('.spec.ts') &&
      !moduleSources.has(filePath) &&
      !matchesAny(filePath, allRoots),
  )
  if (unmatched) {
    return fullSelection(map, normalized, `unmatched runtime path: ${unmatched}`)
  }

  const runtimeChanges = normalized.filter((filePath) => !isSafeIgnore(filePath))
  const impactedFiles = reverseClosure(graph, runtimeChanges)
  const impactedHighRisk = impactedFiles.find((filePath) =>
    matchesAny(filePath, map.highRiskPaths),
  )
  if (impactedHighRisk) {
    return fullSelection(
      map,
      normalized,
      `dependency reaches high-risk path: ${impactedHighRisk}`,
    )
  }
  const selected = new Set(
    normalized.filter((filePath) => filePath.endsWith('.spec.ts')),
  )
  for (const entry of map.specs) {
    if (impactedFiles.some((filePath) => matchesAny(filePath, entry.roots))) {
      selected.add(entry.spec)
    }
  }
  if (selected.size === 0) {
    return fullSelection(map, normalized, 'no mapped E2E spec was selected')
  }
  selected.add(map.smokeSpec)
  return {
    mode: 'selected',
    changedFiles: normalized,
    impactedFiles,
    selectedSpecs: [...selected].sort(),
    fallbackReason: null,
  }
}

export function generateGraph(cwd = process.cwd()) {
  const result = spawnSync(
    'pnpm',
    [
      'exec',
      'depcruise',
      'src',
      '--config',
      '.dependency-cruiser.cjs',
      '--output-type',
      'json',
      '--progress',
      'none',
    ],
    { cwd, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 },
  )
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || 'dependency-cruiser failed')
  }
  return validateGraph(JSON.parse(result.stdout))
}

export function validatePlaywrightCollection(map, cwd = process.cwd()) {
  const result = spawnSync(
    'pnpm',
    ['exec', 'playwright', 'test', ...map.specs.map(({ spec }) => spec), '--list'],
    { cwd, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
  )
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || 'Playwright test collection failed')
  }
  validateCollectedSpecs(
    map.specs.map(({ spec }) => spec),
    result.stdout,
  )
}

function parseInjectedFiles(value) {
  return value.split(/[\n,\0]/u)
}

function writeSummary(selection, summaryPath) {
  if (!summaryPath) return
  appendFileSync(
    summaryPath,
    [
      '## E2E impact selection',
      '',
      `- mode: ${selection.mode}`,
      `- fallback: ${selection.fallbackReason ?? 'none'}`,
      '',
      '### Selected specs',
      '',
      ...selection.selectedSpecs.map((spec) => `- \`${spec}\``),
      '',
      '### Changed files',
      '',
      ...selection.changedFiles.map((filePath) => `- \`${filePath}\``),
      '',
      '### Impacted modules',
      '',
      ...selection.impactedFiles.map((filePath) => `- \`${filePath}\``),
      '',
    ].join('\n'),
  )
}

export function runCli(env = process.env) {
  const cwd = env.IMPACT_CWD ?? process.cwd()
  const outputPath = path.join(cwd, env.IMPACT_OUTPUT ?? DEFAULT_OUTPUT)
  const graphPath = path.join(cwd, env.IMPACT_GRAPH ?? DEFAULT_GRAPH)
  mkdirSync(path.dirname(outputPath), { recursive: true })

  let map
  let changedFiles = []
  let graph
  let selection
  try {
    map = validateMap(
      JSON.parse(
        readFileSync(path.join(cwd, env.IMPACT_MAP ?? DEFAULT_MAP), 'utf8'),
      ),
      { cwd },
    )
    changedFiles = env.IMPACT_CHANGED_FILES
      ? parseInjectedFiles(env.IMPACT_CHANGED_FILES)
      : getChangedFiles({
          baseSha: env.IMPACT_BASE_SHA,
          headSha: env.IMPACT_HEAD_SHA,
          cwd,
        })
    graph = generateGraph(cwd)
    validatePlaywrightCollection(map, cwd)
    selection = selectAffectedE2e({ map, graph, changedFiles })
  } catch (error) {
    map ??= {
      specs: listE2eSpecs(cwd).map((spec) => ({ spec })),
    }
    selection = fullSelection(
      map,
      normalizeChangedFiles(changedFiles),
      `impact selection failed: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  if (graph) writeFileSync(graphPath, `${JSON.stringify(graph, null, 2)}\n`)
  writeFileSync(outputPath, `${JSON.stringify(selection, null, 2)}\n`)
  if (env.GITHUB_ENV) {
    appendFileSync(env.GITHUB_ENV, `IMPACT_E2E_MODE=${selection.mode}\n`)
    appendFileSync(
      env.GITHUB_ENV,
      `IMPACT_E2E_SELECTION=${path.relative(cwd, outputPath)}\n`,
    )
  }
  writeSummary(selection, env.GITHUB_STEP_SUMMARY)
  process.stdout.write(`${JSON.stringify(selection, null, 2)}\n`)
  return selection
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
if (isMain) runCli()
