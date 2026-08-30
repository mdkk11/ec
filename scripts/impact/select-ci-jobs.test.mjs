import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { getChangedFiles, runCli, selectCiJobs } from './select-ci-jobs.mjs'

const jobs = (selection) => selection.jobs

function changedFilesForRename(from, to) {
  const repository = mkdtempSync(path.join(tmpdir(), 'ci-impact-'))
  execFileSync('git', ['init', '-q'], { cwd: repository })
  execFileSync('git', ['config', 'user.email', 'test@example.test'], {
    cwd: repository,
  })
  execFileSync('git', ['config', 'user.name', 'CI Impact Test'], {
    cwd: repository,
  })
  mkdirSync(path.dirname(path.join(repository, from)), { recursive: true })
  writeFileSync(path.join(repository, from), 'export const x = 1\n')
  execFileSync('git', ['add', from], { cwd: repository })
  execFileSync('git', ['commit', '-qm', 'base'], { cwd: repository })
  const baseSha = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: repository,
    encoding: 'utf8',
  }).trim()
  mkdirSync(path.dirname(path.join(repository, to)), { recursive: true })
  renameSync(path.join(repository, from), path.join(repository, to))
  execFileSync('git', ['add', '-A'], { cwd: repository })
  execFileSync('git', ['commit', '-qm', 'rename'], { cwd: repository })
  const headSha = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: repository,
    encoding: 'utf8',
  }).trim()
  return getChangedFiles({ baseSha, headSha, cwd: repository })
}

test('documentation-only changes skip every job', () => {
  const selection = selectCiJobs(['docs/TEST_STRATEGY.md', 'README.md'])
  assert.deepEqual(jobs(selection), {
    static_and_unit: false,
    backend_integration: false,
    storybook_vrt: false,
    e2e: false,
  })
  assert.equal(selection.e2eMode, 'skip')
})

test('dedicated test files run only their responsible jobs', () => {
  assert.deepEqual(jobs(selectCiJobs(['src/contracts/cart.unit.test.ts'])), {
    static_and_unit: true,
    backend_integration: false,
    storybook_vrt: false,
    e2e: false,
  })
  assert.deepEqual(jobs(selectCiJobs(['tests/backend/cart.backend.test.ts'])), {
    static_and_unit: true,
    backend_integration: true,
    storybook_vrt: false,
    e2e: false,
  })
  assert.deepEqual(jobs(selectCiJobs(['tests/vrt/cart.vrt.spec.ts'])), {
    static_and_unit: true,
    backend_integration: false,
    storybook_vrt: true,
    e2e: false,
  })
  assert.equal(selectCiJobs(['tests/e2e/cart.spec.ts']).e2eMode, 'select')
})

test('repository agent tooling still runs the static job', () => {
  assert.deepEqual(jobs(selectCiJobs(['.agents/skills/example/scripts/check.mjs'])), {
    static_and_unit: true,
    backend_integration: false,
    storybook_vrt: false,
    e2e: false,
  })
})

test('runtime paths select conservative responsibility sets', () => {
  assert.deepEqual(jobs(selectCiJobs(['src/app/api/cart/route.ts'])), {
    static_and_unit: true,
    backend_integration: true,
    storybook_vrt: false,
    e2e: true,
  })
  assert.deepEqual(jobs(selectCiJobs(['src/features/cart/CartView.tsx'])), {
    static_and_unit: true,
    backend_integration: false,
    storybook_vrt: true,
    e2e: true,
  })
  assert.deepEqual(jobs(selectCiJobs(['public/images/fixtures/cart.png'])), {
    static_and_unit: false,
    backend_integration: false,
    storybook_vrt: true,
    e2e: true,
  })
  assert.equal(selectCiJobs(['public/images/fixtures/cart.png']).e2eMode, 'full')
})

test('shared shell and database infrastructure force full E2E coverage', () => {
  for (const filePath of [
    'src/app/layout.tsx',
    'src/app/globals.css',
    'src/app/providers.tsx',
    'src/components/layout/Header.tsx',
    'src/server/db/client.ts',
    'scripts/db/prepare-e2e.ts',
    'drizzle/0001_example.sql',
    'tests/e2e/update-product-stock.ts',
  ]) {
    assert.equal(selectCiJobs([filePath]).e2eMode, 'full', filePath)
  }
})

test('mixed diffs preserve selection unless an E2E-relevant path is unsafe', () => {
  assert.equal(selectCiJobs(['docs/README.md', 'src/features/cart/CartView.tsx']).e2eMode, 'select')
  assert.equal(
    selectCiJobs(['src/features/cart/CartView.tsx', 'runtime/new-hook.xyz']).e2eMode,
    'full',
  )
})

test('shared, unknown, empty, and explicit full runs execute everything', () => {
  for (const selection of [
    selectCiJobs(['src/contracts/cart.ts']),
    selectCiJobs(['.github/dependabot.yml']),
    selectCiJobs(['unknown.file']),
    selectCiJobs([]),
    selectCiJobs(['docs/README.md'], { fullRun: true }),
  ]) {
    assert.ok(Object.values(selection.jobs).every(Boolean))
    assert.equal(selection.e2eMode, 'full')
  }
})

test('git diff reports both sides of source and docs renames', () => {
  for (const [from, to] of [
    ['src/server/x.ts', 'docs/x.md'],
    ['src/features/cart/CartView.tsx', 'docs/cart.md'],
    ['docs/cart.md', 'src/features/cart/CartView.tsx'],
  ]) {
    assert.deepEqual(changedFilesForRename(from, to), [from, to].sort())
  }
})

test('CLI writes literal outputs and a readable summary', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'ci-impact-output-'))
  const output = path.join(directory, 'output')
  const summary = path.join(directory, 'summary')
  runCli({
    IMPACT_CHANGED_FILES: 'docs/README.md\nsrc/features/cart/CartView.tsx',
    GITHUB_OUTPUT: output,
    GITHUB_STEP_SUMMARY: summary,
  })
  const outputText = readFileSync(output, 'utf8')
  assert.match(outputText, /^static_and_unit=true$/mu)
  assert.match(outputText, /^backend_integration=false$/mu)
  assert.match(outputText, /^e2e_mode=select$/mu)
  assert.match(readFileSync(summary, 'utf8'), /CI impact selection/u)
})
