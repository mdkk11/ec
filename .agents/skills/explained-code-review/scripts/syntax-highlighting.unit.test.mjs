import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  highlightHunks,
  languageForPath,
  TokenDataCorruptionError,
  validateTokenRuns,
} from './syntax-highlighting.mjs'

const directory = dirname(fileURLToPath(import.meta.url))

function hunk(id, file, texts) {
  return {
    id,
    fileId: `file-${id}`,
    file,
    header: '@@ -1 +1 @@',
    oldStart: 1,
    oldLines: texts.length,
    newStart: 1,
    newLines: texts.length,
    lines: texts.map((text, index) => ({
      kind: index % 3 === 0 ? 'deletion' : index % 3 === 1 ? 'addition' : 'context',
      oldLine: index % 3 === 1 ? null : index + 1,
      newLine: index % 3 === 0 ? null : index + 1,
      text,
    })),
  }
}

test('代表的な拡張子とfile名を対応言語へ決定する', () => {
  assert.equal(languageForPath('src/example.tsx'), 'tsx')
  assert.equal(languageForPath('config/.bashrc'), 'bash')
  assert.equal(languageForPath('schema.sql'), 'sql')
  assert.equal(languageForPath('asset.unknown'), null)
})

test('tokenの行数または文字列復元が一致しない場合はfallbackせず停止する', () => {
  assert.throws(
    () =>
      highlightHunks([hunk('broken-lines', 'src/broken.ts', ['const value = 1'])], {
        tokenize: () => [],
      }),
    TokenDataCorruptionError,
  )
  assert.throws(
    () =>
      highlightHunks([hunk('broken-text', 'src/broken.ts', ['const value = 1'])], {
        tokenize: () => [[{ content: 'different', variants: { light: {}, dark: {} } }]],
      }),
    TokenDataCorruptionError,
  )
  assert.throws(
    () =>
      highlightHunks([hunk('same-length', 'src/broken.ts', ['const value = 1'])], {
        tokenize: () => [
          [{ content: 'const value = 2', variants: { light: {}, dark: {} } }],
        ],
      }),
    TokenDataCorruptionError,
  )
})

test('短い正常hunkは固定overheadだけでtoken-limitへfallbackしない', () => {
  const result = highlightHunks([hunk('short', 'src/short.ts', ['const value = 1'])])
  assert.deepEqual(result.highlighting.fallbacks, [])
  assert.ok(result.hunks[0].lines[0].tokenRuns.length > 1)
})

test('固定allowanceを超える大きなtoken payloadは4倍上限でfallbackする', () => {
  const text = 'x'.repeat(512)
  const result = highlightHunks([hunk('dense', 'src/dense.ts', [text])], {
    tokenize: () => [
      Array.from({ length: text.length }, (_, index) => ({
        content: 'x',
        variants: {
          light: { color: index % 2 === 0 ? '#000000' : '#111111' },
          dark: { color: index % 2 === 0 ? '#ffffff' : '#eeeeee' },
        },
      })),
    ],
  })
  assert.deepEqual(result.highlighting.fallbacks, [
    { hunkId: 'dense', reason: 'token-limit' },
  ])
  assert.ok(result.hunks[0].lines.every((line) => line.tokenRuns.length === 0))
})

test('1 MiBを超える単一hunkはtokenize前にtoken-limitへfallbackする', () => {
  let tokenizeCalls = 0
  const result = highlightHunks(
    [hunk('oversized-input', 'src/oversized.ts', ['x'.repeat(1024 * 1024 + 1)])],
    {
      tokenize: () => {
        tokenizeCalls += 1
        throw new Error('preflightで呼ばれない')
      },
    },
  )
  assert.equal(tokenizeCalls, 0)
  assert.deepEqual(result.highlighting.fallbacks, [
    { hunkId: 'oversized-input', reason: 'token-limit' },
  ])
  assert.deepEqual(result.hunks[0].lines[0].tokenRuns, [])
})

test('token textを複製せずUTF-16 rangeとstyle tableで元行を復元する', () => {
  const source = Array.from(
    { length: 100 },
    (_, index) =>
      `export function calculateOrderTotal${index}(items: readonly OrderItem[]): number { return items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) }`,
  )
  const result = highlightHunks([hunk('typescript', 'src/order.ts', source)])
  assert.deepEqual(result.highlighting.fallbacks, [])
  assert.ok(result.highlighting.styles.length > 1)
  assert.ok(result.hunks[0].lines.some((line) => line.tokenRuns.length > 1))
  validateTokenRuns(result.hunks, result.highlighting.styles)
  for (const line of result.hunks[0].lines) {
    assert.equal(
      line.tokenRuns.map(([start, end]) => line.text.slice(start, end)).join(''),
      line.text,
    )
  }
  assert.doesNotMatch(JSON.stringify(result.hunks[0].lines[0].tokenRuns), /export/u)
})

test('unsupported languageと時間超過はhunk単位でplain textへfallbackする', () => {
  const unsupported = highlightHunks([hunk('plain', 'README.weird', ['plain'])])
  assert.deepEqual(unsupported.highlighting.fallbacks, [
    { hunkId: 'plain', reason: 'unsupported-language' },
  ])
  let clock = 0
  const timed = highlightHunks(
    [hunk('late', 'src/late.ts', ['const late = true'])],
    { milliseconds: 10, now: () => (clock += 20) },
  )
  assert.deepEqual(timed.highlighting.fallbacks, [
    { hunkId: 'late', reason: 'time-budget' },
  ])
})

test('tokenize完了時に時間超過していれば現在と後続のhunkをfallbackする', () => {
  let clock = 0
  let tokenizeCalls = 0
  const tokenizer = (code) => {
    tokenizeCalls += 1
    clock = 20
    return [[{ content: code, variants: { light: {}, dark: {} } }]]
  }
  const result = highlightHunks(
    [
      hunk('expired-current', 'src/current.ts', ['const current = true']),
      hunk('expired-following', 'src/following.ts', ['const following = true']),
    ],
    { milliseconds: 10, now: () => clock, tokenize: tokenizer },
  )
  assert.deepEqual(result.highlighting.fallbacks, [
    { hunkId: 'expired-current', reason: 'time-budget' },
    { hunkId: 'expired-following', reason: 'time-budget' },
  ])
  assert.equal(tokenizeCalls, 1)
  assert.ok(
    result.hunks.every((value) =>
      value.lines.every((line) => line.tokenRuns.length === 0),
    ),
  )
})

test('生成bundleのShiki versionとsource hash、NOTICEが一致する', () => {
  const source = readFileSync(join(directory, 'syntax-highlighter.source.mjs'))
  const bundle = readFileSync(join(directory, 'syntax-highlighter.bundle.mjs'), 'utf8')
  const notice = readFileSync(join(directory, '..', 'THIRD_PARTY_NOTICES.md'), 'utf8')
  const hash = createHash('sha256').update(source).digest('hex')
  assert.match(bundle, new RegExp(`Shiki 4\\.3\\.1; source-sha256 ${hash}`, 'u'))
  assert.match(notice, /Shiki 4\.3\.1/u)
  assert.match(notice, /MIT License/u)
  assert.match(notice, /第三者ソフトウェア/u)
})
