import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { collectDiff, LIMITS } from './collect-diff.mjs'
import { generateReport } from './generate-report.mjs'
import { highlightHunks } from './syntax-highlighting.mjs'

const temporaryDirectories = []

function temporary(prefix) {
  const path = mkdtempSync(join(tmpdir(), prefix))
  temporaryDirectories.push(path)
  return path
}

test.after(() => {
  for (const path of temporaryDirectories) {
    rmSync(path, { recursive: true, force: true })
  }
})

function git(repository, arguments_) {
  return execFileSync('git', arguments_, { cwd: repository, encoding: 'utf8' }).trim()
}

function repositoryFixture() {
  const repository = temporary('explained-review-stress-repository-')
  git(repository, ['init', '-b', 'main'])
  git(repository, ['config', 'user.email', 'stress@example.invalid'])
  git(repository, ['config', 'user.name', 'Stress Test'])
  writeFileSync(join(repository, 'README.md'), 'baseline\n')
  git(repository, ['add', 'README.md'])
  git(repository, ['commit', '-m', 'baseline'])
  return { repository, base: git(repository, ['rev-parse', 'HEAD']) }
}

test('walkthroughは20,000行を収集し20,001行を拒否する', () => {
  const { repository, base } = repositoryFixture()
  const source = join(repository, 'large.txt')
  writeFileSync(source, `${Array.from({ length: LIMITS.walkthroughLines }, () => 'x').join('\n')}\n`)
  const accepted = collectDiff({
    repository,
    baseRef: base,
    noPlan: true,
    explain: 'walkthrough',
    reviewId: 'stress-20000',
    outputDirectory: temporary('explained-review-stress-input-'),
  })
  const blind = JSON.parse(readFileSync(accepted.blindInputPath, 'utf8'))
  assert.equal(blind.files.flatMap((file) => file.hunks).reduce(
    (total, hunk) => total + hunk.lines.length,
    0,
  ), LIMITS.walkthroughLines)
  assert.equal(blind.blindBatches.length, 1)
  assert.equal(blind.blindBatches[0].oversizedSingleHunk, true)
  assert.equal(blind.blindBatches[0].hunkIds.length, 1)

  writeFileSync(source, `${Array.from({ length: LIMITS.walkthroughLines + 1 }, () => 'x').join('\n')}\n`)
  assert.throws(
    () => collectDiff({
      repository,
      baseRef: base,
      noPlan: true,
      explain: 'walkthrough',
      reviewId: 'stress-20001',
      outputDirectory: temporary('explained-review-stress-rejected-'),
    }),
    /walkthrough対象.*20000行を超えています/u,
  )
})

