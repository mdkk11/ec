import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { validateBatchOutput } from './validate-batch-output.mjs'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const validatorPath = join(scriptDirectory, 'validate-batch-output.mjs')

function finding() {
  return {
    severity: 'medium',
    category: 'bug',
    locationKind: 'diff',
    lineSide: 'new',
    file: 'src/example.js',
    startLine: 1,
    endLine: 1,
    title: '境界条件の問題',
    issue: '問題がある。',
    rationale: '利用者に影響する。',
    suggestion: '境界を検証する。',
    confidence: 'high',
  }
}

function segmentedNotes(lineCount = 3) {
  return {
    fileId: 'file-1',
    responsibility: '対象hunkを説明する。',
    implementationSummary: '変更内容を区間へ分ける。',
    reviewPoints: ['全行が一度だけ説明されること'],
    detailLevel: 'segmented',
    summaryOnlyKind: null,
    summaryOnlyReason: null,
    segments:
      lineCount === 0
        ? []
        : [
            {
              startLineIndex: 0,
              endLineIndex: lineCount - 1,
              whatChanged: '処理を変更した。',
              why: '契約を満たすため。',
              reviewFocus: '境界を確認する。',
              findingIndexes: [0],
            },
          ],
  }
}

function fixture({
  mode = 'walkthrough',
  detailLevel = 'segmented',
  lineCount = 3,
} = {}) {
  const policy =
    detailLevel === 'summary-only'
      ? {
          detailLevel: 'summary-only',
          summaryOnlyKind: 'lockfile',
          rationale: 'lockfileは要約だけを表示します。',
        }
      : {
          detailLevel: 'segmented',
          summaryOnlyKind: null,
          rationale: null,
        }
  const notes =
    mode === 'review'
      ? null
      : detailLevel === 'summary-only'
        ? {
            fileId: 'file-1',
            responsibility: '依存解決結果を保持する。',
            implementationSummary: 'lockfileを更新した。',
            reviewPoints: ['依存versionを確認する。'],
            detailLevel: 'summary-only',
            summaryOnlyKind: 'lockfile',
            summaryOnlyReason: 'lockfileは要約だけを表示します。',
            segments: [],
          }
        : segmentedNotes(lineCount)
  const hunk = {
    id: 'hunk-1',
    fileId: 'file-1',
    file: 'src/example.js',
    header: '@@ -0,0 +1,3 @@',
    oldStart: 0,
    oldLines: 0,
    newStart: 1,
    newLines: lineCount,
    lines: Array.from({ length: lineCount }, (_, index) => ({
      kind: 'addition',
      oldLine: null,
      newLine: index + 1,
      text: `line ${index + 1}`,
    })),
  }
  const blind = {
    schemaVersion: 3,
    mode,
    rules: [],
    files: [
      {
        id: 'file-1',
        explanationPolicy: policy,
        hunks: [hunk],
      },
    ],
    blindBatches: [
      {
        id: 'blind-batch-1',
        hunkIds: ['hunk-1'],
      },
    ],
  }
  const output = {
    schemaVersion: 3,
    batchId: 'blind-batch-1',
    summary: '対象batchを確認した。',
    hunks: [
      {
        hunkId: 'hunk-1',
        suggestedGroupId: 'group-example',
        title: '対象変更',
        changeType: 'feature',
        risk: 'medium',
        intent: '契約を追加する。',
        implementationSummary: '実装を追加した。',
        impact: 'review生成に影響する。',
        verificationPoints: ['入力を検証すること'],
        findings: [finding()],
        walkthroughNotes: notes,
      },
    ],
  }
  return { blind, output }
}

test('指定batchのwalkthrough/review出力をsemantic検証する', () => {
  for (const data of [
    fixture(),
    fixture({ detailLevel: 'summary-only' }),
    fixture({ mode: 'review' }),
  ]) {
    assert.equal(
      validateBatchOutput(data.output, data.blind, 'blind-batch-1'),
      data.output,
    )
  }
})

test('batch IDとhunk集合の欠落・重複・未知参照を拒否する', () => {
  const wrongId = fixture()
  wrongId.output.batchId = 'blind-batch-2'
  assert.throws(
    () => validateBatchOutput(wrongId.output, wrongId.blind, 'blind-batch-1'),
    /batchIdが指定値と一致/u,
  )

  const missing = fixture()
  missing.output.hunks = []
  assert.throws(
    () => validateBatchOutput(missing.output, missing.blind, 'blind-batch-1'),
    /hunk集合/u,
  )

  const duplicate = fixture()
  duplicate.output.hunks.push(structuredClone(duplicate.output.hunks[0]))
  assert.throws(
    () => validateBatchOutput(duplicate.output, duplicate.blind, 'blind-batch-1'),
    /hunk IDが重複/u,
  )

  const unknown = fixture()
  unknown.output.hunks[0].hunkId = 'hunk-unknown'
  assert.throws(
    () => validateBatchOutput(unknown.output, unknown.blind, 'blind-batch-1'),
    /hunk集合/u,
  )
})

