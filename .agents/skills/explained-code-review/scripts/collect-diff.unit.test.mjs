import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  collectDiff,
  createBlindBatches,
  explanationPolicy,
  LIMITS,
  requireReviewId,
} from './collect-diff.mjs'

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

for (const scope of ['workspace', 'commits']) {
  test(`${scope} scopeはコミット済みの変更planを自動選択してBlind入力から除外する`, () => {
    const { repository, base } = repositoryFixture()
    mkdirSync(join(repository, 'plans'))
    writeFileSync(
      join(repository, 'plans', 'implementation.md'),
      'secret committed plan body\n',
    )
    writeFileSync(join(repository, 'tracked.txt'), 'implementation\n')
    git(repository, ['add', 'plans/implementation.md', 'tracked.txt'])
    git(repository, ['commit', '-m', 'add implementation'])

    const result = collectDiff({
      repository,
      baseRef: base,
      scope,
      outputDirectory: join(repository, 'inputs'),
    })
    const blindText = readFileSync(result.blindInputPath, 'utf8')
    const plan = JSON.parse(readFileSync(result.planInputPath, 'utf8'))
    assert.equal(plan.resolution, 'auto')
    assert.equal(plan.path, 'plans/implementation.md')
    assert.equal(plan.content, 'secret committed plan body\n')
    assert.doesNotMatch(blindText, /secret committed plan body/u)
    assert.doesNotMatch(blindText, /plans\/implementation\.md/u)
    assert.match(blindText, /implementation/u)
  })
}

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

test('workspaceのtracked symlinkはrepository外targetをheader分類へ使わない', () => {
  const { repository, base } = repositoryFixture()
  const externalDirectory = mkdtempSync(join(tmpdir(), 'explained-review-external-'))
  const externalTarget = join(externalDirectory, 'generated-target.ts')
  writeFileSync(externalTarget, '// @generated\nexport const outside = true\n')
  symlinkSync(externalTarget, join(repository, 'linked.ts'))
  git(repository, ['add', 'linked.ts'])

  const result = collectDiff({
    repository,
    baseRef: base,
    noPlan: true,
    outputDirectory: join(repository, 'inputs'),
  })
  const blind = JSON.parse(readFileSync(result.blindInputPath, 'utf8'))
  const symlink = blind.files.find((file) => file.path === 'linked.ts')
  assert.equal(symlink.explanationPolicy.detailLevel, 'segmented')
  assert.equal(symlink.explanationPolicy.summaryOnlyKind, null)
  assert.doesNotMatch(JSON.stringify(symlink), /outside/u)
})

test('symlinkとsubmoduleから通常fileへのtype changeで新規本文を収集する', () => {
  const { repository } = repositoryFixture()
  symlinkSync('tracked.txt', join(repository, 'linked.js'))
  git(repository, ['add', 'linked.js'])
  const submoduleOid = git(repository, ['rev-parse', 'HEAD'])
  git(repository, [
    'update-index',
    '--add',
    '--cacheinfo',
    `160000,${submoduleOid},module-entry.js`,
  ])
  git(repository, ['commit', '-m', 'add special entries'])
  const base = git(repository, ['rev-parse', 'HEAD'])

  unlinkSync(join(repository, 'linked.js'))
  writeFileSync(join(repository, 'linked.js'), 'export const linked = true\n')
  git(repository, ['rm', '--cached', 'module-entry.js'])
  writeFileSync(
    join(repository, 'module-entry.js'),
    'export const moduleEntry = true\n',
  )
  git(repository, ['add', 'linked.js', 'module-entry.js'])
  git(repository, ['commit', '-m', 'replace special entries'])

  const result = collectDiff({
    repository,
    baseRef: base,
    noPlan: true,
    scope: 'commits',
    outputDirectory: join(repository, 'inputs'),
  })
  const blind = JSON.parse(readFileSync(result.blindInputPath, 'utf8'))
  const symlink = blind.files.find((file) => file.path === 'linked.js')
  const submodule = blind.files.find((file) => file.path === 'module-entry.js')

  assert.ok(symlink.additions > 0)
  assert.match(JSON.stringify(symlink.hunks), /export const linked = true/u)
  assert.match(JSON.stringify(symlink.hunks), /Tracked symlink to regular file/u)
  assert.ok(submodule.additions > 0)
  assert.match(
    JSON.stringify(submodule.hunks),
    /export const moduleEntry = true/u,
  )
  assert.match(JSON.stringify(submodule.hunks), /Submodule to regular file/u)
})

