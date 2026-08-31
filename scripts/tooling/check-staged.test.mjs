import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const checker = path.join(root, 'scripts/tooling/check-staged.mjs')

function git(repository, ...args) {
  return execFileSync('git', args, { cwd: repository, encoding: 'utf8' })
}

function fixtureRepository() {
  const directory = mkdtempSync(path.join(tmpdir(), 'ec-staged-test-'))
  const repository = path.join(directory, 'repo')
  mkdirSync(repository)
  git(repository, 'init', '-q')
  git(repository, 'config', 'user.email', 'test@example.test')
  git(repository, 'config', 'user.name', 'Staged Check Test')
  writeFileSync(path.join(repository, '.oxfmtrc.json'), '{"semi":false}\n')
  writeFileSync(path.join(repository, '.oxlintrc.json'), '{"categories":{"correctness":"off"}}\n')
  writeFileSync(path.join(repository, 'sample.ts'), 'const value = 1\n')
  symlinkSync(path.join(root, 'node_modules'), path.join(repository, 'node_modules'), 'dir')
  git(repository, 'add', '.oxfmtrc.json', '.oxlintrc.json', 'sample.ts')
  git(repository, 'commit', '-qm', 'base')
  return { directory, repository }
}

function runChecker(repository) {
  return spawnSync(process.execPath, [checker], {
    cwd: root,
    env: { ...process.env, CHECK_STAGED_ROOT: repository },
    encoding: 'utf8',
  })
}

test('unstaged errors do not fail or mutate a clean staged version', () => {
  const { directory, repository } = fixtureRepository()
  try {
    writeFileSync(path.join(repository, 'sample.ts'), 'const value = 2\n')
    git(repository, 'add', 'sample.ts')
    writeFileSync(path.join(repository, 'sample.ts'), 'const value=  3\n')
    const indexBefore = git(repository, 'diff', '--cached', '--binary')
    const workingBefore = readFileSync(path.join(repository, 'sample.ts'), 'utf8')

    const result = runChecker(repository)

    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`)
    assert.equal(git(repository, 'diff', '--cached', '--binary'), indexBefore)
    assert.equal(readFileSync(path.join(repository, 'sample.ts'), 'utf8'), workingBefore)
  } finally {
    rmSync(directory, { force: true, recursive: true })
  }
})

test('staged errors fail without replacing them with a clean unstaged version', () => {
  const { directory, repository } = fixtureRepository()
  try {
    writeFileSync(path.join(repository, 'sample.ts'), 'const value=  2\n')
    git(repository, 'add', 'sample.ts')
    writeFileSync(path.join(repository, 'sample.ts'), 'const value = 3\n')
    const indexBefore = git(repository, 'diff', '--cached', '--binary')
    const workingBefore = readFileSync(path.join(repository, 'sample.ts'), 'utf8')

    const result = runChecker(repository)

    assert.notEqual(result.status, 0)
    assert.equal(git(repository, 'diff', '--cached', '--binary'), indexBefore)
    assert.equal(readFileSync(path.join(repository, 'sample.ts'), 'utf8'), workingBefore)
  } finally {
    rmSync(directory, { force: true, recursive: true })
  }
})
