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
  enforceReportSize,
  generateReport,
  parseBlindInput,
} from './generate-report.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const skillDirectory = resolve(here, '..')

function fixture(reviewId = 'example-review') {
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
    fileExplanations: [],
  }
  const blind = {
    schemaVersion: 3,
    mode: 'review',
    reviewId,
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
        explanationPolicy: {
          detailLevel: 'segmented',
          summaryOnlyKind: null,
          rationale: null,
        },
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
    blindBatches: [
      {
        id: 'blind-batch-1',
        hunkIds: ['hunk-1'],
        diffLines: 1,
        rawBytes: 61,
        oversizedSingleHunk: false,
      },
    ],
    rules: [],
  }
  const stage1 = {
    schemaVersion: 3,
    mode: 'review',
    summary: 'Blind summary',
    groups: [group],
  }
  const analysis = {
    schemaVersion: 3,
    mode: 'review',
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
        planItemIds: ['plan-safe-output'],
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
    planCoverage: {
      status: 'completed',
      items: [
        {
          id: 'plan-safe-output',
          requirementKind: 'static',
          label: '安全に表示する',
          startLine: 1,
          endLine: 1,
          status: 'satisfied',
          rationale: '表示処理が実装されている。',
          evidence: [
            {
              kind: 'implementation',
              groupId: 'group-example',
              file: 'src/example.js',
              lineSide: 'new',
              startLine: 1,
              endLine: 1,
            },
          ],
          findingIds: [],
        },
      ],
    },
    verificationItems: [],
  }
  const plan = {
    schemaVersion: 3,
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

function run(data, failAt, extra = {}) {
  return generateReport({
    blindInputPath: data.paths.blind,
    planInputPath: data.paths.plan,
    stageOnePath: data.paths.stage1,
    analysisPath: data.paths.analysis,
    failAt,
    ...extra,
  })
}

function syncBlindBatchMetadata(blind) {
  const hunkMap = new Map(
    blind.files.flatMap((file) => file.hunks.map((hunk) => [hunk.id, hunk])),
  )
  for (const batch of blind.blindBatches) {
    const hunks = batch.hunkIds.map((id) => hunkMap.get(id))
    batch.diffLines = hunks.reduce((total, hunk) => total + hunk.lines.length, 0)
    batch.rawBytes = hunks.reduce(
      (total, hunk) =>
        total + Buffer.byteLength([hunk.header, ...hunk.lines.map((line) => line.text)].join('\n')),
      0,
    )
  }
}

function enableWalkthrough(data) {
  const stageExplanation = {
    id: 'file-explanation-example',
    fileId: 'file-1',
    responsibility: '安全な表示処理を担当する。',
    implementationSummary: '入力を実行せず文字列として表示する。',
    reviewPoints: ['文字列がそのまま復元されること'],
    detailLevel: 'segmented',
    summaryOnlyKind: null,
    summaryOnlyReason: null,
    segments: [
      {
        id: 'segment-example-1',
        hunkId: 'hunk-1',
        startLineIndex: 0,
        endLineIndex: 0,
        whatChanged: '表示対象の文字列を追加した。',
        why: 'script終端を含む入力への安全性を確認するため。',
        reviewFocus: 'HTMLとして解釈されないことを見る。',
        findingIds: ['S1-001'],
      },
    ],
  }
  data.blind.mode = 'walkthrough'
  data.stage1.mode = 'walkthrough'
  data.analysis.mode = 'walkthrough'
  data.stage1.groups[0].fileExplanations = [stageExplanation]
  data.analysis.groups[0].fileExplanations = [
    { ...structuredClone(stageExplanation), planItemIds: ['plan-safe-output'] },
  ]
  for (const name of ['blind', 'stage1', 'analysis']) {
    writeFileSync(data.paths[name], JSON.stringify(data[name]))
  }
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
  syncBlindBatchMetadata(data.blind)
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
  assert.throws(() => run(data), /Stage 1 group|Stage 1 finding/u)
})

