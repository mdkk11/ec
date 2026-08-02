import { readFileSync, realpathSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import validateBatch from './batch-output-validator.mjs'

function object(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label}はobjectである必要があります。`)
  }
  return value
}

function array(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`${label}はarrayである必要があります。`)
  }
  return value
}

function unique(values, label) {
  const seen = new Set()
  for (const value of values) {
    if (seen.has(value)) throw new Error(`${label}が重複しています: ${value}`)
    seen.add(value)
  }
}

function sameSet(actual, expected) {
  const expectedSet = new Set(expected)
  return (
    actual.length === expected.length &&
    actual.every((value) => expectedSet.has(value))
  )
}

function semanticInput(blindInput, batchId) {
  const input = object(blindInput, 'blind input')
  if (input.schemaVersion !== 3) {
    throw new Error('blind input versionが不正です。')
  }
  if (!['review', 'walkthrough'].includes(input.mode)) {
    throw new Error(`blind input modeが不正です: ${String(input.mode)}`)
  }
  const batches = array(input.blindBatches, 'blind input.blindBatches')
  const matching = batches.filter((batch) => batch?.id === batchId)
  if (matching.length !== 1) {
    throw new Error(`指定されたBlind batchを一意に解決できません: ${batchId}`)
  }
  const batch = object(matching[0], `blind batch ${batchId}`)
  const hunkIds = array(batch.hunkIds, `blind batch ${batchId}.hunkIds`)
  unique(hunkIds, `blind batch ${batchId} hunk ID`)

  const files = array(input.files, 'blind input.files')
  const fileMap = new Map()
  const hunkMap = new Map()
  for (const [fileIndex, value] of files.entries()) {
    const file = object(value, `blind input.files[${fileIndex}]`)
    if (typeof file.id !== 'string' || file.id.length === 0) {
      throw new Error(`blind input.files[${fileIndex}].idが不正です。`)
    }
    if (fileMap.has(file.id)) {
      throw new Error(`blind input file IDが重複しています: ${file.id}`)
    }
    const policy = object(
      file.explanationPolicy,
      `blind input.files[${fileIndex}].explanationPolicy`,
    )
    if (!['segmented', 'summary-only'].includes(policy.detailLevel)) {
      throw new Error(`collector explanationPolicyが不正です: ${file.id}`)
    }
    fileMap.set(file.id, file)
    for (const [hunkIndex, value] of array(
      file.hunks,
      `blind input.files[${fileIndex}].hunks`,
    ).entries()) {
      const hunk = object(
        value,
        `blind input.files[${fileIndex}].hunks[${hunkIndex}]`,
      )
      if (typeof hunk.id !== 'string' || hunk.id.length === 0) {
        throw new Error(`blind input hunk IDが不正です: ${file.id}`)
      }
      if (hunk.fileId !== file.id) {
        throw new Error(`blind input hunkのfileIdが親fileと一致しません: ${hunk.id}`)
      }
      if (hunkMap.has(hunk.id)) {
        throw new Error(`blind input hunk IDが重複しています: ${hunk.id}`)
      }
      array(hunk.lines, `blind input hunk ${hunk.id}.lines`)
      hunkMap.set(hunk.id, hunk)
    }
  }
  for (const hunkId of hunkIds) {
    if (!hunkMap.has(hunkId)) {
      throw new Error(`Blind batchが未知hunkを参照しています: ${hunkId}`)
    }
  }
  const ruleMap = new Map()
  for (const [ruleIndex, value] of array(
    input.rules,
    'blind input.rules',
  ).entries()) {
    const rule = object(value, `blind input.rules[${ruleIndex}]`)
    if (typeof rule.path !== 'string' || rule.path.length === 0) {
      throw new Error(`blind input.rules[${ruleIndex}].pathが不正です。`)
    }
    if (typeof rule.content !== 'string') {
      throw new Error(`blind input.rules[${ruleIndex}].contentが不正です。`)
    }
    const matches = ruleMap.get(rule.path) ?? []
    matches.push(rule)
    ruleMap.set(rule.path, matches)
  }
  return { input, batch, fileMap, hunkMap, ruleMap }
}

function assertWalkthroughNotes(analysis, hunk, file, mode) {
  const notes = analysis.walkthroughNotes
  if (mode === 'review') {
    if (notes !== null) {
      throw new Error(`review modeではwalkthroughNotesはnullです: ${hunk.id}`)
    }
    return
  }
  if (notes === null) {
    throw new Error(`walkthrough modeではwalkthroughNotesが必要です: ${hunk.id}`)
  }
  const policy = file.explanationPolicy
  if (notes.fileId !== hunk.fileId) {
    throw new Error(`walkthroughNotes.fileIdがhunkと一致しません: ${hunk.id}`)
  }
  if (
    notes.detailLevel !== policy.detailLevel ||
    notes.summaryOnlyKind !== policy.summaryOnlyKind ||
    notes.summaryOnlyReason !== policy.rationale
  ) {
    throw new Error(`walkthroughNotesがcollector explanationPolicyと一致しません: ${hunk.id}`)
  }

  if (policy.detailLevel === 'summary-only') {
    if (notes.segments.length !== 0) {
      throw new Error(`summary-only hunkにsegmentがあります: ${hunk.id}`)
    }
    return
  }

  let nextLineIndex = 0
  for (const [segmentIndex, segment] of notes.segments.entries()) {
    const label = `${hunk.id} segment[${segmentIndex}]`
    if (segment.startLineIndex !== nextLineIndex) {
      throw new Error(`${label}が昇順の連続coverageではありません。`)
    }
    if (segment.endLineIndex < segment.startLineIndex) {
      throw new Error(`${label}のendLineIndexがstartLineIndexより前です。`)
    }
    if (segment.endLineIndex - segment.startLineIndex + 1 > 120) {
      throw new Error(`${label}が120 diff行を超えています。`)
    }
    if (segment.endLineIndex >= hunk.lines.length) {
      throw new Error(`${label}がhunkのdiff行範囲を超えています。`)
    }
    for (const findingIndex of segment.findingIndexes) {
      if (findingIndex >= analysis.findings.length) {
        throw new Error(`${label}が範囲外findingIndexesを参照しています: ${findingIndex}`)
      }
    }
    nextLineIndex = segment.endLineIndex + 1
  }
  if (nextLineIndex !== hunk.lines.length) {
    throw new Error(`segmentがhunkの全diff行をcoverageしていません: ${hunk.id}`)
  }
}

function assertFindingLocations(analysis, hunk, ruleMap) {
  for (const [findingIndex, finding] of analysis.findings.entries()) {
    const label = `${hunk.id} finding[${findingIndex}]`
    if (finding.startLine > finding.endLine) {
      throw new Error(`${label}のstartLineがendLineより後です。`)
    }
    if (finding.locationKind === 'rule') {
      const matchingRules = ruleMap.get(finding.file) ?? []
      if (matchingRules.length !== 1) {
        throw new Error(`${label}のrule fileを一意に解決できません: ${finding.file}`)
      }
      const ruleLineCount = matchingRules[0].content.split(/\r?\n/u).length
      if (finding.endLine > ruleLineCount) {
        throw new Error(
          `${label}のrule locationが収集済みruleの行範囲を超えています: ${finding.file}`,
        )
      }
      continue
    }
    if (finding.locationKind !== 'diff') continue
    if (finding.file !== hunk.file) {
      throw new Error(`${label}のfileが割当hunkと一致しません。`)
    }
    const lineKey = finding.lineSide === 'old' ? 'oldLine' : 'newLine'
    const intersectsHunk = hunk.lines.some((line) => {
      const lineNumber = line?.[lineKey]
      return (
        Number.isInteger(lineNumber) &&
        lineNumber >= finding.startLine &&
        lineNumber <= finding.endLine
      )
    })
    if (!intersectsHunk) {
      throw new Error(`${label}のdiff locationが割当hunkと交差しません。`)
    }
  }
}

export function validateBatchOutput(batchOutput, blindInput, batchId) {
  if (!validateBatch(batchOutput)) {
    throw new Error(`batch output Schema違反: ${JSON.stringify(validateBatch.errors)}`)
  }
  if (typeof batchId !== 'string' || batchId.length === 0) {
    throw new Error('batch-idは空でないstringである必要があります。')
  }
  if (batchOutput.batchId !== batchId) {
    throw new Error(
      `batch outputのbatchIdが指定値と一致しません: ${batchOutput.batchId} !== ${batchId}`,
    )
  }
  const { input, batch, fileMap, hunkMap, ruleMap } = semanticInput(
    blindInput,
    batchId,
  )
  const actualHunkIds = batchOutput.hunks.map((hunk) => hunk.hunkId)
  unique(actualHunkIds, 'batch output hunk ID')
  if (!sameSet(actualHunkIds, batch.hunkIds)) {
    throw new Error('batch outputのhunk集合が指定Blind batchと一致しません。')
  }

  for (const analysis of batchOutput.hunks) {
    const hunk = hunkMap.get(analysis.hunkId)
    const file = fileMap.get(hunk.fileId)
    assertFindingLocations(analysis, hunk, ruleMap)
    assertWalkthroughNotes(analysis, hunk, file, input.mode)
  }
  return batchOutput
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(resolve(path), 'utf8'))
  } catch (error) {
    throw new Error(
      `${label}を読み込めません: ${path}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }
}

function isMainModule() {
  const entry = process.argv[1]
  return (
    Boolean(entry) &&
    realpathSync(resolve(entry)) === realpathSync(fileURLToPath(import.meta.url))
  )
}

if (isMainModule()) {
  const [outputPath, blindInputPath, batchId, ...extra] = process.argv.slice(2)
  if (!outputPath || !blindInputPath || !batchId || extra.length > 0) {
    process.stderr.write(
      'usage: node validate-batch-output.mjs <batch-output.json> <blind-input.json> <batch-id>\n',
    )
    process.exitCode = 2
  } else {
    try {
      validateBatchOutput(
        readJson(outputPath, 'batch output'),
        readJson(blindInputPath, 'blind input'),
        batchId,
      )
      process.stdout.write(`${outputPath}: valid (${batchId})\n`)
    } catch (error) {
      process.stderr.write(
        `batch output validation failed: ${
          error instanceof Error ? error.message : String(error)
        }\n`,
      )
      process.exitCode = 1
    }
  }
}
