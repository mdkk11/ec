import { basename, extname } from 'node:path'

import { SHIKI_VERSION, THEMES, tokenize } from './syntax-highlighter.bundle.mjs'

export const HIGHLIGHT_LIMITS = Object.freeze({
  milliseconds: 10_000,
  inputBytesPerHunk: 1024 * 1024,
  tokenRunsPerHunk: 100_000,
  tokenBytesRatio: 4,
  tokenBytesFixedAllowance: 256,
  reportBytes: 64 * 1024 * 1024,
})

const EXTENSIONS = Object.freeze({
  '.bash': 'bash', '.c': 'c', '.cc': 'cpp', '.cpp': 'cpp', '.cs': 'csharp',
  '.css': 'css', '.go': 'go', '.h': 'c', '.hpp': 'cpp', '.htm': 'html',
  '.html': 'html', '.java': 'java', '.js': 'javascript', '.json': 'json',
  '.jsonc': 'jsonc', '.jsx': 'jsx', '.kt': 'kotlin', '.kts': 'kotlin',
  '.md': 'markdown', '.mdx': 'mdx', '.mjs': 'javascript', '.php': 'php',
  '.py': 'python', '.rb': 'ruby', '.rs': 'rust', '.scss': 'scss', '.sh': 'bash',
  '.sql': 'sql', '.swift': 'swift', '.ts': 'typescript', '.tsx': 'tsx',
  '.yaml': 'yaml', '.yml': 'yaml',
})

const FILE_NAMES = Object.freeze({
  Dockerfile: 'bash', Gemfile: 'ruby', Makefile: 'bash', Rakefile: 'ruby',
  '.bashrc': 'bash', '.zshrc': 'bash',
})

export class TokenDataCorruptionError extends Error {}

export function languageForPath(path) {
  const name = basename(path)
  return FILE_NAMES[name] ?? EXTENSIONS[extname(name).toLowerCase()] ?? null
}

function fontFields(value = 0) {
  return {
    fontStyle: value & 1 ? 'italic' : 'normal',
    fontWeight: value & 2 ? '700' : '400',
    textDecoration: [value & 4 ? 'underline' : '', value & 8 ? 'line-through' : '']
      .filter(Boolean)
      .join(' ') || 'none',
  }
}

function styleFromToken(token) {
  const light = token.variants.light ?? {}
  const dark = token.variants.dark ?? {}
  return {
    light: { color: light.color ?? null, ...fontFields(light.fontStyle) },
    dark: { color: dark.color ?? null, ...fontFields(dark.fontStyle) },
  }
}

function styleId(style, styles, ids) {
  const key = JSON.stringify(style)
  if (!ids.has(key)) {
    ids.set(key, styles.length)
    styles.push({ id: styles.length, ...style })
  }
  return ids.get(key)
}

function runsForTokens(tokens, text, styles, ids) {
  const runs = []
  let offset = 0
  for (const token of tokens) {
    const start = offset
    offset += token.content.length
    if (text.slice(start, offset) !== token.content) {
      throw new TokenDataCorruptionError(
        `tokenized text content mismatch at offset ${start}`,
      )
    }
    const id = styleId(styleFromToken(token), styles, ids)
    const previous = runs.at(-1)
    if (previous?.[2] === id && previous[1] === start) previous[1] = offset
    else runs.push([start, offset, id])
  }
  if (offset !== text.length) {
    throw new TokenDataCorruptionError(
      `tokenized text length mismatch: ${offset} !== ${text.length}`,
    )
  }
  return runs
}

function tokenizeStream(lines, language, styles, ids, tokenizer) {
  if (lines.length === 0) return []
  const tokenLines = tokenizer(lines.map((line) => line.text).join('\n'), language)
  if (tokenLines.length !== lines.length) {
    throw new TokenDataCorruptionError('Shiki token line count mismatch')
  }
  return tokenLines.map((tokens, index) =>
    runsForTokens(tokens, lines[index].text, styles, ids),
  )
}

function plainHunk(hunk) {
  return {
    ...hunk,
    lines: hunk.lines.map((line) => ({ ...line, tokenRuns: [] })),
  }
}