test('Blind batch metadataを実hunkから再計算して不一致を拒否する', () => {
  const data = fixture('invalid-batch-metadata')
  data.blind.blindBatches[0].diffLines = 0
  writeFileSync(data.paths.blind, JSON.stringify(data.blind))
  assert.throws(() => run(data), /集計metadataがhunk内容と一致/u)
})

test('Stage 1 findingとsegmentへPlan由来参照を混入できない', () => {
  const planLocation = fixture('stage-one-plan-location')
  for (const finding of [
    planLocation.stage1.groups[0].findings[0],
    planLocation.analysis.groups[0].findings[0],
  ]) {
    finding.locationKind = 'plan'
    finding.lineSide = null
    finding.file = 'plans/review.md'
  }
  writeFileSync(planLocation.paths.stage1, JSON.stringify(planLocation.stage1))
  writeFileSync(planLocation.paths.analysis, JSON.stringify(planLocation.analysis))
  assert.throws(() => run(planLocation), /Stage 1 findingのstageまたはID/u)

  const segmentReference = fixture('stage-one-plan-segment')
  enableWalkthrough(segmentReference)
  segmentReference.stage1.groups[0].fileExplanations[0].segments[0].findingIds = [
    'S2-001',
  ]
  segmentReference.analysis.groups[0].fileExplanations[0].segments[0].findingIds = [
    'S2-001',
  ]
  segmentReference.analysis.groups[0].findings.push({
    ...structuredClone(segmentReference.analysis.groups[0].findings[0]),
    id: 'S2-001',
    stage: 'plan',
    locationKind: 'plan',
    lineSide: null,
    file: 'plans/review.md',
    planAssessment: { status: 'confirmed', rationale: 'Plan照合で追加した。' },
  })
  writeFileSync(segmentReference.paths.stage1, JSON.stringify(segmentReference.stage1))
  writeFileSync(segmentReference.paths.analysis, JSON.stringify(segmentReference.analysis))
  assert.throws(() => run(segmentReference), /segmentがgroup内の未知finding/u)
})

test('Planとrule findingを収集済みpath・行範囲へ拘束する', () => {
  const planLocation = fixture('invalid-plan-location')
  planLocation.analysis.groups[0].findings.push({
    ...structuredClone(planLocation.analysis.groups[0].findings[0]),
    id: 'S2-001',
    stage: 'plan',
    locationKind: 'plan',
    lineSide: null,
    file: 'plans/other.md',
    planAssessment: { status: 'confirmed', rationale: 'Plan照合で追加した。' },
  })
  writeFileSync(planLocation.paths.analysis, JSON.stringify(planLocation.analysis))
  assert.throws(() => run(planLocation), /Plan findingがselected Plan位置と一致/u)

  const ruleLocation = fixture('invalid-rule-location')
  ruleLocation.blind.rules = [{ path: 'AGENTS.md', content: 'one line' }]
  for (const finding of [
    ruleLocation.stage1.groups[0].findings[0],
    ruleLocation.analysis.groups[0].findings[0],
  ]) {
    finding.locationKind = 'rule'
    finding.lineSide = null
    finding.file = 'MISSING.md'
  }
  writeFileSync(ruleLocation.paths.blind, JSON.stringify(ruleLocation.blind))
  writeFileSync(ruleLocation.paths.stage1, JSON.stringify(ruleLocation.stage1))
  writeFileSync(ruleLocation.paths.analysis, JSON.stringify(ruleLocation.analysis))
  assert.throws(() => run(ruleLocation), /rule findingが収集済みrule位置と一致/u)
})

