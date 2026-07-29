import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { collectDiff, LIMITS, requireReviewId } from './collect-diff.mjs'

function git(repository, args) {
  return execFileSync('git', args, { cwd: repository, encoding: 'utf8' }).trim()
}

function repositoryFixture() {
  const repository = mkdtempSync(join(tmpdir(), 'explained-review-collector-'))
  git(repository, ['init', '-b', 'main'])
  git(repository, ['config', 'user.email', 'review@example.test'])
  git(repository, ['config', 'user.name', 'Review Test'])
  writeFileSync(join(repository, 'tracked.txt'), 'base\n')
  git(repository, ['add', 'tracked.txt'])
  git(repository, ['commit', '-m', 'base'])
  const base = git(repository, ['rev-parse', 'HEAD'])
  return { repository, base }
}

test('workspace scopeはcommitted/staged/unstaged/untrackedのnet差分を収集しplanを除外する', () => {
  const { repository, base } = repositoryFixture()
  writeFileSync(join(repository, 'tracked.txt'), 'committed\n')
  git(repository, ['commit', '-am', 'committed change'])
  writeFileSync(join(repository, 'tracked.txt'), 'staged\n')
  git(repository, ['add', 'tracked.txt'])
  writeFileSync(join(repository, 'tracked.txt'), 'workspace-final\n')
  writeFileSync(join(repository, 'new file.txt'), 'untracked\n')
  mkdirSync(join(repository, 'plans'))
  writeFileSync(join(repository, 'plans', 'review.md'), 'secret plan body\n')
  mkdirSync(join(repository, '.review'))
  writeFileSync(join(repository, '.review', 'self.html'), 'must not collect\n')

  const result = collectDiff({
    repository,
    baseRef: base,
    planPath: 'plans/review.md',
    outputDirectory: join(repository, 'inputs'),
  })
  const blind = JSON.parse(readFileSync(result.blindInputPath, 'utf8'))
  const tracked = blind.files.find((file) => file.path === 'tracked.txt')
  assert.deepEqual(tracked.changeSources, ['committed', 'staged', 'unstaged'])
  assert.match(JSON.stringify(tracked.hunks), /workspace-final/u)
  assert.doesNotMatch(JSON.stringify(blind), /secret plan body/u)
  assert.doesNotMatch(JSON.stringify(blind), /must not collect/u)
  assert.deepEqual(
    blind.files.map((file) => file.path).sort(),
    ['new file.txt', 'tracked.txt'],
  )
  assert.equal(blind.stats.untrackedFiles, 1)
})

test('commits scopeは未コミット内容を含めない', () => {
  const { repository, base } = repositoryFixture()
  writeFileSync(join(repository, 'tracked.txt'), 'committed-only\n')
  git(repository, ['commit', '-am', 'committed change'])
  writeFileSync(join(repository, 'tracked.txt'), 'must-not-leak\n')
  writeFileSync(join(repository, 'untracked.txt'), 'must-not-leak\n')

  const result = collectDiff({
    repository,
    baseRef: base,
    noPlan: true,
    scope: 'commits',
    outputDirectory: join(repository, 'inputs'),
  })
  const blind = JSON.parse(readFileSync(result.blindInputPath, 'utf8'))
  assert.match(JSON.stringify(blind.files), /committed-only/u)
  assert.doesNotMatch(JSON.stringify(blind.files), /must-not-leak/u)
  assert.equal(blind.stats.untrackedFiles, 0)
})

test('収集中のworkspace変更を検出して停止する', () => {
  const { repository, base } = repositoryFixture()
  writeFileSync(join(repository, 'tracked.txt'), 'before\n')
  assert.throws(
    () =>
      collectDiff({
        repository,
        baseRef: base,
        noPlan: true,
        snapshotHook: () =>
          writeFileSync(join(repository, 'tracked.txt'), 'during\n'),
      }),
    /workspaceが収集中に変化/u,
  )
})

test('rename、binary、mode変更を収集しignored fileを除外する', () => {
  const { repository, base } = repositoryFixture()
  git(repository, ['mv', 'tracked.txt', 'renamed file.txt'])
  chmodSync(join(repository, 'renamed file.txt'), 0o755)
  writeFileSync(join(repository, 'binary.bin'), Buffer.from([0, 1, 2, 3]))
  writeFileSync(join(repository, '.gitignore'), 'ignored.txt\n')
  writeFileSync(join(repository, 'ignored.txt'), 'ignored\n')
  const result = collectDiff({
    repository,
    baseRef: base,
    noPlan: true,
    outputDirectory: join(repository, 'inputs'),
  })
  const blind = JSON.parse(readFileSync(result.blindInputPath, 'utf8'))
  const rename = blind.files.find((file) => file.path === 'renamed file.txt')
  assert.match(rename.status, /^R/u)
  assert.equal(blind.files.find((file) => file.path === 'binary.bin').binary, true)
  assert.equal(blind.files.some((file) => file.path === 'ignored.txt'), false)
})