test('mode、fileId、collector explanationPolicyの不一致を拒否する', () => {
  const review = fixture({ mode: 'review' })
  review.output.hunks[0].walkthroughNotes = segmentedNotes()
  assert.throws(
    () => validateBatchOutput(review.output, review.blind, 'blind-batch-1'),
    /review mode/u,
  )

  const missing = fixture()
  missing.output.hunks[0].walkthroughNotes = null
  assert.throws(
    () => validateBatchOutput(missing.output, missing.blind, 'blind-batch-1'),
    /walkthrough mode/u,
  )

  const wrongFile = fixture()
  wrongFile.output.hunks[0].walkthroughNotes.fileId = 'file-2'
  assert.throws(
    () => validateBatchOutput(wrongFile.output, wrongFile.blind, 'blind-batch-1'),
    /fileIdがhunkと一致/u,
  )

  const wrongPolicy = fixture()
  wrongPolicy.output.hunks[0].walkthroughNotes = {
    ...fixture({ detailLevel: 'summary-only' }).output.hunks[0].walkthroughNotes,
    fileId: 'file-1',
  }
  assert.throws(
    () => validateBatchOutput(wrongPolicy.output, wrongPolicy.blind, 'blind-batch-1'),
    /collector explanationPolicy/u,
  )
})

test('Schemaがsegmentedとsummary-onlyのfield組合せを強制する', () => {
  const segmented = fixture()
  segmented.output.hunks[0].walkthroughNotes.summaryOnlyKind = 'generated'
  segmented.output.hunks[0].walkthroughNotes.summaryOnlyReason = '生成物'
  assert.throws(
    () => validateBatchOutput(segmented.output, segmented.blind, 'blind-batch-1'),
    /Schema違反/u,
  )

  const summary = fixture({ detailLevel: 'summary-only' })
  summary.output.hunks[0].walkthroughNotes.segments = [
    {
      startLineIndex: 0,
      endLineIndex: 0,
      whatChanged: '変更した。',
      why: '必要なため。',
      reviewFocus: '確認する。',
      findingIndexes: [],
    },
  ]
  assert.throws(
    () => validateBatchOutput(summary.output, summary.blind, 'blind-batch-1'),
    /Schema違反/u,
  )
})

test('segmentの昇順、範囲、120行上限、全行coverageを拒否条件まで検証する', () => {
  const gap = fixture()
  gap.output.hunks[0].walkthroughNotes.segments[0].startLineIndex = 1
  assert.throws(
    () => validateBatchOutput(gap.output, gap.blind, 'blind-batch-1'),
    /昇順の連続coverage/u,
  )

  const reversed = fixture()
  reversed.output.hunks[0].walkthroughNotes.segments = [
    {
      ...reversed.output.hunks[0].walkthroughNotes.segments[0],
      endLineIndex: 0,
    },
    {
      ...reversed.output.hunks[0].walkthroughNotes.segments[0],
      startLineIndex: 1,
      endLineIndex: 0,
    },
  ]
  assert.throws(
    () => validateBatchOutput(reversed.output, reversed.blind, 'blind-batch-1'),
    /endLineIndexがstartLineIndexより前/u,
  )

  const oversized = fixture({ lineCount: 121 })
  assert.throws(
    () => validateBatchOutput(oversized.output, oversized.blind, 'blind-batch-1'),
    /120 diff行/u,
  )

  const outside = fixture()
  outside.output.hunks[0].walkthroughNotes.segments[0].endLineIndex = 3
  assert.throws(
    () => validateBatchOutput(outside.output, outside.blind, 'blind-batch-1'),
    /diff行範囲/u,
  )

  const incomplete = fixture()
  incomplete.output.hunks[0].walkthroughNotes.segments[0].endLineIndex = 1
  assert.throws(
    () => validateBatchOutput(incomplete.output, incomplete.blind, 'blind-batch-1'),
    /全diff行をcoverage/u,
  )
})

test('segmentのfindingIndexesが同じhunk analysisのfinding範囲内であることを検証する', () => {
  const data = fixture()
  data.output.hunks[0].walkthroughNotes.segments[0].findingIndexes = [1]
  assert.throws(
    () => validateBatchOutput(data.output, data.blind, 'blind-batch-1'),
    /範囲外findingIndexes/u,
  )
})