function highlightedHunk(hunk, language, styles, ids, tokenizer) {
  const oldLines = hunk.lines.filter(
    (line) => line.kind === 'context' || line.kind === 'deletion',
  )
  const newLines = hunk.lines.filter(
    (line) => line.kind === 'context' || line.kind === 'addition',
  )
  const oldRuns = tokenizeStream(oldLines, language, styles, ids, tokenizer)
  const newRuns = tokenizeStream(newLines, language, styles, ids, tokenizer)
  let oldIndex = 0
  let newIndex = 0
  const lines = hunk.lines.map((line) => {
    let tokenRuns = []
    if (line.kind === 'deletion') tokenRuns = oldRuns[oldIndex]
    else if (line.kind === 'addition' || line.kind === 'context') {
      tokenRuns = newRuns[newIndex]
    }
    if (line.kind === 'deletion' || line.kind === 'context') oldIndex += 1
    if (line.kind === 'addition' || line.kind === 'context') newIndex += 1
    return { ...line, tokenRuns }
  })
  return { ...hunk, lines }
}

function payloadStats(hunk) {
  const runs = hunk.lines.reduce((total, line) => total + line.tokenRuns.length, 0)
  const tokenBytes = Buffer.byteLength(
    JSON.stringify(hunk.lines.map((line) => line.tokenRuns)),
  )
  const textBytes = Math.max(
    1,
    Buffer.byteLength(hunk.lines.map((line) => line.text).join('\n')),
  )
  const maximumTokenBytes =
    textBytes * HIGHLIGHT_LIMITS.tokenBytesRatio +
    HIGHLIGHT_LIMITS.tokenBytesFixedAllowance
  return { runs, tokenBytes, maximumTokenBytes }
}

function hunkTextBytes(hunk) {
  return Buffer.byteLength(hunk.lines.map((line) => line.text).join('\n'))
}

export function highlightHunks(hunks, options = {}) {
  const now = options.now ?? (() => performance.now())
  const budget = options.milliseconds ?? HIGHLIGHT_LIMITS.milliseconds
  const inputByteLimit =
    options.inputBytesPerHunk ?? HIGHLIGHT_LIMITS.inputBytesPerHunk
  const tokenizer = options.tokenize ?? tokenize
  const started = now()
  const styles = []
  const ids = new Map()
  const fallbacks = []
  const output = []
  let deadlineExceeded = false

  for (const hunk of hunks) {
    if (deadlineExceeded || now() - started >= budget) {
      deadlineExceeded = true
      output.push(plainHunk(hunk))
      fallbacks.push({ hunkId: hunk.id, reason: 'time-budget' })
      continue
    }
    const language = languageForPath(hunk.file)
    if (!language) {
      output.push(plainHunk(hunk))
      fallbacks.push({ hunkId: hunk.id, reason: 'unsupported-language' })
      continue
    }
    if (hunkTextBytes(hunk) > inputByteLimit) {
      output.push(plainHunk(hunk))
      fallbacks.push({ hunkId: hunk.id, reason: 'token-limit' })
      continue
    }
    try {
      const candidate = highlightedHunk(hunk, language, styles, ids, tokenizer)
      if (now() - started >= budget) {
        deadlineExceeded = true
        output.push(plainHunk(hunk))
        fallbacks.push({ hunkId: hunk.id, reason: 'time-budget' })
        continue
      }
      const stats = payloadStats(candidate)
      if (
        stats.runs > HIGHLIGHT_LIMITS.tokenRunsPerHunk ||
        stats.tokenBytes > stats.maximumTokenBytes
      ) {
        output.push(plainHunk(hunk))
        fallbacks.push({ hunkId: hunk.id, reason: 'token-limit' })
      } else output.push(candidate)
    } catch (error) {
      if (error instanceof TokenDataCorruptionError) throw error
      output.push(plainHunk(hunk))
      fallbacks.push({ hunkId: hunk.id, reason: 'tokenize-error' })
    }
  }
  return {
    hunks: output,
    highlighting: {
      version: SHIKI_VERSION,
      engine: 'javascript-regexp',
      themes: THEMES,
      styles,
      fallbacks,
    },
  }
}

export function validateTokenRuns(hunks, styles) {
  const styleIds = new Set(styles.map((style) => style.id))
  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      let cursor = 0
      for (const run of line.tokenRuns) {
        const [start, end, styleId] = run
        if (
          !Number.isInteger(start) || !Number.isInteger(end) ||
          start !== cursor || end <= start || end > line.text.length ||
          !styleIds.has(styleId)
        ) throw new Error(`token runが不正です: ${hunk.id}`)
        cursor = end
      }
      if (line.tokenRuns.length > 0 && cursor !== line.text.length) {
        throw new Error(`token runが元の行を復元できません: ${hunk.id}`)
      }
    }
  }
}
