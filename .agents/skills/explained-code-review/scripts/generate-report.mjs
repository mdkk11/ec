import { createHash, randomUUID } from 'node:crypto'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'

import validateReport, {
  schemaSha256 as generatedSchemaSha256,
} from './report-validator.mjs'
import {
  HIGHLIGHT_LIMITS,
  highlightHunks,
  validateTokenRuns,
} from './syntax-highlighting.mjs'

const RISKS = ['critical', 'high', 'medium', 'low']
const CHANGE_TYPES = [
  'feature',
  'fix',
  'refactor',
  'test',
  'docs',
  'build',
  'chore',
  'mixed',
]
const CONFIDENCES = ['high', 'medium', 'low']
const CATEGORIES = [
  'bug',
  'regression',
  'security',
  'data-integrity',
  'performance',
  'responsibility',
  'complexity',
  'error-handling',
  'test-gap',
  'unclear-change',
  'requirement-gap',
  'plan-mismatch',
  'unplanned-impact',
  'plan-defect',
]
const LOCATION_KINDS = ['diff', 'plan', 'rule', 'repository']
const ASSESSMENTS = [
  'confirmed',
  'mitigated',
  'context-resolved',
  'not-reviewed',
]
const PLAN_STATUSES = ['satisfied', 'partial', 'missing', 'not-applicable']
const EVIDENCE_KINDS = ['implementation', 'test', 'documentation']
const RISK_WEIGHT = Object.freeze({
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
})
const REVIEW_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/u
const BLIND_BATCH_LIMITS = Object.freeze({ lines: 4_000, bytes: 1024 * 1024 })

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    throw new Error(
      `JSONを読み込めません: ${path}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }
}

function exactObject(value, label, allowed, required = allowed) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label}はobjectである必要があります。`)
  }
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      throw new Error(`${label}に未知fieldがあります: ${key}`)
    }
  }
  for (const key of required) {
    if (!(key in value)) {
      throw new Error(`${label}に必須fieldがありません: ${key}`)
    }
  }
  return value
}

function string(value, label, { allowEmpty = false } = {}) {
  if (typeof value !== 'string' || (!allowEmpty && value.length === 0)) {
    throw new Error(`${label}は${allowEmpty ? '' : '空でない'}stringである必要があります。`)
  }
  return value
}

function integer(value, label, minimum = 0) {
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(`${label}は${minimum}以上のintegerである必要があります。`)
  }
  return value
}

function enumValue(value, allowed, label) {
  if (!allowed.includes(value)) {
    throw new Error(`${label}が不正です: ${String(value)}`)
  }
  return value
}

