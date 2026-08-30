import { spawnSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

export const JOB_KEYS = [
  'static_and_unit',
  'backend_integration',
  'storybook_vrt',
  'e2e',
]

const DOCUMENTATION_PATHS = [
  'AGENTS.md',
  'CONTEXT.md',
  'DESIGN.md',
  'README.md',
]

const FULL_RUN_PATHS = [
  '.dependency-cruiser.cjs',
  '.env.example',
  '.github/dependabot.yml',
  '.github/workflows/',
  'compose.override.yaml',
  'compose.yaml',
  'config/impact/',
  'drizzle.config.ts',
  'eslint.config.js',
  'next.config.ts',
  'package.json',
  'playwright.config.ts',
  'playwright.vrt.config.ts',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'postcss.config.mjs',
  'scripts/impact/',
  'scripts/tooling/',
  'tests/e2e/global-setup.ts',
  'tsconfig.json',
]

const emptyJobs = () => Object.fromEntries(JOB_KEYS.map((key) => [key, false]))
const fullJobs = () => Object.fromEntries(JOB_KEYS.map((key) => [key, true]))

function matchesPath(filePath, pattern) {
  return filePath === pattern || filePath.startsWith(pattern)
}

function matchesAny(filePath, patterns) {
  return patterns.some((pattern) => matchesPath(filePath, pattern))
}

function matchesTestFile(filePath, marker) {
  return filePath.startsWith('src/') && filePath.includes(marker)
}

export function normalizeChangedPath(filePath) {
  return filePath.trim().replaceAll('\\', '/').replace(/^\.\//u, '')
}

export function normalizeChangedFiles(filePaths) {
  return [...new Set(filePaths.map(normalizeChangedPath).filter(Boolean))].sort()
}

function classifyPath(filePath) {
  if (
    filePath.startsWith('docs/') ||
    DOCUMENTATION_PATHS.includes(filePath)
  ) {
    return { jobs: emptyJobs(), e2eMode: 'skip', kind: 'safe-ignore' }
  }

  if (filePath.startsWith('.agents/')) {
    return {
      jobs: { ...emptyJobs(), static_and_unit: true },
      e2eMode: 'skip',
      kind: 'tooling',
    }
  }

  if (matchesAny(filePath, FULL_RUN_PATHS) || filePath === '.gitignore') {
    return { jobs: fullJobs(), e2eMode: 'full', kind: 'high-risk' }
  }

  if (
    matchesTestFile(filePath, '.unit.test.') ||
    matchesTestFile(filePath, '.frontend.test.')
  ) {
    return {
      jobs: { ...emptyJobs(), static_and_unit: true },
      e2eMode: 'skip',
      kind: 'test',
    }
  }

  if (filePath.startsWith('tests/backend/')) {
    return {
      jobs: {
        ...emptyJobs(),
        static_and_unit: true,
        backend_integration: true,
      },
      e2eMode: 'skip',
      kind: 'test',
    }
  }

  if (
    filePath.startsWith('tests/vrt/') ||
    filePath.startsWith('.storybook/') ||
    filePath.includes('.stories.')
  ) {
    return {
      jobs: {
        ...emptyJobs(),
        static_and_unit: true,
        storybook_vrt: true,
      },
      e2eMode: 'skip',
      kind: 'test',
    }
  }

  if (filePath.startsWith('tests/e2e/')) {
    return {
      jobs: { ...emptyJobs(), static_and_unit: true, e2e: true },
      e2eMode:
        filePath === 'tests/e2e/update-product-stock.ts' ? 'full' : 'select',
      kind: 'covered',
    }
  }

  if (filePath.startsWith('public/')) {
    return {
      jobs: { ...emptyJobs(), storybook_vrt: true, e2e: true },
      e2eMode: 'full',
      kind: 'high-risk',
    }
  }

  if (
    filePath.startsWith('src/contracts/') ||
    filePath.startsWith('src/lib/date-time/') ||
    filePath.startsWith('src/test/')
  ) {
    return { jobs: fullJobs(), e2eMode: 'full', kind: 'high-risk' }
  }

  if (
    filePath.startsWith('src/app/api/') ||
    filePath.startsWith('src/server/') ||
    (filePath.startsWith('src/features/') && filePath.includes('/server/')) ||
    filePath.startsWith('scripts/db/') ||
    filePath.startsWith('drizzle/')
  ) {
    return {
      jobs: {
        ...emptyJobs(),
        static_and_unit: true,
        backend_integration: true,
        e2e: true,
      },
      e2eMode:
        filePath.startsWith('src/server/db/') ||
        filePath.startsWith('scripts/db/') ||
        filePath.startsWith('drizzle/')
          ? 'full'
          : 'select',
      kind:
        filePath.startsWith('src/server/db/') ||
        filePath.startsWith('scripts/db/') ||
        filePath.startsWith('drizzle/')
          ? 'high-risk'
          : 'covered',
    }
  }

  if (
    filePath.startsWith('src/app/') ||
    filePath.startsWith('src/components/') ||
    (filePath.startsWith('src/features/') && filePath.endsWith('.tsx'))
  ) {
    const affectsSharedShell =
      filePath === 'src/app/layout.tsx' ||
      filePath === 'src/app/globals.css' ||
      filePath === 'src/app/providers.tsx' ||
      filePath.startsWith('src/components/layout/')
    return {
      jobs: {
        ...emptyJobs(),
        static_and_unit: true,
        storybook_vrt: true,
        e2e: true,
      },
      e2eMode: affectsSharedShell ? 'full' : 'select',
      kind: affectsSharedShell ? 'high-risk' : 'covered',
    }
  }

  if (filePath.startsWith('src/lib/api-client/')) {
    return {
      jobs: { ...emptyJobs(), static_and_unit: true, e2e: true },
      e2eMode: 'select',
      kind: 'covered',
    }
  }

  if (filePath.startsWith('src/features/')) {
    return { jobs: fullJobs(), e2eMode: 'full', kind: 'high-risk' }
  }

  return { jobs: fullJobs(), e2eMode: 'full', kind: 'unmatched' }
}

export function selectCiJobs(filePaths, { fullRun = false } = {}) {
  const changedFiles = normalizeChangedFiles(filePaths)
  if (fullRun) {
    return {
      changedFiles,
      jobs: fullJobs(),
      e2eMode: 'full',
      reason: 'main push or explicit full run',
    }
  }
  if (changedFiles.length === 0) {
    return {
      changedFiles,
      jobs: fullJobs(),
      e2eMode: 'full',
      reason: 'empty change set; using conservative full run',
    }
  }

  const jobs = emptyJobs()
  const classifications = changedFiles.map((filePath) => ({
    filePath,
    ...classifyPath(filePath),
  }))

  for (const classification of classifications) {
    for (const key of JOB_KEYS) jobs[key] ||= classification.jobs[key]
  }

  const e2eMode = classifications.some(({ e2eMode }) => e2eMode === 'full')
    ? 'full'
    : jobs.e2e
      ? 'select'
      : 'skip'
  const reasons = classifications.map(
    ({ filePath, kind }) => `${filePath}: ${kind}`,
  )

  return {
    changedFiles,
    jobs,
    e2eMode,
    reason: reasons.join('; '),
  }
}

export function getChangedFiles({ baseSha, headSha, cwd = process.cwd() }) {
  if (!baseSha || !headSha) throw new Error('base/head SHA are required')
  const result = spawnSync(
    'git',
    [
      'diff',
      '--no-renames',
      '--name-only',
      '-z',
      `${baseSha}...${headSha}`,
    ],
    { cwd, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
  )
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || 'git diff failed')
  }
  return normalizeChangedFiles(result.stdout.split('\0'))
}

function parseInjectedFiles(value) {
  return value.split(/[\n,\0]/u)
}

function writeOutputs(selection, outputPath) {
  if (!outputPath) return
  const values = [
    ...JOB_KEYS.map((key) => `${key}=${selection.jobs[key]}`),
    `e2e_mode=${selection.e2eMode}`,
    `e2e_reason=${selection.reason.replaceAll('\n', ' ')}`,
  ]
  appendFileSync(outputPath, `${values.join('\n')}\n`)
}

function writeSummary(selection, summaryPath) {
  if (!summaryPath) return
  const jobLines = JOB_KEYS.map(
    (key) => `- ${key}: ${selection.jobs[key] ? 'run' : 'skip'}`,
  )
  const fileLines = selection.changedFiles.length
    ? selection.changedFiles.map((filePath) => `- \`${filePath}\``)
    : ['- _none_']
  appendFileSync(
    summaryPath,
    [
      '## CI impact selection',
      '',
      ...jobLines,
      `- e2e_mode: ${selection.e2eMode}`,
      `- reason: ${selection.reason}`,
      '',
      '### Changed files',
      '',
      ...fileLines,
      '',
    ].join('\n'),
  )
}

export function runCli(env = process.env) {
  let selection
  try {
    const fullRun = env.IMPACT_FULL_RUN === 'true'
    const changedFiles = fullRun
      ? []
      : env.IMPACT_CHANGED_FILES
        ? parseInjectedFiles(env.IMPACT_CHANGED_FILES)
        : getChangedFiles({
            baseSha: env.IMPACT_BASE_SHA,
            headSha: env.IMPACT_HEAD_SHA,
          })
    selection = selectCiJobs(changedFiles, {
      fullRun,
    })
  } catch (error) {
    selection = {
      changedFiles: [],
      jobs: fullJobs(),
      e2eMode: 'full',
      reason: `impact detection failed: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
  writeOutputs(selection, env.GITHUB_OUTPUT)
  writeSummary(selection, env.GITHUB_STEP_SUMMARY)
  process.stdout.write(`${JSON.stringify(selection, null, 2)}\n`)
  return selection
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
if (isMain) runCli()
