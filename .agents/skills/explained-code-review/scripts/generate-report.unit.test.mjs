import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  generateReport,
  parseBlindInput,
} from './generate-report.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const skillDirectory = resolve(here, '..')

function fixture() {
  const repository = mkdtempSync(join(tmpdir(), 'explained-review-generator-'))
  const input = mkdtempSync(join(tmpdir(), 'explained-review-input-'))
  const finding = {
    id: 'S1-001',
    stage: 'blind',
    severity: 'medium',
    category: 'bug',
    locationKind: 'diff',
    lineSide: 'new',
    file: 'src/example.js',
    startLine: 1,
    endLine: 1,
    title: 'unsafe <tag>',
    issue: 'value contains </script><script>globalThis.pwned=true</script>',
    rationale: '入力がそのまま表示される可能性がある。',
    suggestion: 'textContentで表示する。',
    confidence: 'high',
    planAssessment: {
      status: 'not-reviewed',
      rationale: 'Blind reviewではplanを参照しないため',
    },
  }
  const group = {
    id: 'group-example',
    title: '安全な表示',
    summary: '差分を固定UIで安全に表示する。',
    changeType: 'feature',
    risk: 'medium',
    intent: 'レビュー画面を生成する。',
    implementationSummary: 'scriptを追加した。',
    impact: 'ローカルレビュー。',
    verificationPoints: ['HTMLとして実行されないこと'],
    hunkIds: ['hunk-1'],
    findings: [finding],
  }
  const blind = {
    schemaVersion: 2,
    reviewId: 'example-review',
    repositoryRoot: repository,
    repositoryHash: '1234567890abcdef',
    snapshot: {
      scope: 'workspace',
      collectedAt: '2026-07-28T00:00:00.000Z',
      workspaceFingerprint: 'a'.repeat(64),
    },
    git: {
      baseRef: 'main',
      baseOid: '1'.repeat(40),
      headOid: '2'.repeat(40),
      mergeBase: '1'.repeat(40),
      branch: 'feature/review',
      ahead: 1,
      behind: 0,
      commits: [],
    },
    stats: {
      files: 1,
      hunks: 1,
      additions: 1,
      deletions: 0,
      committedFiles: 1,
      stagedFiles: 0,
      unstagedFiles: 0,
      untrackedFiles: 0,
    },
    files: [
      {
        id: 'file-1',
        path: 'src/example.js',
        oldPath: null,
        newPath: 'src/example.js',
        status: 'A',
        additions: 1,
        deletions: 0,
        binary: false,
        size: 20,
        changeSources: ['committed'],
        hunks: [
          {
            id: 'hunk-1',
            fileId: 'file-1',
            file: 'src/example.js',
            header: '@@ -0,0 +1 @@',
            oldStart: 0,
            oldLines: 0,
            newStart: 1,
            newLines: 1,
            lines: [
              {
                kind: 'addition',
                oldLine: null,
                newLine: 1,
                text: '</script><script>globalThis.pwned=true</script>',
              },
            ],
          },
        ],
      },
    ],
    rules: [],
  }
  const stage1 = { schemaVersion: 2, summary: 'Blind summary', groups: [group] }
  const analysis = {
    schemaVersion: 2,
    overview: '安全性を確認する。',
    blindSummary: stage1.summary,
    planReview: {
      status: 'completed',
      planPath: 'plans/review.md',
      summary: 'planと一致する。',
    },
    groups: [
      {
        ...group,
        findings: [
          {
            ...finding,
            planAssessment: {
              status: 'confirmed',
              rationale: 'planでも安全な表示を要求している。',
            },
          },
        ],
      },
    ],
  }
  const plan = {
    schemaVersion: 2,
    resolution: 'explicit',
    path: 'plans/review.md',
    content: 'safe report plan',
  }
  const paths = {}
  for (const [name, value] of Object.entries({ blind, plan, stage1, analysis })) {
    paths[name] = join(input, `${name}.json`)
    writeFileSync(paths[name], `${JSON.stringify(value, null, 2)}\n`)
  }
  return { repository, paths, blind, stage1, analysis }
}

function run(data, failAt) {
  return generateReport({
    blindInputPath: data.paths.blind,
    planInputPath: data.paths.plan,
    stageOnePath: data.paths.stage1,
    analysisPath: data.paths.analysis,
    failAt,
  })
}

