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
const RISK_WEIGHT = Object.freeze({
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
})
const REVIEW_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/u

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
  ])
  if (typeof object.binary !== 'boolean') {
    throw new Error(`${label}.binaryはbooleanである必要があります。`)
  }
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
    'reviewId',
    'repositoryRoot',
    'repositoryHash',
    'snapshot',
    'git',
    'stats',
    'files',
    'rules',
  ])
  if (object.schemaVersion !== 2) throw new Error('blind input versionが不正です。')
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
    schemaVersion: 2,
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
  if (object.schemaVersion !== 2) throw new Error('plan input versionが不正です。')
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
  return { schemaVersion: 2, resolution, path, content }
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

function parseAnalysisGroup(value, label) {
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
  }
}

export function parseStageOne(value) {
  const object = exactObject(value, 'Stage 1 analysis', [
    'schemaVersion',
    'summary',
    'groups',
  ])
  if (object.schemaVersion !== 2) throw new Error('Stage 1 versionが不正です。')
  return {
    schemaVersion: 2,
    summary: string(object.summary, 'Stage 1 analysis.summary'),
    groups: array(object.groups, 'Stage 1 analysis.groups').map((group, index) =>
      parseAnalysisGroup(group, `Stage 1 analysis.groups[${index}]`),
    ),
  }
}

export function parseFinalAnalysis(value) {
  const object = exactObject(value, 'final analysis', [
    'schemaVersion',
    'overview',
    'blindSummary',
    'planReview',
    'groups',
  ])
  if (object.schemaVersion !== 2) throw new Error('final analysis versionが不正です。')
  const planReview = exactObject(object.planReview, 'final analysis.planReview', [
    'status',
    'planPath',
    'summary',
  ])
  return {
    schemaVersion: 2,
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
      parseAnalysisGroup(group, `final analysis.groups[${index}]`),
    ),
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

function findingWithoutAssessment(finding) {
  return Object.fromEntries(
    Object.entries(finding).filter(([key]) => key !== 'planAssessment'),
  )
}

function assertStageOnePreserved(stageOne, finalAnalysis) {
  if (stageOne.summary !== finalAnalysis.blindSummary) {
    throw new Error('Stage 1 summaryがfinal analysisで変更されています。')
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
    if (finding.stage !== 'blind' || !finding.id.startsWith('S1-')) {
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

function assertFindingLocations(groups, hunkMap) {
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

  assertHunkCoverage(stageOne.groups, hunkMap, 'Stage 1')
  assertHunkCoverage(analysis.groups, hunkMap, 'final analysis')
  assertStageOnePreserved(stageOne, analysis)
  assertPlanReview(planInput, analysis)
  assertFindingLocations(analysis.groups, hunkMap)
  assertUnique(analysis.groups.map((group) => group.id), 'group ID')
  assertUnique(
    analysis.groups.flatMap((group) => group.findings.map((finding) => finding.id)),
    'finding ID',
  )

  const groups = analysis.groups
    .map((group, index) => ({ group, index }))
    .sort(
      (left, right) =>
        RISK_WEIGHT[left.group.risk] - RISK_WEIGHT[right.group.risk] ||
        left.index - right.index,
    )
    .map(({ group }) => {
      const hunks = group.hunkIds.map((id) => hunkMap.get(id))
      const fileIds = [...new Set(hunks.map((hunk) => hunk.fileId))]
      const findings = group.findings.map((finding) => ({
        ...finding,
        fingerprint: fingerprint(finding),
      }))
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
        files: fileIds.map((id) => publicFile(fileMap.get(id))),
        hunks,
        findings,
      }
      return {
        ...publicGroup,
        fingerprint: fingerprint(publicGroup),
      }
    })

  const report = {
    schemaVersion: 2,
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
    riskCounts: Object.fromEntries(
      RISKS.map((risk) => [
        risk,
        groups.filter((group) => group.risk === risk).length,
      ]),
    ),
    commits: blindInput.git.commits,
    groups,
  }

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