test('text本文のGit metadata文字列をfile種別として誤判定しない', () => {
  const { repository, base } = repositoryFixture()
  const markers = [
    'GIT binary patch',
    'Binary files example.old and example.new differ',
    'Subproject commit 0123456789abcdef',
    'new mode 160000',
    'old mode 120000',
  ]
  writeFileSync(join(repository, 'markers.txt'), `${markers.join('\n')}\n`)
  const collectorSource = readFileSync(
    new URL('./collect-diff.mjs', import.meta.url),
    'utf8',
  )
  writeFileSync(join(repository, 'collector-source.mjs'), collectorSource)

  const result = collectDiff({
    repository,
    baseRef: base,
    noPlan: true,
    outputDirectory: join(repository, 'inputs'),
  })
  const blind = JSON.parse(readFileSync(result.blindInputPath, 'utf8'))
  const markerFile = blind.files.find((file) => file.path === 'markers.txt')
  const collectorFile = blind.files.find(
    (file) => file.path === 'collector-source.mjs',
  )
  assert.equal(markerFile.binary, false)
  assert.equal(markerFile.additions, markers.length)
  assert.deepEqual(
    markerFile.hunks.flatMap((hunk) => hunk.lines.map((line) => line.text)),
    markers,
  )
  assert.equal(collectorFile.binary, false)
  assert.match(JSON.stringify(collectorFile.hunks), /parsePatchMetadata/u)
  assert.ok(collectorFile.additions > 500)
})

test('tracked symlinkとsubmoduleをGit headerのmodeから判定する', () => {
  const { repository, base } = repositoryFixture()
  symlinkSync('tracked.txt', join(repository, 'linked.txt'))
  git(repository, ['add', 'linked.txt'])
  git(repository, [
    'update-index',
    '--add',
    '--cacheinfo',
    `160000,${base},module-entry`,
  ])
  git(repository, ['commit', '-m', 'add special entries'])

  const result = collectDiff({
    repository,
    baseRef: base,
    noPlan: true,
    scope: 'commits',
    outputDirectory: join(repository, 'inputs'),
  })
  const blind = JSON.parse(readFileSync(result.blindInputPath, 'utf8'))
  const symlink = blind.files.find((file) => file.path === 'linked.txt')
  const submodule = blind.files.find((file) => file.path === 'module-entry')
  assert.equal(symlink.binary, false)
  assert.match(symlink.hunks[0].lines[0].text, /Tracked symlink changed/u)
  assert.equal(submodule.binary, false)
  assert.match(submodule.hunks[0].lines[0].text, /Submodule changed/u)
})

test('selected planとruleの競合、およびplan symlinkを拒否する', () => {
  const { repository, base } = repositoryFixture()
  mkdirSync(join(repository, 'plans'))
  writeFileSync(join(repository, 'plans', 'review.md'), 'plan\n')
  assert.throws(
    () =>
      collectDiff({
        repository,
        baseRef: base,
        planPath: 'plans/review.md',
        rulePaths: ['plans/review.md'],
      }),
    /Blind rule/u,
  )
  symlinkSync('review.md', join(repository, 'plans', 'linked.md'))
  assert.throws(
    () =>
      collectDiff({
        repository,
        baseRef: base,
        planPath: 'plans/linked.md',
      }),
    /symlink/u,
  )
})

test('単一untracked fileの上限を超えた場合はtruncateせず停止する', () => {
  const { repository, base } = repositoryFixture()
  writeFileSync(join(repository, 'large.txt'), Buffer.alloc(LIMITS.fileBytes + 1, 97))
  assert.throws(
    () =>
      collectDiff({
        repository,
        baseRef: base,
        noPlan: true,
      }),
    /単一fileの上限/u,
  )
})

test('review IDのpath escapeと予約prefixを拒否する', () => {
  for (const id of ['../escape', '.tmp-review', 'white space', '/root']) {
    assert.throws(() => requireReviewId(id))
  }
  assert.equal(requireReviewId('review.v2_01'), 'review.v2_01')
})