function array(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label}はarrayである必要があります。`)
  return value
}

function nullableString(value, label) {
  return value === null ? null : string(value, label)
}

function parseDiffLine(value, label) {
  const object = exactObject(value, label, [
    'kind',
    'oldLine',
    'newLine',
    'text',
  ])
  return {
    kind: enumValue(
      object.kind,
      ['context', 'addition', 'deletion', 'meta'],
      `${label}.kind`,
    ),
    oldLine:
      object.oldLine === null
        ? null
        : integer(object.oldLine, `${label}.oldLine`, 1),
    newLine:
      object.newLine === null
        ? null
        : integer(object.newLine, `${label}.newLine`, 1),
    text: string(object.text, `${label}.text`, { allowEmpty: true }),
  }
}

function parseHunk(value, label) {
  const object = exactObject(value, label, [
    'id',
    'fileId',
    'file',
    'header',
    'oldStart',
    'oldLines',
    'newStart',
    'newLines',
    'lines',
  ])
  return {
    id: string(object.id, `${label}.id`),
    fileId: string(object.fileId, `${label}.fileId`),
    file: string(object.file, `${label}.file`),
    header: string(object.header, `${label}.header`, { allowEmpty: true }),
    oldStart: integer(object.oldStart, `${label}.oldStart`),
    oldLines: integer(object.oldLines, `${label}.oldLines`),
    newStart: integer(object.newStart, `${label}.newStart`),
    newLines: integer(object.newLines, `${label}.newLines`),
    lines: array(object.lines, `${label}.lines`).map((line, index) =>
      parseDiffLine(line, `${label}.lines[${index}]`),
    ),
  }
}

function parseFile(value, label) {
  const object = exactObject(value, label, [
    'id',
    'path',
    'oldPath',
    'newPath',
    'status',
    'additions',
    'deletions',
    'binary',
    'size',
    'changeSources',
    'hunks',
    'explanationPolicy',
  ])
  if (typeof object.binary !== 'boolean') {
    throw new Error(`${label}.binaryはbooleanである必要があります。`)
  }
  const policy = exactObject(object.explanationPolicy, `${label}.explanationPolicy`, [
    'detailLevel',
    'summaryOnlyKind',
    'rationale',
  ])
  return {
    id: string(object.id, `${label}.id`),
    path: string(object.path, `${label}.path`),
    oldPath: nullableString(object.oldPath, `${label}.oldPath`),
    newPath: nullableString(object.newPath, `${label}.newPath`),
    status: string(object.status, `${label}.status`),
    additions: integer(object.additions, `${label}.additions`),
    deletions: integer(object.deletions, `${label}.deletions`),
    binary: object.binary,
    size: integer(object.size, `${label}.size`),
    changeSources: array(
      object.changeSources,
      `${label}.changeSources`,
    ).map((source, index) =>
      enumValue(
        source,
        ['committed', 'staged', 'unstaged', 'untracked'],
        `${label}.changeSources[${index}]`,
      ),
    ),
    hunks: array(object.hunks, `${label}.hunks`).map((hunk, index) =>
      parseHunk(hunk, `${label}.hunks[${index}]`),
    ),
    explanationPolicy: {
      detailLevel: enumValue(
        policy.detailLevel,
        ['segmented', 'summary-only'],
        `${label}.explanationPolicy.detailLevel`,
      ),
      summaryOnlyKind:
        policy.summaryOnlyKind === null
          ? null
          : enumValue(
              policy.summaryOnlyKind,
              ['binary', 'lockfile', 'source-map', 'minified', 'generated'],
              `${label}.explanationPolicy.summaryOnlyKind`,
            ),
      rationale: nullableString(
        policy.rationale,
        `${label}.explanationPolicy.rationale`,
      ),
    },
  }
}

function parseStats(value, label) {
  const keys = [
    'files',
    'hunks',
    'additions',
    'deletions',
    'committedFiles',
    'stagedFiles',
    'unstagedFiles',
    'untrackedFiles',
  ]
  const object = exactObject(value, label, keys)
  return Object.fromEntries(
    keys.map((key) => [key, integer(object[key], `${label}.${key}`)]),
  )
}

function parseCommit(value, label) {
  const object = exactObject(value, label, [
    'oid',
    'shortOid',
    'author',
    'authoredAt',
    'subject',
  ])
  return {
    oid: string(object.oid, `${label}.oid`),
    shortOid: string(object.shortOid, `${label}.shortOid`),
    author: string(object.author, `${label}.author`, { allowEmpty: true }),
    authoredAt: string(object.authoredAt, `${label}.authoredAt`),
    subject: string(object.subject, `${label}.subject`, { allowEmpty: true }),
  }
}

export function parseBlindInput(value) {
  const object = exactObject(value, 'blind input', [
    'schemaVersion',
    'mode',
    'reviewId',
    'repositoryRoot',
    'repositoryHash',
    'snapshot',
    'git',
    'stats',
    'files',
    'blindBatches',
    'rules',
  ])
  if (object.schemaVersion !== 3) throw new Error('blind input versionが不正です。')
  const snapshot = exactObject(object.snapshot, 'blind input.snapshot', [
    'scope',
    'collectedAt',
    'workspaceFingerprint',
  ])
  const git = exactObject(object.git, 'blind input.git', [
    'baseRef',
    'baseOid',
    'headOid',
    'mergeBase',
    'branch',
    'ahead',
    'behind',
    'commits',
  ])
  const reviewId = string(object.reviewId, 'blind input.reviewId')
  if (
    !REVIEW_ID_PATTERN.test(reviewId) ||
    reviewId === '.' ||
    reviewId === '..' ||
    reviewId.startsWith('.tmp-') ||
    reviewId.startsWith('.backup-') ||
    reviewId.startsWith('.lock-')
  ) {
    throw new Error('blind input.reviewIdが安全な単一path要素ではありません。')
  }
  return {
    schemaVersion: 3,
    mode: enumValue(object.mode, ['review', 'walkthrough'], 'blind input.mode'),
    reviewId,
    repositoryRoot: string(object.repositoryRoot, 'blind input.repositoryRoot'),
    repositoryHash: string(object.repositoryHash, 'blind input.repositoryHash'),
    snapshot: {
      scope: enumValue(
        snapshot.scope,
        ['workspace', 'commits'],
        'blind input.snapshot.scope',
      ),
      collectedAt: string(
        snapshot.collectedAt,
        'blind input.snapshot.collectedAt',
      ),
      workspaceFingerprint: string(
        snapshot.workspaceFingerprint,
        'blind input.snapshot.workspaceFingerprint',
      ),
    },
    git: {
      baseRef: string(git.baseRef, 'blind input.git.baseRef'),
      baseOid: string(git.baseOid, 'blind input.git.baseOid'),
      headOid: string(git.headOid, 'blind input.git.headOid'),
      mergeBase: string(git.mergeBase, 'blind input.git.mergeBase'),
      branch: string(git.branch, 'blind input.git.branch'),
      ahead: integer(git.ahead, 'blind input.git.ahead'),
      behind: integer(git.behind, 'blind input.git.behind'),
      commits: array(git.commits, 'blind input.git.commits').map((commit, index) =>
        parseCommit(commit, `blind input.git.commits[${index}]`),
      ),
    },
    stats: parseStats(object.stats, 'blind input.stats'),
    files: array(object.files, 'blind input.files').map((file, index) =>
      parseFile(file, `blind input.files[${index}]`),
    ),
    blindBatches: array(object.blindBatches, 'blind input.blindBatches').map(
      (batch, index) => {
        const parsed = exactObject(batch, `blind input.blindBatches[${index}]`, [
          'id', 'hunkIds', 'diffLines', 'rawBytes', 'oversizedSingleHunk',
        ])
        if (typeof parsed.oversizedSingleHunk !== 'boolean') {
          throw new Error('blind batch.oversizedSingleHunkはbooleanである必要があります。')
        }
        return {
          id: string(parsed.id, `blind input.blindBatches[${index}].id`),
          hunkIds: array(parsed.hunkIds, `blind input.blindBatches[${index}].hunkIds`).map(
            (id, hunkIndex) => string(id, `blind input.blindBatches[${index}].hunkIds[${hunkIndex}]`),
          ),
          diffLines: integer(parsed.diffLines, `blind input.blindBatches[${index}].diffLines`),
          rawBytes: integer(parsed.rawBytes, `blind input.blindBatches[${index}].rawBytes`),
          oversizedSingleHunk: parsed.oversizedSingleHunk,
        }
      },
    ),
    rules: array(object.rules, 'blind input.rules').map((rule, index) => {
      const parsed = exactObject(rule, `blind input.rules[${index}]`, [
        'path',
        'content',
      ])
      return {
        path: string(parsed.path, `blind input.rules[${index}].path`),
        content: string(parsed.content, `blind input.rules[${index}].content`, {
          allowEmpty: true,
        }),
      }
    }),
  }
}

export function parsePlanInput(value) {
  const object = exactObject(value, 'plan input', [
    'schemaVersion',
    'resolution',
    'path',
    'content',
  ])
  if (object.schemaVersion !== 3) throw new Error('plan input versionが不正です。')
  const resolution = enumValue(
    object.resolution,
    ['explicit', 'auto', 'absent', 'disabled'],
    'plan input.resolution',
  )
  const path = nullableString(object.path, 'plan input.path')
  const content = nullableString(object.content, 'plan input.content')
  if (
    (['absent', 'disabled'].includes(resolution) && (path !== null || content !== null)) ||
    (!['absent', 'disabled'].includes(resolution) &&
      (path === null || content === null))
  ) {
    throw new Error('plan inputのresolutionとpath/contentが一致しません。')
  }
  return { schemaVersion: 3, resolution, path, content }
}

function parseAssessment(value, label) {
  const object = exactObject(value, label, ['status', 'rationale'])
  return {
    status: enumValue(object.status, ASSESSMENTS, `${label}.status`),
    rationale: string(object.rationale, `${label}.rationale`),
  }
}

function parseFinding(value, label) {
  const object = exactObject(value, label, [
    'id',
    'stage',
    'severity',
    'category',
    'locationKind',
    'lineSide',
    'file',
    'startLine',
    'endLine',
    'title',
    'issue',
    'rationale',
    'suggestion',
    'confidence',
    'planAssessment',
  ])
  return {
    id: string(object.id, `${label}.id`),
    stage: enumValue(object.stage, ['blind', 'plan'], `${label}.stage`),
    severity: enumValue(object.severity, RISKS, `${label}.severity`),
    category: enumValue(object.category, CATEGORIES, `${label}.category`),
    locationKind: enumValue(
      object.locationKind,
      LOCATION_KINDS,
      `${label}.locationKind`,
    ),
    lineSide:
      object.lineSide === null
        ? null
        : enumValue(object.lineSide, ['old', 'new'], `${label}.lineSide`),
    file: string(object.file, `${label}.file`),
    startLine: integer(object.startLine, `${label}.startLine`, 1),
    endLine: integer(object.endLine, `${label}.endLine`, 1),
    title: string(object.title, `${label}.title`),
    issue: string(object.issue, `${label}.issue`),
    rationale: string(object.rationale, `${label}.rationale`),
    suggestion: string(object.suggestion, `${label}.suggestion`),
    confidence: enumValue(
      object.confidence,
      CONFIDENCES,
      `${label}.confidence`,
    ),
    planAssessment: parseAssessment(
      object.planAssessment,
      `${label}.planAssessment`,
    ),
  }
}

function parseSegment(value, label) {
  const object = exactObject(value, label, [
    'id', 'hunkId', 'startLineIndex', 'endLineIndex', 'whatChanged', 'why',
    'reviewFocus', 'findingIds',
  ])
  return {
    id: string(object.id, `${label}.id`),
    hunkId: string(object.hunkId, `${label}.hunkId`),
    startLineIndex: integer(object.startLineIndex, `${label}.startLineIndex`),
    endLineIndex: integer(object.endLineIndex, `${label}.endLineIndex`),
    whatChanged: string(object.whatChanged, `${label}.whatChanged`),
    why: string(object.why, `${label}.why`),
    reviewFocus: string(object.reviewFocus, `${label}.reviewFocus`),
    findingIds: array(object.findingIds, `${label}.findingIds`).map((id, index) =>
      string(id, `${label}.findingIds[${index}]`),
    ),
  }
}

function parseFileExplanation(value, label, final) {
  const keys = [
    'id', 'fileId', 'responsibility', 'implementationSummary', 'reviewPoints',
    'detailLevel', 'summaryOnlyKind', 'summaryOnlyReason', 'segments',
    ...(final ? ['planItemIds'] : []),
  ]
  const object = exactObject(value, label, keys)
  return {
    id: string(object.id, `${label}.id`),
    fileId: string(object.fileId, `${label}.fileId`),
    responsibility: string(object.responsibility, `${label}.responsibility`),
    implementationSummary: string(
      object.implementationSummary,
      `${label}.implementationSummary`,
    ),
    reviewPoints: array(object.reviewPoints, `${label}.reviewPoints`).map(
      (point, index) => string(point, `${label}.reviewPoints[${index}]`),
    ),
    detailLevel: enumValue(
      object.detailLevel,
      ['segmented', 'summary-only'],
      `${label}.detailLevel`,
    ),
    summaryOnlyKind:
      object.summaryOnlyKind === null
        ? null
        : enumValue(
            object.summaryOnlyKind,
            ['binary', 'lockfile', 'source-map', 'minified', 'generated'],
            `${label}.summaryOnlyKind`,
          ),
    summaryOnlyReason: nullableString(
      object.summaryOnlyReason,
      `${label}.summaryOnlyReason`,
    ),
    segments: array(object.segments, `${label}.segments`).map((segment, index) =>
      parseSegment(segment, `${label}.segments[${index}]`),
    ),
    ...(final
      ? {
          planItemIds: array(object.planItemIds, `${label}.planItemIds`).map(
            (id, index) => string(id, `${label}.planItemIds[${index}]`),
          ),
        }
      : {}),
  }
}

function parseAnalysisGroup(value, label, final = false) {
  const object = exactObject(value, label, [
    'id',
    'title',
    'summary',
    'changeType',
    'risk',
    'intent',
    'implementationSummary',
    'impact',
    'verificationPoints',
    'hunkIds',
    'findings',
    'fileExplanations',
    ...(final ? ['planItemIds'] : []),
  ])
  return {
    id: string(object.id, `${label}.id`),
    title: string(object.title, `${label}.title`),
    summary: string(object.summary, `${label}.summary`),
    changeType: enumValue(
      object.changeType,
      CHANGE_TYPES,
      `${label}.changeType`,
    ),
    risk: enumValue(object.risk, RISKS, `${label}.risk`),
    intent: string(object.intent, `${label}.intent`),
    implementationSummary: string(
      object.implementationSummary,
      `${label}.implementationSummary`,
    ),
    impact: string(object.impact, `${label}.impact`),
    verificationPoints: array(
      object.verificationPoints,
      `${label}.verificationPoints`,
    ).map((point, index) =>
      string(point, `${label}.verificationPoints[${index}]`),
    ),
    hunkIds: array(object.hunkIds, `${label}.hunkIds`).map((id, index) =>
      string(id, `${label}.hunkIds[${index}]`),
    ),
    findings: array(object.findings, `${label}.findings`).map((finding, index) =>
      parseFinding(finding, `${label}.findings[${index}]`),
    ),
    fileExplanations: array(
      object.fileExplanations,
      `${label}.fileExplanations`,
    ).map((explanation, index) =>
      parseFileExplanation(
        explanation,
        `${label}.fileExplanations[${index}]`,
        final,
      ),
    ),
    ...(final
      ? {
          planItemIds: array(object.planItemIds, `${label}.planItemIds`).map(
            (id, index) => string(id, `${label}.planItemIds[${index}]`),
          ),
        }
      : {}),
  }
}

export function parseStageOne(value) {
  const object = exactObject(value, 'Stage 1 analysis', [
    'schemaVersion',
    'mode',
    'summary',
    'groups',
  ])
  if (object.schemaVersion !== 3) throw new Error('Stage 1 versionが不正です。')
  return {
    schemaVersion: 3,
    mode: enumValue(object.mode, ['review', 'walkthrough'], 'Stage 1 mode'),
    summary: string(object.summary, 'Stage 1 analysis.summary'),
    groups: array(object.groups, 'Stage 1 analysis.groups').map((group, index) =>
      parseAnalysisGroup(group, `Stage 1 analysis.groups[${index}]`),
    ),
  }
}

function parseEvidence(value, label) {
  const object = exactObject(value, label, [
    'kind', 'groupId', 'file', 'lineSide', 'startLine', 'endLine',
  ])
  const file = nullableString(object.file, `${label}.file`)
  const lineSide = object.lineSide === null
    ? null
    : enumValue(object.lineSide, ['old', 'new'], `${label}.lineSide`)
  const startLine = object.startLine === null
    ? null
    : integer(object.startLine, `${label}.startLine`, 1)
  const endLine = object.endLine === null
    ? null
    : integer(object.endLine, `${label}.endLine`, 1)
  if (
    (file === null) !== (lineSide === null) ||
    (file === null) !== (startLine === null) ||
    (file === null) !== (endLine === null)
  ) throw new Error(`${label}のfile位置fieldはまとめて指定してください。`)
  return {
    kind: enumValue(object.kind, EVIDENCE_KINDS, `${label}.kind`),
    groupId: string(object.groupId, `${label}.groupId`),
    file,
    lineSide,
    startLine,
    endLine,
  }
}

function parsePlanCoverageItem(value, label) {
  const object = exactObject(value, label, [
    'id', 'requirementKind', 'label', 'startLine', 'endLine', 'status', 'rationale', 'evidence',
    'findingIds',
  ])
  return {
    id: string(object.id, `${label}.id`),
    requirementKind: enumValue(
      object.requirementKind,
      ['static'],
      `${label}.requirementKind`,
    ),
    label: string(object.label, `${label}.label`),
    startLine: integer(object.startLine, `${label}.startLine`, 1),
    endLine: integer(object.endLine, `${label}.endLine`, 1),
    status: enumValue(object.status, PLAN_STATUSES, `${label}.status`),
    rationale: string(object.rationale, `${label}.rationale`),
    evidence: array(object.evidence, `${label}.evidence`).map((entry, index) =>
      parseEvidence(entry, `${label}.evidence[${index}]`),
    ),
    findingIds: array(object.findingIds, `${label}.findingIds`).map((id, index) =>
      string(id, `${label}.findingIds[${index}]`),
    ),
  }
}

function parseVerificationItem(value, label) {
  const object = exactObject(value, label, [
    'id', 'requirementKind', 'label', 'startLine', 'endLine', 'requiredAction', 'status',
  ])
  return {
    id: string(object.id, `${label}.id`),
    requirementKind: enumValue(
      object.requirementKind,
      ['runtime'],
      `${label}.requirementKind`,
    ),
    label: string(object.label, `${label}.label`),
    startLine: integer(object.startLine, `${label}.startLine`, 1),
    endLine: integer(object.endLine, `${label}.endLine`, 1),
    requiredAction: string(object.requiredAction, `${label}.requiredAction`),
    status: enumValue(object.status, ['not-verified'], `${label}.status`),
  }
}

export function parseFinalAnalysis(value) {
  const object = exactObject(value, 'final analysis', [
    'schemaVersion',
    'mode',
    'overview',
    'blindSummary',
    'planReview',
    'groups',
    'planCoverage',
    'verificationItems',
  ])
  if (object.schemaVersion !== 3) throw new Error('final analysis versionが不正です。')
  const planReview = exactObject(object.planReview, 'final analysis.planReview', [
    'status',
    'planPath',
    'summary',
  ])
  const coverage = exactObject(object.planCoverage, 'final analysis.planCoverage', [
    'status', 'items',
  ])
  return {
    schemaVersion: 3,
    mode: enumValue(object.mode, ['review', 'walkthrough'], 'final analysis.mode'),
    overview: string(object.overview, 'final analysis.overview'),
    blindSummary: string(
      object.blindSummary,
      'final analysis.blindSummary',
    ),
    planReview: {
      status: enumValue(
        planReview.status,
        ['completed', 'skipped-no-plan'],
        'final analysis.planReview.status',
      ),
      planPath: nullableString(
        planReview.planPath,
        'final analysis.planReview.planPath',
      ),
      summary: string(
        planReview.summary,
        'final analysis.planReview.summary',
        { allowEmpty: true },
      ),
    },
    groups: array(object.groups, 'final analysis.groups').map((group, index) =>
      parseAnalysisGroup(group, `final analysis.groups[${index}]`, true),
    ),
    planCoverage: {
      status: enumValue(
        coverage.status,
        ['completed', 'skipped-no-plan'],
        'final analysis.planCoverage.status',
      ),
      items: array(coverage.items, 'final analysis.planCoverage.items').map(
        (item, index) => parsePlanCoverageItem(item, `planCoverage.items[${index}]`),
      ),
    },
    verificationItems: array(
      object.verificationItems,
      'final analysis.verificationItems',
    ).map((item, index) => parseVerificationItem(item, `verificationItems[${index}]`)),
  }
}

function assertUnique(values, label) {
  const seen = new Set()
  for (const value of values) {
    if (seen.has(value)) throw new Error(`${label}が重複しています: ${value}`)
    seen.add(value)
  }
}

function assertHunkCoverage(groups, hunkMap, label) {
  const assigned = groups.flatMap((group) => group.hunkIds)
  assertUnique(assigned, `${label} hunk ID`)
  const unknown = assigned.filter((id) => !hunkMap.has(id))
  if (unknown.length > 0) {
    throw new Error(`${label}が未知hunkを参照しています: ${unknown.join(', ')}`)
  }
  const missing = [...hunkMap.keys()].filter((id) => !assigned.includes(id))
  if (missing.length > 0) {
    throw new Error(`${label}に未割当hunkがあります: ${missing.join(', ')}`)
  }
}

function assertBlindBatches(blindInput, hunkMap) {
  const assigned = blindInput.blindBatches.flatMap((batch) => batch.hunkIds)
  assertUnique(assigned, 'Blind batch hunk ID')
  const expected = [...hunkMap.keys()]
  if (
    assigned.length !== expected.length ||
    expected.some((id, index) => assigned[index] !== id)
  ) throw new Error('Blind batchにhunkの欠落、未知参照、または順序不一致があります。')
  for (const batch of blindInput.blindBatches) {
    const hunks = batch.hunkIds.map((id) => hunkMap.get(id))
    const diffLines = hunks.reduce((total, hunk) => total + hunk.lines.length, 0)
    const rawBytes = hunks.reduce(
      (total, hunk) =>
        total + Buffer.byteLength([hunk.header, ...hunk.lines.map((line) => line.text)].join('\n')),
      0,
    )
    if (batch.diffLines !== diffLines || batch.rawBytes !== rawBytes) {
      throw new Error(`Blind batchの集計metadataがhunk内容と一致しません: ${batch.id}`)
    }
    const over =
      diffLines > BLIND_BATCH_LIMITS.lines || rawBytes > BLIND_BATCH_LIMITS.bytes
    if (
      (over && (!batch.oversizedSingleHunk || batch.hunkIds.length !== 1)) ||
      (!over && batch.oversizedSingleHunk)
    ) throw new Error(`Blind batchの上限metadataが不正です: ${batch.id}`)
  }
}

function findingWithoutAssessment(finding) {
  return Object.fromEntries(
    Object.entries(finding).filter(([key]) => key !== 'planAssessment'),
  )
}

function groupWithoutStageTwoAdditions(group) {
  return {
    id: group.id,
    title: group.title,
    summary: group.summary,
    changeType: group.changeType,
    risk: group.risk,
    intent: group.intent,
    implementationSummary: group.implementationSummary,
    impact: group.impact,
    verificationPoints: group.verificationPoints,
    hunkIds: group.hunkIds,
    findings: group.findings
      .filter((finding) => finding.stage === 'blind')
      .map(findingWithoutAssessment),
    fileExplanations: group.fileExplanations.map((explanation) => {
      const rest = { ...explanation }
      delete rest.planItemIds
      return rest
    }),
  }
}

function assertStageOnePreserved(stageOne, finalAnalysis, mode) {
  if (stageOne.mode !== mode || finalAnalysis.mode !== mode) {
    throw new Error('収集modeとStage 1/final analysis modeが一致しません。')
  }
  if (stageOne.summary !== finalAnalysis.blindSummary) {
    throw new Error('Stage 1 summaryがfinal analysisで変更されています。')
  }
  if (
    stageOne.groups.length !== finalAnalysis.groups.length ||
    stageOne.groups.some((group, index) => group.id !== finalAnalysis.groups[index]?.id)
  ) {
    throw new Error('Stage 1 group集合または順序がfinal analysisで変更されています。')
  }
  for (const [index, group] of stageOne.groups.entries()) {
    if (
      !isDeepStrictEqual(
        groupWithoutStageTwoAdditions(group),
        groupWithoutStageTwoAdditions(finalAnalysis.groups[index]),
      )
    ) {
      throw new Error(`Stage 1 groupまたは解説が変更されています: ${group.id}`)
    }
  }
  const original = stageOne.groups.flatMap((group) => group.findings)
  const finalBlind = finalAnalysis.groups
    .flatMap((group) => group.findings)
    .filter((finding) => finding.id.startsWith('S1-') || finding.stage === 'blind')
  assertUnique(original.map((finding) => finding.id), 'Stage 1 finding ID')
  assertUnique(finalBlind.map((finding) => finding.id), 'final S1 finding ID')
  if (
    original.length !== finalBlind.length ||
    original.some(
      (finding) => !finalBlind.some((candidate) => candidate.id === finding.id),
    )
  ) {
    throw new Error('Stage 1 finding集合がfinal analysisで変更されています。')
  }
  for (const finding of original) {
    if (
      finding.stage !== 'blind' ||
      !finding.id.startsWith('S1-') ||
      !['diff', 'rule', 'repository'].includes(finding.locationKind)
    ) {
      throw new Error(`Stage 1 findingのstageまたはIDが不正です: ${finding.id}`)
    }
    if (finding.planAssessment.status !== 'not-reviewed') {
      throw new Error(
        `Stage 1 findingのplanAssessmentはnot-reviewedである必要があります: ${finding.id}`,
      )
    }
    const candidate = finalBlind.find((item) => item.id === finding.id)
    if (
      !candidate ||
      !isDeepStrictEqual(
        findingWithoutAssessment(finding),
        findingWithoutAssessment(candidate),
      )
    ) {
      throw new Error(
        `Stage 1 findingのplanAssessment以外が変更されています: ${finding.id}`,
      )
    }
  }
  for (const finding of finalAnalysis.groups.flatMap((group) => group.findings)) {
    if (
      (finding.id.startsWith('S1-') && finding.stage !== 'blind') ||
      (finding.id.startsWith('S2-') && finding.stage !== 'plan') ||
      (!finding.id.startsWith('S1-') && !finding.id.startsWith('S2-'))
    ) {
      throw new Error(`findingのIDとstageが一致しません: ${finding.id}`)
    }
    if (
      finding.id.startsWith('S2-') &&
      finding.planAssessment.status !== 'confirmed'
    ) {
      throw new Error(
        `S2 findingのplanAssessmentはconfirmedである必要があります: ${finding.id}`,
      )
    }
  }
}

function assertWalkthrough(groups, mode, fileMap, hunkMap) {
  for (const group of groups) {
    const groupFindingIds = new Set(group.findings.map((finding) => finding.id))
    if (mode === 'review') {
      if (group.fileExplanations.length !== 0) {
        throw new Error('review modeではfileExplanationsを生成できません。')
      }
      continue
    }
    const expectedFileIds = [...new Set(group.hunkIds.map((id) => hunkMap.get(id).fileId))]
    assertUnique(group.fileExplanations.map((item) => item.id), `${group.id} file explanation ID`)
    assertUnique(group.fileExplanations.map((item) => item.fileId), `${group.id} file explanation fileId`)
    if (
      expectedFileIds.length !== group.fileExplanations.length ||
      expectedFileIds.some((id) => !group.fileExplanations.some((item) => item.fileId === id))
    ) throw new Error(`${group.id}のfileExplanationsがgroupのfile集合と一致しません。`)

    for (const explanation of group.fileExplanations) {
      assertUnique(
        explanation.segments.map((segment) => segment.id),
        `${explanation.id} segment ID`,
      )
      const file = fileMap.get(explanation.fileId)
      if (!file || explanation.detailLevel !== file.explanationPolicy.detailLevel) {
        throw new Error(`${explanation.id}のdetailLevelがcollector分類と一致しません。`)
      }
      if (
        explanation.summaryOnlyKind !== file.explanationPolicy.summaryOnlyKind ||
        explanation.summaryOnlyReason !== file.explanationPolicy.rationale
      ) throw new Error(`${explanation.id}のsummary-only分類がcollector結果と一致しません。`)
      const fileHunks = group.hunkIds
        .map((id) => hunkMap.get(id))
        .filter((hunk) => hunk.fileId === explanation.fileId)
      if (explanation.detailLevel === 'summary-only') {
        if (explanation.segments.length !== 0) {
          throw new Error(`${explanation.id}のsummary-onlyにsegmentがあります。`)
        }
        continue
      }
      for (const hunk of fileHunks) {
        const segments = explanation.segments
          .filter((segment) => segment.hunkId === hunk.id)
          .sort((left, right) => left.startLineIndex - right.startLineIndex)
        let next = 0
        for (const segment of segments) {
          if (segment.findingIds.some((id) => !groupFindingIds.has(id))) {
            throw new Error(`segmentがgroup内の未知findingを参照しています: ${segment.id}`)
          }
          if (
            segment.startLineIndex !== next ||
            segment.endLineIndex < segment.startLineIndex ||
            segment.endLineIndex >= hunk.lines.length ||
            segment.endLineIndex - segment.startLineIndex + 1 > 120
          ) throw new Error(`${explanation.id}のsegment coverageが不正です: ${hunk.id}`)
          next = segment.endLineIndex + 1
        }
        if (next !== hunk.lines.length) {
          throw new Error(`${explanation.id}に未説明diff行があります: ${hunk.id}`)
        }
      }
      const unknownHunks = explanation.segments.filter(
        (segment) => !fileHunks.some((hunk) => hunk.id === segment.hunkId),
      )
      if (unknownHunks.length) {
        throw new Error(`${explanation.id}がgroup/file外のhunkを参照しています。`)
      }
    }
  }
}

function evidenceIntersectsGroup(evidence, group, hunkMap) {
  if (evidence.file === null) return true
  return group.hunkIds.map((id) => hunkMap.get(id)).some(
    (hunk) => hunk.file === evidence.file && hunk.lines.some((line) => {
      const lineNumber = evidence.lineSide === 'old' ? line.oldLine : line.newLine
      return lineNumber !== null && lineNumber >= evidence.startLine && lineNumber <= evidence.endLine
    }),
  )
}

function assertPlanData(planInput, analysis, hunkMap) {
  const groups = new Map(analysis.groups.map((group) => [group.id, group]))
  const findings = new Map(
    analysis.groups.flatMap((group) => group.findings.map((finding) => [finding.id, finding])),
  )
  const items = new Map(analysis.planCoverage.items.map((item) => [item.id, item]))
  assertUnique([...items.keys()], 'Plan coverage item ID')
  assertUnique(analysis.verificationItems.map((item) => item.id), 'verification item ID')
  assertUnique(
    [...items.keys(), ...analysis.verificationItems.map((item) => item.id)],
    'Plan/verification item ID',
  )

  if (['absent', 'disabled'].includes(planInput.resolution)) {
    if (
      analysis.planCoverage.status !== 'skipped-no-plan' ||
      analysis.planCoverage.items.length ||
      analysis.verificationItems.length ||
      analysis.groups.some((group) => group.planItemIds.length || group.fileExplanations.some((file) => file.planItemIds.length))
    ) throw new Error('planなしではcoverage、verification、plan linkを追加できません。')
    if (
      analysis.groups.some((group) =>
        group.findings.some(
          (finding) =>
            finding.stage === 'blind' &&
            finding.planAssessment.status !== 'not-reviewed',
        ),
      )
    ) throw new Error('planなしではS1 findingのPlan評価を変更できません。')
    return
  }
  if (analysis.planCoverage.status !== 'completed') {
    throw new Error('planありではplanCoverage.status=completedが必要です。')
  }
  const planLineCount = planInput.content.split(/\r?\n/u).length
  for (const item of items.values()) {
    if (item.endLine < item.startLine || item.endLine > planLineCount) {
      throw new Error(`Plan行範囲が不正です: ${item.id}`)
    }
    if (item.status === 'satisfied' && item.evidence.length === 0) {
      throw new Error(`satisfied Plan項目にはevidenceが必要です: ${item.id}`)
    }
    if (['partial', 'missing'].includes(item.status)) {
      if (
        item.findingIds.length === 0 ||
        item.findingIds.some((id) => findings.get(id)?.stage !== 'plan')
      ) throw new Error(`partial/missing Plan項目にはS2 findingが必要です: ${item.id}`)
    }
    for (const evidence of item.evidence) {
      const group = groups.get(evidence.groupId)
      if (
        !group ||
        !group.planItemIds.includes(item.id) ||
        !evidenceIntersectsGroup(evidence, group, hunkMap)
      ) {
        throw new Error(`Plan evidenceがgroup diffと一致しません: ${item.id}`)
      }
      if (evidence.file !== null && group.fileExplanations.length > 0) {
        const fileId = group.hunkIds
          .map((id) => hunkMap.get(id))
          .find((hunk) => hunk.file === evidence.file)?.fileId
        const explanation = group.fileExplanations.find(
          (candidate) => candidate.fileId === fileId,
        )
        if (!explanation?.planItemIds.includes(item.id)) {
          throw new Error(`Plan evidenceがfile explanationと双方向linkされていません: ${item.id}`)
        }
      }
    }
    if (item.findingIds.some((id) => !findings.has(id))) {
      throw new Error(`Plan項目が未知findingを参照しています: ${item.id}`)
    }
  }
  for (const item of analysis.verificationItems) {
    if (item.endLine < item.startLine || item.endLine > planLineCount) {
      throw new Error(`verification行範囲が不正です: ${item.id}`)
    }
  }
  const findingOwners = new Map(
    analysis.groups.flatMap((group) =>
      group.findings.map((finding) => [finding.id, group.id]),
    ),
  )
  for (const group of groups.values()) {
    for (const id of [
      ...group.planItemIds,
      ...group.fileExplanations.flatMap((file) => file.planItemIds),
    ]) if (!items.has(id)) throw new Error(`未知Plan項目参照です: ${id}`)
    const relatedItemIds = analysis.planCoverage.items
      .filter(
        (item) =>
          item.evidence.some((evidence) => evidence.groupId === group.id) ||
          item.findingIds.some((id) => findingOwners.get(id) === group.id),
      )
      .map((item) => item.id)
    if (
      relatedItemIds.some((id) => !group.planItemIds.includes(id)) ||
      group.planItemIds.some((id) => !relatedItemIds.includes(id))
    ) throw new Error(`groupとPlan項目の双方向linkが一致しません: ${group.id}`)
  }
}

function assertPlanReview(planInput, analysis) {
  const hasStageTwoFinding = analysis.groups.some((group) =>
    group.findings.some(
      (finding) => finding.id.startsWith('S2-') || finding.stage === 'plan',
    ),
  )
  if (['absent', 'disabled'].includes(planInput.resolution)) {
    if (
      analysis.planReview.status !== 'skipped-no-plan' ||
      analysis.planReview.planPath !== null
    ) {
      throw new Error('planなしの場合はskipped-no-planとnull pathが必要です。')
    }
    if (hasStageTwoFinding) {
      throw new Error('planなしの場合はS2 findingを追加できません。')
    }
  } else if (
    analysis.planReview.status !== 'completed' ||
    analysis.planReview.planPath !== planInput.path
  ) {
    throw new Error('plan reviewのstatusまたはpathが収集結果と一致しません。')
  }
}

function assertFindingLocations(groups, hunkMap, rules, planInput) {
  assertUnique(rules.map((rule) => rule.path), 'Blind rule path')
  const ruleMap = new Map(rules.map((rule) => [rule.path, rule]))
  const planLineCount =
    typeof planInput.content === 'string' ? planInput.content.split(/\r?\n/u).length : 0
  for (const group of groups) {
    const hunks = group.hunkIds.map((id) => hunkMap.get(id))
    for (const finding of group.findings) {
      if (finding.endLine < finding.startLine) {
        throw new Error(`findingの行範囲が逆転しています: ${finding.id}`)
      }
      if (finding.locationKind !== 'diff') {
        if (finding.lineSide !== null) {
          throw new Error(`diff外findingのlineSideはnullです: ${finding.id}`)
        }
        if (finding.locationKind === 'rule') {
          const rule = ruleMap.get(finding.file)
          const lineCount = rule?.content.split(/\r?\n/u).length ?? 0
          if (!rule || finding.endLine > lineCount) {
            throw new Error(`rule findingが収集済みrule位置と一致しません: ${finding.id}`)
          }
        }
        if (
          finding.locationKind === 'plan' &&
          (planInput.path === null ||
            finding.file !== planInput.path ||
            finding.endLine > planLineCount)
        ) {
          throw new Error(`Plan findingがselected Plan位置と一致しません: ${finding.id}`)
        }
        continue
      }
      if (finding.lineSide === null) {
        throw new Error(`diff findingにはlineSideが必要です: ${finding.id}`)
      }
      const intersects = hunks.some(
        (hunk) =>
          hunk.file === finding.file &&
          hunk.lines.some((line) => {
            const number =
              finding.lineSide === 'old' ? line.oldLine : line.newLine
            return (
              number !== null &&
              number >= finding.startLine &&
              number <= finding.endLine
            )
          }),
      )
      if (!intersects) {
        throw new Error(`findingがgroup内のdiff行と交差しません: ${finding.id}`)
      }
    }
  }
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    )
  }
  return value
}

function fingerprint(value) {
  return sha256(JSON.stringify(canonical(value)))
}

function publicFile(file) {
  return {
    id: file.id,
    path: file.path,
    oldPath: file.oldPath,
    newPath: file.newPath,
    status: file.status,
    additions: file.additions,
    deletions: file.deletions,
    binary: file.binary,
    size: file.size,
    changeSources: file.changeSources,
  }
}

function rawHunk(hunk) {
  return {
    ...hunk,
    lines: hunk.lines.map((value) => {
      const line = { ...value }
      delete line.tokenRuns
      return line
    }),
  }
}

function groupFingerprintPayload(group, files, hunks, findings) {
  return {
    id: group.id,
    title: group.title,
    summary: group.summary,
    changeType: group.changeType,
    risk: group.risk,
    intent: group.intent,
    implementationSummary: group.implementationSummary,
    impact: group.impact,
    verificationPoints: group.verificationPoints,
    files,
    hunks: hunks.map(rawHunk),
    findingFingerprints: findings.map((finding) => finding.fingerprint),
  }
}

export function enforceReportSize(
  report,
  maximumBytes = HIGHLIGHT_LIMITS.reportBytes,
  measureBytes = (value) => Buffer.byteLength(JSON.stringify(value, null, 2)),
) {
  let reportBytes = measureBytes(report)
  if (reportBytes <= maximumBytes) return

  const existingFallbackIds = new Set(
    report.highlighting.fallbacks.map((item) => item.hunkId),
  )
  const embeddedPrettyBytes = (value, baseIndent) => {
    const serialized = JSON.stringify(value, null, 2)
    const newlineCount = serialized.match(/\n/gu)?.length ?? 0
    return Buffer.byteLength(serialized) + newlineCount * baseIndent
  }
  const tokenReductionBytes = (hunk) =>
    hunk.lines.reduce((total, line) => {
      if (!line.tokenRuns.length) return total
      return (
        total +
        embeddedPrettyBytes({ tokenRuns: line.tokenRuns }, 12) -
        embeddedPrettyBytes({ tokenRuns: [] }, 12)
      )
    }, 0)
  const fallbackGrowthBytes = (entry, fallbackCount) => {
    if (fallbackCount === 0) {
      return embeddedPrettyBytes([entry], 4) - Buffer.byteLength('[]')
    }
    const sentinel = { hunkId: 'sentinel', reason: 'report-size' }
    return (
      embeddedPrettyBytes([sentinel, entry], 4) -
      embeddedPrettyBytes([sentinel], 4)
    )
  }
  const candidates = report.groups
    .flatMap((group) => group.hunks)
    .filter((hunk) => hunk.lines.some((line) => line.tokenRuns.length))
    .map((hunk) => ({
      hunk,
      tokenReductionBytes: tokenReductionBytes(hunk),
    }))
    .sort((left, right) => right.tokenReductionBytes - left.tokenReductionBytes)

  let candidateIndex = 0
  while (reportBytes > maximumBytes && candidateIndex < candidates.length) {
    const requiredReduction = reportBytes - maximumBytes
    let predictedReduction = 0
    while (
      predictedReduction < requiredReduction &&
      candidateIndex < candidates.length
    ) {
      const candidate = candidates[candidateIndex]
      candidateIndex += 1
      const fallback = {
        hunkId: candidate.hunk.id,
        reason: 'report-size',
      }
      const addsFallback = !existingFallbackIds.has(candidate.hunk.id)
      const fallbackBytes = addsFallback
        ? fallbackGrowthBytes(
            fallback,
            report.highlighting.fallbacks.length,
          )
        : 0
      const netReduction = candidate.tokenReductionBytes - fallbackBytes
      if (netReduction <= 0) continue

      predictedReduction += netReduction
      for (const line of candidate.hunk.lines) line.tokenRuns = []
      if (addsFallback) {
        report.highlighting.fallbacks.push(fallback)
        existingFallbackIds.add(candidate.hunk.id)
      }
    }
    if (predictedReduction === 0) break
    reportBytes = measureBytes(report)
  }

  if (reportBytes > maximumBytes) {
    throw new Error(`report.jsonが上限${maximumBytes} bytesを超えています。`)
  }
}

function safeEmbeddedJson(value) {
  return JSON.stringify(value).replace(
    /[<>&\u2028\u2029]/gu,
    (character) =>
      `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`,
  )
}

function applyTemplate(template, replacements) {
  const tokens = template.match(/\{\{[A-Z_]+\}\}/gu) ?? []
  const expected = Object.keys(replacements).map((key) => `{{${key}}}`)
  if (
    tokens.length !== expected.length ||
    expected.some(
      (token) => tokens.filter((candidate) => candidate === token).length !== 1,
    ) ||
    tokens.some((token) => !expected.includes(token))
  ) {
    throw new Error('HTML templateのplaceholder契約が不正です。')
  }
  return template.replace(/\{\{([A-Z_]+)\}\}/gu, (_token, key) => replacements[key])
}

function assertSchemaCurrent(skillDirectory) {
  const schemaText = readFileSync(
    join(skillDirectory, 'references', 'report-schema.json'),
    'utf8',
  )
  const actual = sha256(schemaText)
  if (actual !== generatedSchemaSha256) {
    throw new Error(
      'report-schema.jsonと生成済validatorが一致しません。pnpm build:validatorを実行してください。',
    )
  }
}

function ensurePlainDirectory(path, label) {
  if (!existsSync(path)) return
  const stat = lstatSync(path)
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error(`${label}はsymlinkではないdirectoryである必要があります: ${path}`)
  }
}

function exactReviewDirectory(path, reviewId) {
  if (!existsSync(path)) return false
  const stat = lstatSync(path)
  if (stat.isSymbolicLink() || !stat.isDirectory()) return false
  const names = readdirSync(path).sort()
  if (names.join(',') !== 'index.html,report.json') return false
  try {
    return readJson(join(path, 'report.json')).review?.id === reviewId
  } catch {
    return false
  }
}

function containedChild(root, child) {
  return dirname(resolve(child)) === realpathSync(root)
}

function readLockOwner(lock) {
  const ownerPath = join(lock, 'owner.json')
  if (!existsSync(ownerPath)) return null
  const stat = lstatSync(ownerPath)
  if (stat.isSymbolicLink() || !stat.isFile()) return null
  try {
    const owner = JSON.parse(readFileSync(ownerPath, 'utf8'))
    if (
      owner === null ||
      typeof owner !== 'object' ||
      Array.isArray(owner) ||
      Object.keys(owner).sort().join(',') !== 'createdAt,pid' ||
      !Number.isInteger(owner.pid) ||
      owner.pid < 1 ||
      typeof owner.createdAt !== 'string' ||
      !Number.isFinite(Date.parse(owner.createdAt))
    ) {
      return null
    }
    return owner
  } catch {
    return null
  }
}

function processExists(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error?.code !== 'ESRCH'
  }
}

function acquireReviewLock(reviewRoot, reviewId) {
  const lock = join(reviewRoot, `.lock-${reviewId}`)
  let reclaimed = false
  while (true) {
    try {
      mkdirSync(lock)
      try {
        writeFileSync(
          join(lock, 'owner.json'),
          `${JSON.stringify({
            pid: process.pid,
            createdAt: new Date().toISOString(),
          })}\n`,
          { flag: 'wx', mode: 0o600 },
        )
      } catch (error) {
        rmSync(lock, { recursive: true, force: true })
        throw error
      }
      return lock
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error
    }

    ensurePlainDirectory(lock, 'review生成lock')
    const owner = readLockOwner(lock)
    if (!owner) {
      throw new Error(`review生成lockのowner情報が不正です: ${reviewId}`)
    }
    if (processExists(owner.pid)) {
      throw new Error(`同じreview IDの生成が進行中です: ${reviewId}`)
    }
    if (reclaimed) {
      throw new Error(`review生成lockの回収中に競合しました: ${reviewId}`)
    }
    rmSync(lock, { recursive: true })
    reclaimed = true
  }
}

function interruptedPrefix(kind, reviewId) {
  return `.${kind}-${reviewId.length}-${reviewId}-`
}

function recoverInterrupted(reviewRoot, target, reviewId) {
  const entries = readdirSync(reviewRoot)
  const backupPrefix = interruptedPrefix('backup', reviewId)
  const temporaryPrefix = interruptedPrefix('tmp', reviewId)
  const backups = entries
    .filter((name) => name.startsWith(backupPrefix))
    .map((name) => join(reviewRoot, name))
  const temporaries = entries
    .filter((name) => name.startsWith(temporaryPrefix))
    .map((name) => join(reviewRoot, name))
  if (backups.length > 1 || temporaries.length > 1) {
    throw new Error('中断済みreview生成物が複数あり、自動回復できません。')
  }
  for (const path of [...backups, ...temporaries]) {
    if (!containedChild(reviewRoot, path)) {
      throw new Error(`回復対象が.review外です: ${path}`)
    }
  }
  const backup = backups[0]
  const temporary = temporaries[0]
  if (existsSync(target)) {
    if (!exactReviewDirectory(target, reviewId)) {
      throw new Error(`既存review directoryの内容が不正です: ${target}`)
    }
    if (backup) {
      if (!exactReviewDirectory(backup, reviewId)) {
        throw new Error(`backup review directoryの内容が不正です: ${backup}`)
      }
      rmSync(backup, { recursive: true })
    }
    if (temporary) {
      if (!exactReviewDirectory(temporary, reviewId)) {
        throw new Error(`temporary review directoryの内容が不正です: ${temporary}`)
      }
      rmSync(temporary, { recursive: true })
    }
    return
  }
  if (backup && exactReviewDirectory(backup, reviewId)) {
    if (temporary && !exactReviewDirectory(temporary, reviewId)) {
      throw new Error(`temporary review directoryの内容が不正です: ${temporary}`)
    }
    renameSync(backup, target)
    if (temporary) rmSync(temporary, { recursive: true, force: true })
    return
  }
  if (temporary && exactReviewDirectory(temporary, reviewId)) {
    renameSync(temporary, target)
    return
  }
  if (temporary || backup) {
    throw new Error('中断済みreview生成物の内容が不正です。')
  }
}

function writeAtomically(repository, reviewId, report, html, failAt) {
  const reviewRoot = join(repository, '.review')
  ensurePlainDirectory(reviewRoot, '.review')
  mkdirSync(reviewRoot, { recursive: true })
  ensurePlainDirectory(reviewRoot, '.review')
  const realReviewRoot = realpathSync(reviewRoot)
  if (dirname(realReviewRoot) !== realpathSync(repository)) {
    throw new Error('.reviewはrepository直下にある必要があります。')
  }

  const target = join(realReviewRoot, reviewId)
  if (!containedChild(realReviewRoot, target)) {
    throw new Error('review出力先が.review外です。')
  }
  if (existsSync(target) && lstatSync(target).isSymbolicLink()) {
    throw new Error('review出力先にsymlinkは使用できません。')
  }

  const lock = acquireReviewLock(realReviewRoot, reviewId)

  let temporary = null
  let backup = null
  let promoted = false
  try {
    recoverInterrupted(realReviewRoot, target, reviewId)
    const nonce = randomUUID().slice(0, 12)
    temporary = join(
      realReviewRoot,
      `${interruptedPrefix('tmp', reviewId)}${nonce}`,
    )
    backup = join(
      realReviewRoot,
      `${interruptedPrefix('backup', reviewId)}${nonce}`,
    )
    mkdirSync(temporary)
    writeFileSync(join(temporary, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
    writeFileSync(join(temporary, 'index.html'), html)
    if (!exactReviewDirectory(temporary, reviewId)) {
      throw new Error('temporary reviewの検証に失敗しました。')
    }
    if (
      realpathSync(reviewRoot) !== realReviewRoot ||
      dirname(resolve(target)) !== realReviewRoot ||
      (existsSync(target) && lstatSync(target).isSymbolicLink())
    ) {
      throw new Error('置換直前にreview出力先の安全性が変化しました。')
    }
    failAt?.('before-backup')
    if (existsSync(target)) renameSync(target, backup)
    failAt?.('after-backup')
    renameSync(temporary, target)
    temporary = null
    promoted = true
    failAt?.('after-promote')
    failAt?.('before-cleanup')
    if (existsSync(backup)) rmSync(backup, { recursive: true })
    backup = null
  } catch (error) {
    if (promoted && existsSync(target)) {
      rmSync(target, { recursive: true, force: true })
    }
    if (backup && existsSync(backup)) {
      renameSync(backup, target)
      backup = null
    }
    if (temporary && existsSync(temporary)) {
      rmSync(temporary, { recursive: true, force: true })
    }
    throw error
  } finally {
    rmSync(lock, { recursive: true, force: true })
  }
  return target
}

export function generateReport(options) {
  const blindInput = parseBlindInput(readJson(options.blindInputPath))
  const planInput = parsePlanInput(readJson(options.planInputPath))
  const stageOne = parseStageOne(readJson(options.stageOnePath))
  const analysis = parseFinalAnalysis(readJson(options.analysisPath))
  const allHunks = blindInput.files.flatMap((file) => file.hunks)
  const hunkMap = new Map(allHunks.map((hunk) => [hunk.id, hunk]))
  const fileMap = new Map(blindInput.files.map((file) => [file.id, file]))

  assertBlindBatches(blindInput, hunkMap)
  assertHunkCoverage(stageOne.groups, hunkMap, 'Stage 1')
  assertHunkCoverage(analysis.groups, hunkMap, 'final analysis')
  assertWalkthrough(stageOne.groups, blindInput.mode, fileMap, hunkMap)
  assertStageOnePreserved(stageOne, analysis, blindInput.mode)
  assertPlanReview(planInput, analysis)
  assertFindingLocations(analysis.groups, hunkMap, blindInput.rules, planInput)
  assertWalkthrough(analysis.groups, blindInput.mode, fileMap, hunkMap)
  assertPlanData(planInput, analysis, hunkMap)
  assertUnique(analysis.groups.map((group) => group.id), 'group ID')
  assertUnique(
    analysis.groups.flatMap((group) => group.findings.map((finding) => finding.id)),
    'finding ID',
  )

  const highlighted = highlightHunks(allHunks, {
    now: options.now,
    milliseconds: options.highlightMilliseconds,
  })
  validateTokenRuns(highlighted.hunks, highlighted.highlighting.styles)
  const highlightedHunkMap = new Map(
    highlighted.hunks.map((hunk) => [hunk.id, hunk]),
  )

  const groups = analysis.groups
    .map((group, index) => ({ group, index }))
    .sort(
      (left, right) =>
        RISK_WEIGHT[left.group.risk] - RISK_WEIGHT[right.group.risk] ||
        left.index - right.index,
    )
    .map(({ group }) => {
      const hunks = group.hunkIds.map((id) => highlightedHunkMap.get(id))
      const fileIds = [...new Set(hunks.map((hunk) => hunk.fileId))]
      const findings = group.findings.map((finding) => ({
        ...finding,
        fingerprint: fingerprint(finding),
      }))
      const files = fileIds.map((id) => publicFile(fileMap.get(id)))
      const publicGroup = {
        id: group.id,
        title: group.title,
        summary: group.summary,
        changeType: group.changeType,
        risk: group.risk,
        intent: group.intent,
        implementationSummary: group.implementationSummary,
        impact: group.impact,
        verificationPoints: group.verificationPoints,
        planItemIds: group.planItemIds,
        files,
        hunks,
        findings,
        fileExplanations: group.fileExplanations,
      }
      return {
        ...publicGroup,
        fingerprint: fingerprint(
          groupFingerprintPayload(group, files, hunks, findings),
        ),
      }
    })

  const report = {
    schemaVersion: 3,
    mode: blindInput.mode,
    review: {
      id: blindInput.reviewId,
      repositoryHash: blindInput.repositoryHash,
      scope: blindInput.snapshot.scope,
      collectedAt: blindInput.snapshot.collectedAt,
      workspaceFingerprint: blindInput.snapshot.workspaceFingerprint,
    },
    git: {
      baseRef: blindInput.git.baseRef,
      baseOid: blindInput.git.baseOid,
      headOid: blindInput.git.headOid,
      mergeBase: blindInput.git.mergeBase,
      branch: blindInput.git.branch,
      ahead: blindInput.git.ahead,
      behind: blindInput.git.behind,
    },
    stats: blindInput.stats,
    overview: analysis.overview,
    stages: {
      blind: { status: 'completed', summary: stageOne.summary },
      plan: analysis.planReview,
    },
    planCoverage: analysis.planCoverage,
    verificationItems: analysis.verificationItems,
    highlighting: highlighted.highlighting,
    riskCounts: Object.fromEntries(
      RISKS.map((risk) => [
        risk,
        groups.filter((group) => group.risk === risk).length,
      ]),
    ),
    commits: blindInput.git.commits,
    groups,
  }
  enforceReportSize(report, options.reportBytesLimit)
  validateTokenRuns(
    report.groups.flatMap((group) => group.hunks),
    report.highlighting.styles,
  )

  const scriptDirectory = dirname(fileURLToPath(import.meta.url))
  const skillDirectory = resolve(scriptDirectory, '..')
  assertSchemaCurrent(skillDirectory)
  if (!validateReport(report)) {
    throw new Error(
      `report.jsonがSchemaに違反しています: ${JSON.stringify(
        validateReport.errors,
      )}`,
    )
  }

  const assets = join(skillDirectory, 'assets')
  const html = applyTemplate(
    readFileSync(join(assets, 'review-template.html'), 'utf8'),
    {
      STYLE: readFileSync(join(assets, 'review.css'), 'utf8'),
      REPORT_JSON: safeEmbeddedJson(report),
      SCRIPT: readFileSync(join(assets, 'review.js'), 'utf8'),
    },
  )
  const outputDirectory = writeAtomically(
    blindInput.repositoryRoot,
    blindInput.reviewId,
    report,
    html,
    options.failAt,
  )
  return {
    reviewId: blindInput.reviewId,
    outputDirectory,
    indexPath: join(outputDirectory, 'index.html'),
    reportPath: join(outputDirectory, 'report.json'),
    groupCount: groups.length,
    findingCount: groups.reduce(
      (count, group) => count + group.findings.length,
      0,
    ),
    approvedStateInvalidatesOn: blindInput.snapshot.workspaceFingerprint,
    planStatus: analysis.planReview.status,
  }
}

function parseArguments(argv) {
  const values = {}
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    const value = argv[index + 1]
    if (!value) throw new Error(`値が必要です: ${argument}`)
    if (argument === '--blind-input') values.blindInputPath = value
    else if (argument === '--plan-input') values.planInputPath = value
    else if (argument === '--stage1') values.stageOnePath = value
    else if (argument === '--analysis') values.analysisPath = value
    else throw new Error(`不明な引数です: ${argument}`)
    index += 1
  }
  for (const key of [
    'blindInputPath',
    'planInputPath',
    'stageOnePath',
    'analysisPath',
  ]) {
    if (!values[key]) throw new Error(`必須引数がありません: ${key}`)
  }
  return values
}

function isMainModule() {
  const entry = process.argv[1]
  return (
    Boolean(entry) &&
    realpathSync(resolve(entry)) === realpathSync(fileURLToPath(import.meta.url))
  )
}

if (isMainModule()) {
  try {
    const result = generateReport(parseArguments(process.argv.slice(2)))
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`report生成に失敗しました: ${message}\n`)
    process.exitCode = 1
  }
}