test('locationKindごとのlineSide組合せをSchemaで強制する', () => {
  const diffWithoutSide = fixture()
  diffWithoutSide.output.hunks[0].findings[0].lineSide = null
  assert.throws(
    () =>
      validateBatchOutput(
        diffWithoutSide.output,
        diffWithoutSide.blind,
        'blind-batch-1',
      ),
    /Schema違反/u,
  )

  for (const locationKind of ['rule', 'repository']) {
    const nonDiffWithSide = fixture()
    nonDiffWithSide.output.hunks[0].findings[0].locationKind = locationKind
    nonDiffWithSide.output.hunks[0].findings[0].lineSide = 'new'
    assert.throws(
      () =>
        validateBatchOutput(
          nonDiffWithSide.output,
          nonDiffWithSide.blind,
          'blind-batch-1',
        ),
      /Schema違反/u,
    )
  }
})

test('findingの逆順rangeと割当hunk外のdiff locationを拒否する', () => {
  const reversed = fixture()
  Object.assign(reversed.output.hunks[0].findings[0], {
    locationKind: 'rule',
    lineSide: null,
    startLine: 3,
    endLine: 2,
  })
  assert.throws(
    () => validateBatchOutput(reversed.output, reversed.blind, 'blind-batch-1'),
    /startLineがendLineより後/u,
  )

  const wrongFile = fixture()
  wrongFile.output.hunks[0].findings[0].file = 'src/other.js'
  assert.throws(
    () => validateBatchOutput(wrongFile.output, wrongFile.blind, 'blind-batch-1'),
    /fileが割当hunkと一致/u,
  )

  const outsideRange = fixture()
  Object.assign(outsideRange.output.hunks[0].findings[0], {
    startLine: 4,
    endLine: 6,
  })
  assert.throws(
    () =>
      validateBatchOutput(
        outsideRange.output,
        outsideRange.blind,
        'blind-batch-1',
      ),
    /diff locationが割当hunkと交差/u,
  )

  const wrongSide = fixture()
  Object.assign(wrongSide.output.hunks[0].findings[0], {
    lineSide: 'old',
    startLine: 1,
    endLine: 3,
  })
  assert.throws(
    () => validateBatchOutput(wrongSide.output, wrongSide.blind, 'blind-batch-1'),
    /diff locationが割当hunkと交差/u,
  )
})

test('rule findingは収集済みruleの一意なpathと行範囲に限定する', () => {
  const valid = fixture()
  valid.blind.rules = [
    {
      path: 'AGENTS.md',
      content: '一行目\n二行目\n三行目',
    },
  ]
  Object.assign(valid.output.hunks[0].findings[0], {
    locationKind: 'rule',
    lineSide: null,
    file: 'AGENTS.md',
    startLine: 2,
    endLine: 3,
  })
  assert.equal(
    validateBatchOutput(valid.output, valid.blind, 'blind-batch-1'),
    valid.output,
  )

  const unknown = structuredClone(valid)
  unknown.output.hunks[0].findings[0].file = 'docs/AGENTS.md'
  assert.throws(
    () => validateBatchOutput(unknown.output, unknown.blind, 'blind-batch-1'),
    /rule fileを一意に解決できません/u,
  )

  const duplicate = structuredClone(valid)
  duplicate.blind.rules.push(structuredClone(duplicate.blind.rules[0]))
  assert.throws(
    () =>
      validateBatchOutput(
        duplicate.output,
        duplicate.blind,
        'blind-batch-1',
      ),
    /rule fileを一意に解決できません/u,
  )

  const outside = structuredClone(valid)
  outside.output.hunks[0].findings[0].endLine = 4
  assert.throws(
    () => validateBatchOutput(outside.output, outside.blind, 'blind-batch-1'),
    /rule locationが収集済みruleの行範囲を超えています/u,
  )
})

test('CLIはbatch output、blind input、batch-idの3引数を必須にする', () => {
  const directory = mkdtempSync(join(tmpdir(), 'batch-validator-'))
  const data = fixture()
  const outputPath = join(directory, 'batch-output.json')
  const blindPath = join(directory, 'blind-input.json')
  writeFileSync(outputPath, JSON.stringify(data.output))
  writeFileSync(blindPath, JSON.stringify(data.blind))
  const result = execFileSync(
    process.execPath,
    [validatorPath, outputPath, blindPath, 'blind-batch-1'],
    { encoding: 'utf8' },
  )
  assert.match(result, /valid \(blind-batch-1\)/u)

  const usage = spawnSync(process.execPath, [validatorPath, outputPath], {
    encoding: 'utf8',
  })
  assert.equal(usage.status, 2)
  assert.match(usage.stderr, /<blind-input\.json> <batch-id>/u)
})