test('PlanなしではS1 findingのPlan評価を変更できない', () => {
  const data = fixture('no-plan-s1-assessment')
  data.analysis.planReview = { status: 'skipped-no-plan', planPath: null, summary: '' }
  data.analysis.planCoverage = { status: 'skipped-no-plan', items: [] }
  data.analysis.groups[0].planItemIds = []
  data.analysis.groups[0].findings[0].planAssessment = {
    status: 'confirmed',
    rationale: 'Planなしなのに変更した。',
  }
  writeFileSync(
    data.paths.plan,
    JSON.stringify({ schemaVersion: 3, resolution: 'disabled', path: null, content: null }),
  )
  writeFileSync(data.paths.analysis, JSON.stringify(data.analysis))
  assert.throws(() => run(data), /planなしではS1 findingのPlan評価を変更/u)
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
    join(reviewRoot, '.backup-14-example-review-interrupted'),
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
    join(reviewRoot, '.backup-14-example-review-interrupted'),
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

test('prefix一致する別reviewの中断backupを無視する', () => {
  const data = fixture('foo')
  const reviewRoot = join(data.repository, '.review')
  mkdirSync(reviewRoot)
  const otherBackup = join(
    reviewRoot,
    '.backup-7-foo-bar-interrupted',
  )
  mkdirSync(otherBackup)
  writeFileSync(
    join(otherBackup, 'report.json'),
    JSON.stringify({ review: { id: 'foo-bar' } }),
  )
  writeFileSync(join(otherBackup, 'index.html'), '<!doctype html>')

  run(data)

  assert.deepEqual(readdirSync(reviewRoot).sort(), [
    '.backup-7-foo-bar-interrupted',
    'foo',
  ])
})

test('S2 findingはconfirmedだけを許可しplanなしでは拒否する', () => {
  for (const status of ['not-reviewed', 'mitigated', 'context-resolved']) {
    const data = fixture()
    const stageTwo = {
      ...structuredClone(data.analysis.groups[0].findings[0]),
      id: 'S2-001',
      stage: 'plan',
      planAssessment: {
        status,
        rationale: 'invalid Stage 2 assessment',
      },
    }
    data.analysis.groups[0].findings.push(stageTwo)
    writeFileSync(data.paths.analysis, JSON.stringify(data.analysis))
    assert.throws(() => run(data), /S2 finding.*confirmed/u)
  }

  const noPlan = fixture()
  const stageTwo = {
    ...structuredClone(noPlan.analysis.groups[0].findings[0]),
    id: 'S2-001',
    stage: 'plan',
    planAssessment: {
      status: 'confirmed',
      rationale: 'plan finding',
    },
  }
  noPlan.analysis.groups[0].findings.push(stageTwo)
  noPlan.analysis.planReview = {
    status: 'skipped-no-plan',
    planPath: null,
    summary: '',
  }
  writeFileSync(
    noPlan.paths.plan,
    JSON.stringify({
      schemaVersion: 3,
      resolution: 'disabled',
      path: null,
      content: null,
    }),
  )
  writeFileSync(noPlan.paths.analysis, JSON.stringify(noPlan.analysis))
  assert.throws(() => run(noPlan), /planなし.*S2 finding/u)
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

test('walkthroughはgroup-scoped file explanationとsegment全行coverageを検証する', () => {
  const data = fixture('walkthrough-review')
  enableWalkthrough(data)
  const result = run(data)
  const report = JSON.parse(readFileSync(result.reportPath, 'utf8'))
  assert.equal(report.mode, 'walkthrough')
  assert.equal(report.groups[0].fileExplanations[0].segments.length, 1)

  const gap = structuredClone(data.analysis)
  gap.groups[0].fileExplanations[0].segments = []
  writeFileSync(data.paths.analysis, JSON.stringify(gap))
  assert.throws(() => run(data), /Stage 1 group|未説明diff行/u)
})

test('walkthroughは重複segment IDを拒否する', () => {
  const data = fixture('duplicate-segment-review')
  enableWalkthrough(data)
  const duplicate = {
    ...structuredClone(data.stage1.groups[0].fileExplanations[0].segments[0]),
    startLineIndex: 1,
    endLineIndex: 1,
  }
  data.blind.files[0].hunks[0].lines.push({
    kind: 'addition',
    oldLine: null,
    newLine: 2,
    text: 'second line',
  })
  syncBlindBatchMetadata(data.blind)
  data.stage1.groups[0].fileExplanations[0].segments.push(duplicate)
  data.analysis.groups[0].fileExplanations[0].segments.push({
    ...structuredClone(duplicate),
    planItemIds: undefined,
  })
  for (const name of ['blind', 'stage1', 'analysis']) {
    writeFileSync(data.paths[name], JSON.stringify(data[name]))
  }
  assert.throws(() => run(data), /segment IDが重複/u)
})

test('同じPlan行のstatic coverageとruntime verificationを許可する', () => {
  const data = fixture('shared-plan-line-review')
  data.analysis.verificationItems = [
    {
      id: 'verify-safe-output',
      requirementKind: 'runtime',
      label: '安全な表示を実行確認する',
      startLine: 1,
      endLine: 1,
      requiredAction: '生成reportを開いて確認する',
      status: 'not-verified',
    },
  ]
  writeFileSync(data.paths.analysis, JSON.stringify(data.analysis))
  assert.doesNotThrow(() => run(data))
})

test('collector分類と異なるsummary-only指定を拒否する', () => {
  const data = fixture('summary-policy-review')
  enableWalkthrough(data)
  const stageExplanation = data.stage1.groups[0].fileExplanations[0]
  stageExplanation.detailLevel = 'summary-only'
  stageExplanation.summaryOnlyKind = 'generated'
  stageExplanation.summaryOnlyReason = '任意に省略する'
  stageExplanation.segments = []
  const finalExplanation = data.analysis.groups[0].fileExplanations[0]
  Object.assign(finalExplanation, structuredClone(stageExplanation), {
    planItemIds: ['plan-safe-output'],
  })
  writeFileSync(data.paths.stage1, JSON.stringify(data.stage1))
  writeFileSync(data.paths.analysis, JSON.stringify(data.analysis))
  assert.throws(() => run(data), /collector分類/u)
})

test('Planなしwalkthroughでもsegmentの未知finding参照を拒否する', () => {
  const data = fixture('no-plan-segment-finding-review')
  enableWalkthrough(data)
  data.stage1.groups[0].fileExplanations[0].segments[0].findingIds = ['S1-999']
  data.analysis.groups[0].fileExplanations[0].segments[0].findingIds = ['S1-999']
  data.analysis.planReview = {
    status: 'skipped-no-plan',
    planPath: null,
    summary: '',
  }
  data.analysis.planCoverage = { status: 'skipped-no-plan', items: [] }
  data.analysis.groups[0].planItemIds = []
  data.analysis.groups[0].fileExplanations[0].planItemIds = []
  writeFileSync(
    data.paths.plan,
    JSON.stringify({
      schemaVersion: 3,
      resolution: 'disabled',
      path: null,
      content: null,
    }),
  )
  writeFileSync(data.paths.stage1, JSON.stringify(data.stage1))
  writeFileSync(data.paths.analysis, JSON.stringify(data.analysis))
  assert.throws(() => run(data), /segmentがgroup内の未知finding/u)
})

test('partial/missing Plan項目はS2 findingを必須にする', () => {
  const data = fixture('plan-gap-review')
  data.analysis.planCoverage.items[0].status = 'partial'
  data.analysis.planCoverage.items[0].evidence = []
  writeFileSync(data.paths.analysis, JSON.stringify(data.analysis))
  assert.throws(() => run(data), /S2 finding/u)

  const stageTwo = {
    ...structuredClone(data.analysis.groups[0].findings[0]),
    id: 'S2-001',
    stage: 'plan',
    locationKind: 'plan',
    lineSide: null,
    file: 'plans/review.md',
    planAssessment: { status: 'confirmed', rationale: 'Plan項目が一部不足している。' },
  }
  data.analysis.groups[0].findings.push(stageTwo)
  data.analysis.planCoverage.items[0].findingIds = ['S2-001']
  writeFileSync(data.paths.analysis, JSON.stringify(data.analysis))
  assert.doesNotThrow(() => run(data))
})

test('review/walkthroughとtoken payloadの差はgroup fingerprintを変えない', () => {
  const data = fixture('stable-fingerprint-review')
  const review = run(data)
  const before = JSON.parse(readFileSync(review.reportPath, 'utf8')).groups[0].fingerprint
  enableWalkthrough(data)
  const walkthrough = run(data)
  const after = JSON.parse(readFileSync(walkthrough.reportPath, 'utf8')).groups[0].fingerprint
  assert.equal(after, before)
})

test('report容量超過時は最大highlight payloadからreport-size fallbackする', () => {
  const data = fixture('report-size-review')
  const lines = Array.from({ length: 100 }, (_, index) => ({
    kind: 'addition',
    oldLine: null,
    newLine: index + 1,
    text: `export function calculate${index}(items) { return items.reduce((sum, item) => sum + item.price * item.quantity, 0) }`,
  }))
  data.blind.files[0].hunks[0].lines = lines
  data.blind.files[0].hunks[0].newLines = lines.length
  syncBlindBatchMetadata(data.blind)
  writeFileSync(data.paths.blind, JSON.stringify(data.blind))
  const first = run(data)
  const highlighted = JSON.parse(readFileSync(first.reportPath, 'utf8'))
  assert.ok(highlighted.groups[0].hunks[0].lines.some((line) => line.tokenRuns.length))
  const plain = structuredClone(highlighted)
  for (const line of plain.groups[0].hunks[0].lines) line.tokenRuns = []
  plain.highlighting.fallbacks.push({ hunkId: 'hunk-1', reason: 'report-size' })
  const highlightedBytes = Buffer.byteLength(JSON.stringify(highlighted, null, 2))
  const plainBytes = Buffer.byteLength(JSON.stringify(plain, null, 2))
  const maximum = Math.floor((highlightedBytes + plainBytes) / 2)
  const fallback = run(data, undefined, { reportBytesLimit: maximum })
  const result = JSON.parse(readFileSync(fallback.reportPath, 'utf8'))
  assert.ok(result.highlighting.fallbacks.some((item) => item.reason === 'report-size'))
  assert.ok(result.groups[0].hunks[0].lines.every((line) => line.tokenRuns.length === 0))
  assert.ok(Buffer.byteLength(readFileSync(fallback.reportPath)) <= maximum)
})

test('report容量制御は複数hunkをまとめて縮小する', () => {
  const report = {
    groups: [
      {
        hunks: Array.from({ length: 100 }, (_, hunkIndex) => ({
          id: `hunk-${hunkIndex}`,
          lines: Array.from({ length: 200 }, (_, lineIndex) => ({
            tokenRuns: lineIndex === 0 ? [[0, 120, 0]] : [],
          })),
        })),
      },
    ],
    highlighting: { fallbacks: [] },
  }
  const plain = structuredClone(report)
  for (const hunk of plain.groups[0].hunks) {
    for (const line of hunk.lines) line.tokenRuns = []
    plain.highlighting.fallbacks.push({
      hunkId: hunk.id,
      reason: 'report-size',
    })
  }
  const measure = (value) => Buffer.byteLength(JSON.stringify(value, null, 2))
  const maximum = Math.floor((measure(report) + measure(plain)) / 2)
  let measurementCount = 0

  enforceReportSize(report, maximum, (value) => {
    measurementCount += 1
    return measure(value)
  })

  assert.ok(measure(report) <= maximum)
  assert.ok(report.highlighting.fallbacks.length > 1)
  assert.ok(measurementCount <= 4)
})

test('report容量制御は必要なhunkだけをfallbackする', () => {
  const report = {
    groups: [
      {
        hunks: Array.from({ length: 2 }, (_, hunkIndex) => ({
          id: `hunk-${hunkIndex}`,
          lines: Array.from({ length: 20 }, () => ({
            tokenRuns: [[0, 120, 0]],
          })),
        })),
      },
    ],
    highlighting: { fallbacks: [] },
  }
  const oneFallback = structuredClone(report)
  for (const line of oneFallback.groups[0].hunks[0].lines) line.tokenRuns = []
  oneFallback.highlighting.fallbacks.push({
    hunkId: 'hunk-0',
    reason: 'report-size',
  })
  const measure = (value) => Buffer.byteLength(JSON.stringify(value, null, 2))
  const maximum = measure(oneFallback)

  enforceReportSize(report, maximum)

  assert.ok(measure(report) <= maximum)
  assert.deepEqual(report.highlighting.fallbacks, [
    { hunkId: 'hunk-0', reason: 'report-size' },
  ])
  assert.ok(report.groups[0].hunks[1].lines.every((line) => line.tokenRuns.length))
})