for (const scope of ['workspace', 'commits']) {
  test(`${scope} scopeはrename前後のselected planをBlind入力から除外する`, () => {
    const { repository } = repositoryFixture()
    mkdirSync(join(repository, 'plans'))
    writeFileSync(join(repository, 'plans', 'old.md'), 'secret renamed plan\n')
    git(repository, ['add', 'plans/old.md'])
    git(repository, ['commit', '-m', 'add plan'])
    const base = git(repository, ['rev-parse', 'HEAD'])
    git(repository, ['mv', 'plans/old.md', 'plans/new.md'])
    if (scope === 'commits') {
      git(repository, ['commit', '-m', 'rename plan'])
    }

    const result = collectDiff({
      repository,
      baseRef: base,
      planPath: 'plans/new.md',
      scope,
      outputDirectory: join(repository, 'inputs'),
    })
    const blindText = readFileSync(result.blindInputPath, 'utf8')
    assert.doesNotMatch(blindText, /secret renamed plan/u)
    assert.doesNotMatch(blindText, /plans\/old\.md/u)
    assert.doesNotMatch(blindText, /plans\/new\.md/u)
  })
}

test('既存fileを含む明示outputを拒否して内容を保持する', () => {
  const { repository, base } = repositoryFixture()
  const outputDirectory = join(repository, 'inputs')
  mkdirSync(outputDirectory)
  const existingPath = join(outputDirectory, 'blind-input.json')
  writeFileSync(existingPath, 'keep this file\n')

  assert.throws(
    () =>
      collectDiff({
        repository,
        baseRef: base,
        noPlan: true,
        outputDirectory,
      }),
    /空directory/u,
  )
  assert.equal(readFileSync(existingPath, 'utf8'), 'keep this file\n')
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

test('summary-only分類はcollectorの決定的なpath/header規則だけを使う', () => {
  const file = (path, text = 'ordinary source', binary = false) => ({
    path,
    binary,
    hunks: [
      {
        lines: text.split('\n').map((line) => ({ kind: 'addition', text: line })),
      },
    ],
  })
  assert.equal(explanationPolicy(file('pnpm-lock.yaml')).summaryOnlyKind, 'lockfile')
  assert.equal(explanationPolicy(file('bundle.min.js')).summaryOnlyKind, 'minified')
  assert.equal(explanationPolicy(file('types.d.ts', '// @generated')).summaryOnlyKind, 'generated')
  assert.equal(
    explanationPolicy(file('validator.mjs', '// Generated by build-validator.mjs; do not edit'))
      .summaryOnlyKind,
    'generated',
  )
  assert.equal(
    explanationPolicy(file('src/message.ts', 'const warning = "do not edit"')).detailLevel,
    'segmented',
  )
  assert.equal(
    explanationPolicy(file('README.md', 'This generated file is documented here.')).detailLevel,
    'segmented',
  )
  assert.equal(explanationPolicy(file('image.bin', '', true)).summaryOnlyKind, 'binary')
  assert.equal(explanationPolicy(file('src/app.ts')).detailLevel, 'segmented')
})

test('Blind batchは4000行または1MiBの早い境界で分けoversized hunkを単独にする', () => {
  const makeHunk = (id, count, text = 'x') => ({
    id,
    header: '@@',
    lines: Array.from({ length: count }, () => ({ text })),
  })
  const batches = createBlindBatches([
    {
      hunks: [
        makeHunk('hunk-1', 3000),
        makeHunk('hunk-2', 2000),
        makeHunk('hunk-3', LIMITS.blindBatchLines + 1),
      ],
    },
  ])
  assert.deepEqual(batches.map((batch) => batch.hunkIds), [
    ['hunk-1'],
    ['hunk-2'],
    ['hunk-3'],
  ])
  assert.equal(batches[2].oversizedSingleHunk, true)
})

test('collectorはexplain modeをv3 inputへ伝播し不正値を拒否する', () => {
  const { repository, base } = repositoryFixture()
  writeFileSync(join(repository, 'tracked.txt'), 'walkthrough\n')
  const result = collectDiff({
    repository,
    baseRef: base,
    noPlan: true,
    explain: 'walkthrough',
    outputDirectory: join(repository, 'inputs'),
  })
  const blind = JSON.parse(readFileSync(result.blindInputPath, 'utf8'))
  assert.equal(blind.schemaVersion, 3)
  assert.equal(blind.mode, 'walkthrough')
  assert.equal(result.mode, 'walkthrough')
  assert.throws(
    () => collectDiff({ repository, baseRef: base, noPlan: true, explain: 'verbose' }),
    /--explain/u,
  )
})