test('review modeは250,000行をtruncateせず64 MiB内のreportへ生成する', () => {
  const repository = temporary('explained-review-stress-report-')
  const inputDirectory = temporary('explained-review-stress-analysis-')
  const lineCount = LIMITS.diffLines
  const lines = Array.from({ length: lineCount }, (_, index) => ({
    kind: 'addition',
    oldLine: null,
    newLine: index + 1,
    text: 'x',
  }))
  const hunk = {
    id: 'hunk-stress',
    fileId: 'file-stress',
    file: 'large.txt',
    header: `@@ -0,0 +1,${lineCount} @@`,
    oldStart: 0,
    oldLines: 0,
    newStart: 1,
    newLines: lineCount,
    lines,
  }
  const group = {
    id: 'group-stress',
    title: '大規模差分',
    summary: '上限相当の差分を保持する。',
    changeType: 'test',
    risk: 'low',
    intent: 'truncateされないことを確認する。',
    implementationSummary: '250,000行の追加差分を生成する。',
    impact: 'stress testだけに影響する。',
    verificationPoints: ['全行がreportへ残ること'],
    hunkIds: [hunk.id],
    findings: [],
    fileExplanations: [],
  }
  const blind = {
    schemaVersion: 3,
    mode: 'review',
    reviewId: 'stress-250000',
    repositoryRoot: repository,
    repositoryHash: '1234567890abcdef',
    snapshot: {
      scope: 'workspace',
      collectedAt: '2026-08-02T00:00:00.000Z',
      workspaceFingerprint: 'a'.repeat(64),
    },
    git: {
      baseRef: 'main',
      baseOid: '1'.repeat(40),
      headOid: '1'.repeat(40),
      mergeBase: '1'.repeat(40),
      branch: 'main',
      ahead: 0,
      behind: 0,
      commits: [],
    },
    stats: {
      files: 1,
      hunks: 1,
      additions: lineCount,
      deletions: 0,
      committedFiles: 0,
      stagedFiles: 0,
      unstagedFiles: 0,
      untrackedFiles: 1,
    },
    files: [
      {
        id: 'file-stress',
        path: 'large.txt',
        oldPath: null,
        newPath: 'large.txt',
        status: 'A',
        additions: lineCount,
        deletions: 0,
        binary: false,
        size: lineCount * 2,
        changeSources: ['untracked'],
        explanationPolicy: {
          detailLevel: 'segmented',
          summaryOnlyKind: null,
          rationale: null,
        },
        hunks: [hunk],
      },
    ],
    blindBatches: [
      {
        id: 'blind-batch-stress',
        hunkIds: [hunk.id],
        diffLines: lineCount,
        rawBytes: Buffer.byteLength(
          [hunk.header, ...lines.map((line) => line.text)].join('\n'),
        ),
        oversizedSingleHunk: true,
      },
    ],
    rules: [],
  }
  const plan = {
    schemaVersion: 3,
    resolution: 'disabled',
    path: null,
    content: null,
  }
  const stage1 = {
    schemaVersion: 3,
    mode: 'review',
    summary: '大規模差分をBlind reviewした。',
    groups: [group],
  }
  const analysis = {
    schemaVersion: 3,
    mode: 'review',
    overview: '250,000行のreview reportを生成する。',
    blindSummary: stage1.summary,
    planReview: { status: 'skipped-no-plan', planPath: null, summary: '' },
    groups: [{ ...group, planItemIds: [] }],
    planCoverage: { status: 'skipped-no-plan', items: [] },
    verificationItems: [],
  }
  const paths = {}
  for (const [name, value] of Object.entries({ blind, plan, stage1, analysis })) {
    paths[name] = join(inputDirectory, `${name}.json`)
    writeFileSync(paths[name], JSON.stringify(value))
  }
  const result = generateReport({
    blindInputPath: paths.blind,
    planInputPath: paths.plan,
    stageOnePath: paths.stage1,
    analysisPath: paths.analysis,
  })
  const report = JSON.parse(readFileSync(result.reportPath, 'utf8'))
  assert.equal(report.groups[0].hunks[0].lines.length, lineCount)
  assert.ok(statSync(result.reportPath).size <= 64 * 1024 * 1024)
})

test('100,001 token run相当のhunkをtoken-limitへfallbackする', () => {
  const tokenCount = 100_001
  const text = 'x'.repeat(tokenCount)
  const result = highlightHunks(
    [
      {
        id: 'hunk-token-limit',
        fileId: 'file-token-limit',
        file: 'large.ts',
        header: '@@ -0,0 +1 @@',
        oldStart: 0,
        oldLines: 0,
        newStart: 1,
        newLines: 1,
        lines: [{ kind: 'addition', oldLine: null, newLine: 1, text }],
      },
    ],
    {
      tokenize: () => [
        Array.from({ length: tokenCount }, (_, index) => ({
          content: 'x',
          variants: {
            light: { color: index % 2 === 0 ? '#000000' : '#111111' },
            dark: { color: index % 2 === 0 ? '#ffffff' : '#eeeeee' },
          },
        })),
      ],
    },
  )
  assert.deepEqual(result.highlighting.fallbacks, [
    { hunkId: 'hunk-token-limit', reason: 'token-limit' },
  ])
  assert.deepEqual(result.hunks[0].lines[0].tokenRuns, [])
})