test('Schema検証済みself-contained HTMLを安全に生成する', () => {
  const data = fixture()
  const result = run(data)
  assert.deepEqual(readdirSync(result.outputDirectory).sort(), [
    'index.html',
    'report.json',
  ])
  const html = readFileSync(result.indexPath, 'utf8')
  assert.doesNotMatch(html, /<\/script><script>globalThis\.pwned/u)
  assert.doesNotMatch(html, /\bfetch\s*\(/u)
  assert.doesNotMatch(html, /https?:\/\/[^"']+\.(?:js|css)/u)
  assert.match(html, /\\u003c\/script\\u003e/u)
})

test('diff本文のtemplate placeholderを置換対象として再解釈しない', () => {
  const data = fixture()
  const placeholderText = '{{STYLE}} {{REPORT_JSON}} {{SCRIPT}}'
  data.blind.files[0].hunks[0].lines[0].text = placeholderText
  writeFileSync(data.paths.blind, JSON.stringify(data.blind))

  const result = run(data)
  const html = readFileSync(result.indexPath, 'utf8')
  const embedded = html.match(
    /<script id="report-data" type="application\/json">([\s\S]*?)<\/script>\s*<script>([\s\S]*?)<\/script>\s*<\/body>/u,
  )
  assert.ok(embedded)
  const report = JSON.parse(embedded[1])
  assert.equal(report.groups[0].hunks[0].lines[0].text, placeholderText)
  assert.match(embedded[2], /window\.__explainedCodeReviewReady = true/u)
})

test('未知field、hunk欠落、Stage 1改変を拒否する', () => {
  const data = fixture()
  assert.throws(() => parseBlindInput({ ...data.blind, unknown: true }), /未知field/u)
  const missingHunk = structuredClone(data.analysis)
  missingHunk.groups[0].hunkIds = []
  writeFileSync(data.paths.analysis, JSON.stringify(missingHunk))
  assert.throws(() => run(data), /未割当hunk/u)
  const changed = structuredClone(data.analysis)
  changed.groups[0].findings[0].issue = 'changed'
  writeFileSync(data.paths.analysis, JSON.stringify(changed))
  assert.throws(() => run(data), /Stage 1 finding/u)
})

test('swap各段階の失敗は旧reviewへrollbackし残骸を残さない', () => {
  const data = fixture()
  run(data)
  const first = JSON.parse(
    readFileSync(join(data.repository, '.review/example-review/report.json'), 'utf8'),
  )
  for (const failurePoint of [
    'before-backup',
    'after-backup',
    'after-promote',
    'before-cleanup',
  ]) {
    const next = structuredClone(data.analysis)
    next.overview = `new overview ${failurePoint}`
    writeFileSync(data.paths.analysis, JSON.stringify(next))
    assert.throws(
      () =>
        run(data, (point) => {
          if (point === failurePoint) throw new Error('failpoint')
        }),
      /failpoint/u,
    )
    const restored = JSON.parse(
      readFileSync(join(data.repository, '.review/example-review/report.json'), 'utf8'),
    )
    assert.equal(restored.overview, first.overview)
    assert.deepEqual(
      readdirSync(join(data.repository, '.review')).sort(),
      ['example-review'],
    )
  }
})

test('targetなしで有効backupがあれば次回起動時に回復する', () => {
  const data = fixture()
  run(data)
  const reviewRoot = join(data.repository, '.review')
  renameSync(
    join(reviewRoot, 'example-review'),
    join(reviewRoot, '.backup-example-review-interrupted'),
  )
  run(data)
  assert.deepEqual(readdirSync(reviewRoot).sort(), ['example-review'])
})

test('終了済みprocessのlockを回収して中断済みbackupから回復する', () => {
  const data = fixture()
  run(data)
  const reviewRoot = join(data.repository, '.review')
  renameSync(
    join(reviewRoot, 'example-review'),
    join(reviewRoot, '.backup-example-review-interrupted'),
  )
  const lock = join(reviewRoot, '.lock-example-review')
  mkdirSync(lock)
  const exited = spawnSync(process.execPath, ['-e', ''])
  writeFileSync(
    join(lock, 'owner.json'),
    JSON.stringify({
      pid: exited.pid,
      createdAt: new Date().toISOString(),
    }),
  )

  run(data)

  assert.deepEqual(readdirSync(reviewRoot).sort(), ['example-review'])
})

test('実行中processが所有するlockは回収しない', () => {
  const data = fixture()
  const reviewRoot = join(data.repository, '.review')
  mkdirSync(reviewRoot)
  const lock = join(reviewRoot, '.lock-example-review')
  mkdirSync(lock)
  writeFileSync(
    join(lock, 'owner.json'),
    JSON.stringify({
      pid: process.pid,
      createdAt: new Date().toISOString(),
    }),
  )

  assert.throws(() => run(data), /生成が進行中/u)
  assert.equal(readdirSync(reviewRoot).includes('.lock-example-review'), true)
  rmSync(lock, { recursive: true })
})

test('standalone validatorは再生成しても同一で、copy先でnode_modulesなしに動く', () => {
  const validatorPath = join(skillDirectory, 'scripts/report-validator.mjs')
  const before = readFileSync(validatorPath, 'utf8')
  execFileSync(process.execPath, [join(skillDirectory, 'scripts/build-validator.mjs')], {
    cwd: skillDirectory,
  })
  assert.equal(readFileSync(validatorPath, 'utf8'), before)

  const portable = mkdtempSync(join(tmpdir(), 'explained-review-portable-'))
  cpSync(skillDirectory, join(portable, 'explained-code-review'), {
    recursive: true,
    filter: (source) => !source.includes(`${join(skillDirectory, 'node_modules')}`),
  })
  assert.equal(
    readFileSync(
      join(portable, 'explained-code-review/scripts/report-validator.mjs'),
      'utf8',
    ),
    before,
  )
})
