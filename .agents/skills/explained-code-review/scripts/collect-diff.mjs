import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

export const LIMITS = Object.freeze({
  totalBytes: 25 * 1024 * 1024,
  fileBytes: 5 * 1024 * 1024,
  diffLines: 250_000,
  hunks: 20_000,
})

const REVIEW_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/u
const REVIEW_SCHEMA_SALT = 'explained-code-review-v2'
const DEFAULT_RULE_FILES = [
  'AGENTS.md',
  'README.md',
  'CONTRIBUTING.md',
  'CODEOWNERS',
  '.github/CODEOWNERS',
  'docs/CODEOWNERS',
  '.github/PULL_REQUEST_TEMPLATE.md',
  '.github/pull_request_template.md',
]

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function git(repository, args, options = {}) {
  return execFileSync(
    'git',
    ['-c', 'core.quotepath=false', ...args],
    {
      cwd: repository,
      encoding: options.buffer ? null : 'utf8',
      env: {
        ...process.env,
        GIT_OPTIONAL_LOCKS: '0',
      },
      maxBuffer: 256 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
}

function tryGit(repository, args) {
  try {
    return git(repository, args).trim()
  } catch {
    return null
  }
}

function repositoryPath(repository, absolutePath) {
  return relative(repository, absolutePath).split(sep).join('/')
}

function isExcludedPath(path, planPath) {
  return (
    path === '.review' ||
    path.startsWith('.review/') ||
    (planPath !== null && path === planPath)
  )
}

function resolveRegularRepositoryFile(repository, inputPath) {
  const unresolved = isAbsolute(inputPath)
    ? inputPath
    : resolve(repository, inputPath)
  if (lstatSync(unresolved).isSymbolicLink()) {
    throw new Error(`symlinkはfile指定に使用できません: ${inputPath}`)
  }
  const absolutePath = realpathSync(unresolved)
  const root = realpathSync(repository)
  const prefix = `${root}${sep}`

  if (absolutePath !== root && !absolutePath.startsWith(prefix)) {
    throw new Error(`repository外のfileは指定できません: ${inputPath}`)
  }
  if (!statSync(absolutePath).isFile()) {
    throw new Error(`通常fileではありません: ${inputPath}`)
  }
  return {
    absolutePath,
    repositoryPath: repositoryPath(root, absolutePath),
  }
}

function resolveCommit(repository, ref) {
  if (!ref) {
    throw new Error('base refは空にできません。')
  }
  try {
    return git(repository, [
      'rev-parse',
      '--verify',
      '--end-of-options',
      `${ref}^{commit}`,
    ]).trim()
  } catch {
    throw new Error(`commitとして解決できないrefです: ${ref}`)
  }
}

function resolveBase(repository, explicitBase) {
  if (explicitBase) {
    return { ref: explicitBase, oid: resolveCommit(repository, explicitBase) }
  }

  const candidates = []
  const remoteHead = tryGit(repository, [
    'symbolic-ref',
    '--quiet',
    '--short',
    'refs/remotes/origin/HEAD',
  ])
  if (remoteHead) {
    candidates.push(remoteHead)
  }
  candidates.push('origin/main', 'main', 'origin/master', 'master')

  for (const ref of [...new Set(candidates)]) {
    try {
      return { ref, oid: resolveCommit(repository, ref) }
    } catch {
      // Try the next conventional base.
    }
  }
  throw new Error(
    `baseを自動解決できません。--baseで指定してください。試行: ${[
      ...new Set(candidates),
    ].join(', ')}`,
  )
}

function parsePorcelain(buffer) {
  const records = buffer.toString('utf8').split('\0')
  const entries = []
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index]
    if (!record) continue
    if (record.startsWith('? ')) {
      entries.push({
        path: record.slice(2),
        oldPath: null,
        sources: ['untracked'],
      })
      continue
    }
    if (record.startsWith('1 ')) {
      const parts = record.split(' ')
      const xy = parts[1]
      entries.push({
        path: parts.slice(8).join(' '),
        oldPath: null,
        sources: [
          ...(xy[0] !== '.' ? ['staged'] : []),
          ...(xy[1] !== '.' ? ['unstaged'] : []),
        ],
      })
      continue
    }
    if (record.startsWith('2 ')) {
      const parts = record.split(' ')
      const xy = parts[1]
      const path = parts.slice(9).join(' ')
      const oldPath = records[index + 1]
      index += 1
      entries.push({
        path,
        oldPath,
        sources: [
          ...(xy[0] !== '.' ? ['staged'] : []),
          ...(xy[1] !== '.' ? ['unstaged'] : []),
        ],
      })
    }
  }
  return entries
}

function statusSnapshot(repository) {
  const raw = git(
    repository,
    ['status', '--porcelain=v2', '-z', '--untracked-files=all'],
    { buffer: true },
  )
  return { raw, entries: parsePorcelain(raw) }
}

function changedPlanCandidates(statusEntries, branch) {
  const candidates = new Set()
  for (const entry of statusEntries) {
    for (const path of [entry.path, entry.oldPath]) {
      if (path && /^plans\/.+\.md$/u.test(path)) {
        candidates.add(path)
      }
    }
  }
  if (branch !== 'HEAD') {
    const name = branch.split('/').at(-1)
    if (name) candidates.add(`plans/${name}.md`)
  }
  return [...candidates]
}

function resolvePlan(repository, statusEntries, branch, options) {
  if (options.noPlan && options.planPath) {
    throw new Error('--planと--no-planは同時に指定できません。')
  }
  if (options.noPlan) {
    return {
      schemaVersion: 2,
      resolution: 'disabled',
      path: null,
      content: null,
    }
  }
  if (options.planPath) {
    const file = resolveRegularRepositoryFile(repository, options.planPath)
    return {
      schemaVersion: 2,
      resolution: 'explicit',
      path: file.repositoryPath,
      content: readFileSync(file.absolutePath, 'utf8'),
    }
  }

  const candidates = changedPlanCandidates(statusEntries, branch).filter(
    (path) => existsSync(join(repository, path)),
  )
  const valid = []
  for (const candidate of [...new Set(candidates)].sort()) {
    try {
      valid.push(resolveRegularRepositoryFile(repository, candidate))
    } catch {
      // A discovered symlink or non-file is not a valid implicit plan.
    }
  }
  if (valid.length > 1) {
    throw new Error(
      `plan候補が複数あります。--planで指定してください: ${valid
        .map((item) => item.repositoryPath)
        .join(', ')}`,
    )
  }
  if (valid.length === 0) {
    return {
      schemaVersion: 2,
      resolution: 'absent',
      path: null,
      content: null,
    }
  }
  return {
    schemaVersion: 2,
    resolution: 'auto',
    path: valid[0].repositoryPath,
    content: readFileSync(valid[0].absolutePath, 'utf8'),
  }
}

function pathspec(planPath) {
  return [
    '--',
    '.',
    ':(top,exclude).review',
    ':(top,exclude).review/**',
    ...(planPath ? [`:(top,exclude,literal)${planPath}`] : []),
  ]
}

function fullPatch(repository, mergeBase, planPath) {
  return git(
    repository,
    [
      'diff',
      '--patch',
      '--find-renames',
      '--find-copies',
      '--no-ext-diff',
      '--no-textconv',
      '--no-color',
      '--unified=3',
      mergeBase,
      ...pathspec(planPath),
    ],
    { buffer: true },
  )
}

function untrackedPaths(repository, planPath) {
  return git(
    repository,
    ['ls-files', '--others', '--exclude-standard', '-z'],
    { buffer: true },
  )
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .filter((path) => !isExcludedPath(path, planPath))
    .sort()
}

function readUntracked(repository, paths, includeContent) {
  const files = []
  for (const path of paths) {
    const absolute = resolve(repository, path)
    const relativePath = repositoryPath(repository, absolute)
    if (relativePath !== path || relativePath.startsWith('../')) {
      throw new Error(`不正なuntracked pathです: ${path}`)
    }
    const stat = lstatSync(absolute)
    if (!stat.isFile()) {
      throw new Error(`untrackedの通常file以外はreviewできません: ${path}`)
    }
    if (stat.size > LIMITS.fileBytes) {
      throw new Error(
        `単一fileの上限${LIMITS.fileBytes} bytesを超えています: ${path} (${stat.size} bytes)`,
      )
    }
    const content = readFileSync(absolute)
    files.push({
      path,
      size: stat.size,
      digest: sha256(content),
      ...(includeContent ? { content } : {}),
    })
  }
  return files
}

function snapshot(repository, mergeBase, planPath, includeContent = false) {
  const patch = fullPatch(repository, mergeBase, planPath)
  const status = statusSnapshot(repository)
  const untracked = readUntracked(
    repository,
    untrackedPaths(repository, planPath),
    includeContent,
  )
  const manifest = Buffer.from(
    JSON.stringify(
      untracked.map(({ path, size, digest }) => ({ path, size, digest })),
    ),
  )
  const fingerprint = sha256(
    Buffer.concat([patch, Buffer.from('\0'), status.raw, Buffer.from('\0'), manifest]),
  )
  return { fingerprint, patch, status, untracked }
}

function parseNameStatus(buffer) {
  const tokens = buffer.toString('utf8').split('\0')
  const paths = []
  let index = 0
  while (index < tokens.length) {
    const statusToken = tokens[index++]
    if (!statusToken) continue
    const firstPath = tokens[index++]
    if (!firstPath) throw new Error(`git name-statusを解析できません: ${statusToken}`)
    const status = statusToken[0]
    if (status === 'R' || status === 'C') {
      const secondPath = tokens[index++]
      if (!secondPath) {
        throw new Error(`rename/copy pathを解析できません: ${firstPath}`)
      }
      paths.push({
        status: statusToken,
        oldPath: firstPath,
        newPath: secondPath,
      })
    } else {
      paths.push({
        status: statusToken,
        oldPath: status === 'A' ? null : firstPath,
        newPath: status === 'D' ? null : firstPath,
      })
    }
  }
  return paths
}

function parseHunks(patch, fileId, file, firstHunkNumber) {
  const lines = patch.split('\n')
  const hunks = []
  let current = null
  let oldLine = 0
  let newLine = 0

  for (const line of lines) {
    const header = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/u.exec(line)
    if (header) {
      oldLine = Number(header[1])
      newLine = Number(header[3])
      current = {
        id: `hunk-${firstHunkNumber + hunks.length}`,
        fileId,
        file,
        header: line,
        oldStart: oldLine,
        oldLines: Number(header[2] ?? 1),
        newStart: newLine,
        newLines: Number(header[4] ?? 1),
        lines: [],
      }
      hunks.push(current)
      continue
    }
    if (!current) continue
    if (line.startsWith('+') && !line.startsWith('+++')) {
      current.lines.push({
        kind: 'addition',
        oldLine: null,
        newLine,
        text: line.slice(1),
      })
      newLine += 1
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      current.lines.push({
        kind: 'deletion',
        oldLine,
        newLine: null,
        text: line.slice(1),
      })
      oldLine += 1
    } else if (line.startsWith(' ')) {
      current.lines.push({
        kind: 'context',
        oldLine,
        newLine,
        text: line.slice(1),
      })
      oldLine += 1
      newLine += 1
    } else if (line === '\\ No newline at end of file') {
      current.lines.push({
        kind: 'meta',
        oldLine: null,
        newLine: null,
        text: line,
      })
    }
  }
  return hunks
}

function metaHunk(id, fileId, file, description) {
  return {
    id: `hunk-${id}`,
    fileId,
    file,
    header: description,
    oldStart: 0,
    oldLines: 0,
    newStart: 0,
    newLines: 0,
    lines: [
      {
        kind: 'meta',
        oldLine: null,
        newLine: null,
        text: description,
      },
    ],
  }
}

function sourceMap(statusEntries, planPath) {
  const map = new Map()
  for (const entry of statusEntries) {
    for (const path of [entry.path, entry.oldPath]) {
      if (!path || isExcludedPath(path, planPath)) continue
      const sources = map.get(path) ?? new Set()
      for (const source of entry.sources) sources.add(source)
      map.set(path, sources)
    }
  }
  return map
}

function hasCommittedChange(repository, mergeBase, headOid, paths) {
  try {
    git(repository, [
      'diff',
      '--quiet',
      '--no-ext-diff',
      '--no-textconv',
      mergeBase,
      headOid,
      '--',
      ...paths,
    ])
    return false
  } catch {
    return true
  }
}

function parsePatchMetadata(patch) {
  const headerLines = []
  for (const line of patch.split(/\r?\n/u)) {
    if (line.startsWith('@@ ')) break
    headerLines.push(line)
  }
  const modes = new Set()
  for (const line of headerLines) {
    const mode =
      line.match(
        /^(?:old mode|new mode|new file mode|deleted file mode) (120000|160000)$/u,
      ) ??
      line.match(/^index [0-9a-f]+\.\.[0-9a-f]+ (120000|160000)$/u)
    if (mode) modes.add(mode[1])
  }
  return {
    binary: headerLines.some(
      (line) =>
        line === 'GIT binary patch' ||
        /^Binary files .+ differ$/u.test(line),
    ),
    specialType: modes.has('120000')
      ? 'Tracked symlink'
      : modes.has('160000')
        ? 'Submodule'
        : null,
  }
}

function collectTrackedFiles(
  repository,
  mergeBase,
  headOid,
  planPath,
  statusEntries,
  targetOid = null,
) {
  const target = targetOid ? [targetOid] : []
  const changedPaths = parseNameStatus(
    git(
      repository,
      [
        'diff',
        '--name-status',
        '-z',
        '--find-renames',
        '--find-copies',
        '--no-ext-diff',
        '--no-textconv',
        mergeBase,
        ...target,
        ...pathspec(planPath),
      ],
      { buffer: true },
    ),
  )
  const sourcesByPath = sourceMap(statusEntries, planPath)
  const files = []
  let hunkNumber = 1

  for (const changed of changedPaths) {
    const path = changed.newPath ?? changed.oldPath
    if (!path || isExcludedPath(path, planPath)) continue
    const pathArguments = [
      ...(changed.oldPath ? [changed.oldPath] : []),
      ...(changed.newPath && changed.newPath !== changed.oldPath
        ? [changed.newPath]
        : []),
    ]
    const patch = git(repository, [
      'diff',
      '--patch',
      '--find-renames',
      '--find-copies',
      '--no-ext-diff',
      '--no-textconv',
      '--no-color',
      '--unified=3',
      mergeBase,
      ...target,
      '--',
      ...pathArguments,
    ])
    const fileId = `file-${files.length + 1}`
    const { binary, specialType } = parsePatchMetadata(patch)
    if (!binary && Buffer.byteLength(patch) > LIMITS.fileBytes) {
      throw new Error(
        `単一text fileのdiff上限${LIMITS.fileBytes} bytesを超えています: ${path} (${Buffer.byteLength(patch)} bytes)`,
      )
    }
    let hunks = specialType
      ? [
          metaHunk(
            hunkNumber,
            fileId,
            path,
            `${specialType} changed: ${changed.oldPath ?? '/dev/null'} -> ${changed.newPath ?? '/dev/null'}`,
          ),
        ]
      : parseHunks(patch, fileId, path, hunkNumber)
    if (hunks.length === 0) {
      hunks = [
        metaHunk(
          hunkNumber,
          fileId,
          path,
          binary
            ? `Binary file changed: ${path}`
            : `${changed.status}: ${changed.oldPath ?? '/dev/null'} -> ${changed.newPath ?? '/dev/null'}`,
        ),
      ]
    }
    const currentPath = changed.newPath ? join(repository, changed.newPath) : null
    const size =
      currentPath && existsSync(currentPath) && lstatSync(currentPath).isFile()
        ? lstatSync(currentPath).size
        : 0
    const sources = new Set([
      ...(changed.oldPath ? (sourcesByPath.get(changed.oldPath) ?? []) : []),
      ...(changed.newPath ? (sourcesByPath.get(changed.newPath) ?? []) : []),
    ])
    if (hasCommittedChange(repository, mergeBase, headOid, pathArguments)) {
      sources.add('committed')
    }
    files.push({
      id: fileId,
      path,
      oldPath: changed.oldPath,
      newPath: changed.newPath,
      status: changed.status,
      additions: hunks.reduce(
        (count, hunk) =>
          count + hunk.lines.filter((line) => line.kind === 'addition').length,
        0,
      ),
      deletions: hunks.reduce(
        (count, hunk) =>
          count + hunk.lines.filter((line) => line.kind === 'deletion').length,
        0,
      ),
      binary,
      size,
      changeSources: [...sources].sort(),
      hunks,
    })
    hunkNumber += hunks.length
  }
  return { files, nextHunkNumber: hunkNumber }
}

function collectUntrackedFiles(untracked, firstFileNumber, firstHunkNumber) {
  const files = []
  let hunkNumber = firstHunkNumber
  for (const item of untracked) {
    const fileId = `file-${firstFileNumber + files.length}`
    const text = item.content.toString('utf8')
    const binary =
      item.content.includes(0) || !Buffer.from(text, 'utf8').equals(item.content)
    let hunks
    if (binary) {
      hunks = [
        metaHunk(
          hunkNumber,
          fileId,
          item.path,
          `Binary file added: ${item.path} (${item.size} bytes)`,
        ),
      ]
    } else {
      const lines = text.split('\n')
      if (lines.at(-1) === '') lines.pop()
      hunks = [
        {
          id: `hunk-${hunkNumber}`,
          fileId,
          file: item.path,
          header: `@@ -0,0 +1,${lines.length} @@`,
          oldStart: 0,
          oldLines: 0,
          newStart: lines.length === 0 ? 0 : 1,
          newLines: lines.length,
          lines: lines.map((line, index) => ({
            kind: 'addition',
            oldLine: null,
            newLine: index + 1,
            text: line,
          })),
        },
      ]
    }
    files.push({
      id: fileId,
      path: item.path,
      oldPath: null,
      newPath: item.path,
      status: 'A',
      additions: binary ? 0 : hunks[0].lines.length,
      deletions: 0,
      binary,
      size: item.size,
      changeSources: ['untracked'],
      hunks,
    })
    hunkNumber += hunks.length
  }
  return files
}

function collectCommits(repository, mergeBase, headOid) {
  const output = git(repository, [
    'log',
    '--format=%H%x1f%h%x1f%an%x1f%aI%x1f%s%x1e',
    `${mergeBase}..${headOid}`,
  ])
  return output
    .split('\x1e')
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [oid, shortOid, author, authoredAt, ...subject] = record.split('\x1f')
      return {
        oid,
        shortOid,
        author,
        authoredAt,
        subject: subject.join('\x1f'),
      }
    })
}

function walkMarkdownFiles(repository, relativeDirectory) {
  const root = join(repository, relativeDirectory)
  if (!existsSync(root) || !lstatSync(root).isDirectory()) return []
  return git(repository, [
    'ls-files',
    '-co',
    '--exclude-standard',
    '-z',
    '--',
    `${relativeDirectory}/*.md`,
    `${relativeDirectory}/**/*.md`,
  ])
    .split('\0')
    .filter(Boolean)
}

function collectRulePaths(repository, files, explicitRules, planPath) {
  const candidates = new Set(DEFAULT_RULE_FILES)
  for (const path of walkMarkdownFiles(repository, '.github/PULL_REQUEST_TEMPLATE')) {
    candidates.add(path)
  }
  for (const file of files) {
    for (const changedPath of [file.oldPath, file.newPath]) {
      if (!changedPath) continue
      let directory = dirname(changedPath)
      while (directory !== '.' && directory !== sep) {
        candidates.add(join(directory, 'AGENTS.md').split(sep).join('/'))
        const parent = dirname(directory)
        if (parent === directory) break
        directory = parent
      }
    }
  }
  const resolved = []
  for (const input of [...candidates, ...explicitRules]) {
    if (!existsSync(isAbsolute(input) ? input : join(repository, input))) continue
    const rule = resolveRegularRepositoryFile(repository, input)
    if (rule.repositoryPath === planPath) {
      throw new Error(
        `selected planをBlind ruleとして使用できません: ${rule.repositoryPath}`,
      )
    }
    resolved.push(rule)
  }
  return [
    ...new Map(resolved.map((item) => [item.repositoryPath, item])).values(),
  ].sort((left, right) =>
    left.repositoryPath.localeCompare(right.repositoryPath),
  )
}

function sanitizedRepositoryIdentity(repository) {
  const remote = tryGit(repository, ['remote', 'get-url', 'origin'])
  if (!remote) return realpathSync(repository)
  try {
    const url = new URL(remote)
    url.username = ''
    url.password = ''
    return url.toString()
  } catch {
    return remote.replace(/^[^@/\s]+@/u, '')
  }
}

function slug(value) {
  const normalized = value
    .normalize('NFKD')
    .replace(/\.[^.]+$/u, '')
    .replace(/[^A-Za-z0-9._-]+/gu, '-')
    .replace(/^[._-]+|[._-]+$/gu, '')
    .slice(0, 48)
  return normalized || 'workspace'
}

export function requireReviewId(reviewId) {
  if (
    !REVIEW_ID_PATTERN.test(reviewId) ||
    reviewId === '.' ||
    reviewId === '..' ||
    reviewId.startsWith('.tmp-') ||
    reviewId.startsWith('.backup-') ||
    reviewId.startsWith('.lock-')
  ) {
    throw new Error(
      'review-idは英数字から始まる80文字以内の英数字・dot・underscore・hyphenにしてください。',
    )
  }
  return reviewId
}

function defaultReviewId(repositoryHash, baseRef, scope, planPath, branch) {
  const label = planPath ? basename(planPath, extname(planPath)) : branch
  const digest = sha256(
    [
      repositoryHash,
      baseRef,
      scope,
      planPath ?? 'no-plan',
      REVIEW_SCHEMA_SALT,
    ].join('\0'),
  ).slice(0, 12)
  return requireReviewId(`${slug(label)}-${digest}`)
}

function assertLimits(initialSnapshot, files) {
  const untrackedBytes = initialSnapshot.untracked.reduce(
    (total, file) => total + file.size,
    0,
  )
  const totalBytes = initialSnapshot.patch.length + untrackedBytes
  const hunks = files.flatMap((file) => file.hunks)
  const lines = hunks.reduce((total, hunk) => total + hunk.lines.length, 0)
  if (totalBytes > LIMITS.totalBytes) {
    throw new Error(
      `diff全体の上限${LIMITS.totalBytes} bytesを超えています: ${totalBytes} bytes`,
    )
  }
  if (lines > LIMITS.diffLines) {
    throw new Error(
      `diff行数の上限${LIMITS.diffLines}を超えています: ${lines}`,
    )
  }
  if (hunks.length > LIMITS.hunks) {
    throw new Error(`hunk数の上限${LIMITS.hunks}を超えています: ${hunks.length}`)
  }
}

export function collectDiff(options = {}) {
  const initialRepository = options.repository ?? process.cwd()
  const repository = realpathSync(
    git(initialRepository, ['rev-parse', '--show-toplevel']).trim(),
  )
  try {
    resolveCommit(repository, 'HEAD')
  } catch {
    throw new Error('unborn repositoryはreview対象外です。')
  }
  const headOid = resolveCommit(repository, 'HEAD')
  const branch =
    tryGit(repository, ['symbolic-ref', '--quiet', '--short', 'HEAD']) ??
    headOid.slice(0, 12)
  const base = resolveBase(repository, options.baseRef)
  let mergeBase
  try {
    mergeBase = git(repository, ['merge-base', base.oid, headOid]).trim()
  } catch {
    throw new Error(
      'baseとHEADのmerge-baseを解決できません。shallow cloneまたは履歴分断を確認してください。',
    )
  }
  if (!mergeBase) {
    throw new Error('baseとHEADのmerge-baseがありません。')
  }

  const firstStatus = statusSnapshot(repository)
  const planInput = resolvePlan(repository, firstStatus.entries, branch, options)
  const scope = options.scope ?? 'workspace'
  if (!['workspace', 'commits'].includes(scope)) {
    throw new Error(`scopeが不正です: ${scope}`)
  }

  const repositoryHash = sha256(sanitizedRepositoryIdentity(repository)).slice(0, 16)
  const reviewId = requireReviewId(
    options.reviewId ??
      defaultReviewId(repositoryHash, base.ref, scope, planInput.path, branch),
  )
  const collectedAt = new Date().toISOString()

  let initialSnapshot
  let files
  if (scope === 'workspace') {
    initialSnapshot = snapshot(repository, mergeBase, planInput.path, true)
    const tracked = collectTrackedFiles(
      repository,
      mergeBase,
      headOid,
      planInput.path,
      initialSnapshot.status.entries,
    )
    files = [
      ...tracked.files,
      ...collectUntrackedFiles(
        initialSnapshot.untracked,
        tracked.files.length + 1,
        tracked.nextHunkNumber,
      ),
    ]
    options.snapshotHook?.()
    const finalSnapshot = snapshot(repository, mergeBase, planInput.path, false)
    const currentPlanDigest =
      planInput.path === null
        ? null
        : sha256(readFileSync(join(repository, planInput.path)))
    const initialPlanDigest =
      planInput.content === null ? null : sha256(planInput.content)
    if (
      initialSnapshot.fingerprint !== finalSnapshot.fingerprint ||
      initialPlanDigest !== currentPlanDigest
    ) {
      throw new Error(
        'workspaceが収集中に変化しました。変更が止まってから再実行してください。',
      )
    }
  } else {
    const originalStatus = firstStatus
    initialSnapshot = {
      fingerprint: sha256(
        git(
          repository,
          [
            'diff',
            '--patch',
            '--find-renames',
            '--find-copies',
            '--no-ext-diff',
            '--no-textconv',
            '--no-color',
            '--unified=3',
            mergeBase,
            headOid,
            ...pathspec(planInput.path),
          ],
          { buffer: true },
        ),
      ),
      patch: git(
        repository,
        [
          'diff',
          '--patch',
          '--find-renames',
          '--find-copies',
          '--no-ext-diff',
          '--no-textconv',
          '--no-color',
          '--unified=3',
          mergeBase,
          headOid,
          ...pathspec(planInput.path),
        ],
        { buffer: true },
      ),
      status: originalStatus,
      untracked: [],
    }
    files = collectTrackedFiles(
      repository,
      mergeBase,
      headOid,
      planInput.path,
      [],
      headOid,
    ).files
    files = files.filter((file) => file.changeSources.includes('committed'))
  }

  assertLimits(initialSnapshot, files)
  const rules = collectRulePaths(
    repository,
    files,
    options.rulePaths ?? [],
    planInput.path,
  ).map((rule) => ({
    path: rule.repositoryPath,
    content: readFileSync(rule.absolutePath, 'utf8'),
  }))
  if (
    planInput.path !== null &&
    sha256(readFileSync(join(repository, planInput.path))) !==
      sha256(planInput.content)
  ) {
    throw new Error(
      'selected planが収集中に変化しました。変更が止まってから再実行してください。',
    )
  }

  const statusEntries =
    scope === 'commits'
      ? []
      : initialSnapshot.status.entries.filter(
          (entry) => !isExcludedPath(entry.path, planInput.path),
        )
  const counts = {
    committedFiles: files.filter((file) =>
      file.changeSources.includes('committed'),
    ).length,
    stagedFiles: files.filter((file) => file.changeSources.includes('staged'))
      .length,
    unstagedFiles: files.filter((file) =>
      file.changeSources.includes('unstaged'),
    ).length,
    untrackedFiles: statusEntries.filter((entry) =>
      entry.sources.includes('untracked'),
    ).length,
  }
  const hunks = files.flatMap((file) => file.hunks)
  const stats = {
    files: files.length,
    hunks: hunks.length,
    additions: files.reduce((total, file) => total + file.additions, 0),
    deletions: files.reduce((total, file) => total + file.deletions, 0),
    ...counts,
  }

  const [behindText, aheadText] = git(repository, [
    'rev-list',
    '--left-right',
    '--count',
    `${base.oid}...${headOid}`,
  ])
    .trim()
    .split(/\s+/u)

  const blindInput = {
    schemaVersion: 2,
    reviewId,
    repositoryRoot: repository,
    repositoryHash,
    snapshot: {
      scope,
      collectedAt,
      workspaceFingerprint: initialSnapshot.fingerprint,
    },
    git: {
      baseRef: base.ref,
      baseOid: base.oid,
      headOid,
      mergeBase,
      branch,
      ahead: Number(aheadText),
      behind: Number(behindText),
      commits: collectCommits(repository, mergeBase, headOid),
    },
    stats,
    files,
    rules,
  }

  const outputDirectory = options.outputDirectory
    ? resolve(options.outputDirectory)
    : mkdtempSync(join(tmpdir(), 'explained-code-review-'))
  mkdirSync(outputDirectory, { recursive: true })
  const blindInputPath = join(outputDirectory, 'blind-input.json')
  const planInputPath = join(outputDirectory, 'plan-input.json')
  writeFileSync(blindInputPath, `${JSON.stringify(blindInput, null, 2)}\n`)
  writeFileSync(planInputPath, `${JSON.stringify(planInput, null, 2)}\n`)

  const ignored = tryGit(repository, [
    'check-ignore',
    '--quiet',
    '--',
    '.review/example',
  ])
  return {
    reviewId,
    repositoryRoot: repository,
    blindInputPath,
    planInputPath,
    planResolution: planInput.resolution,
    planPath: planInput.path,
    baseRef: base.ref,
    scope,
    workspaceFingerprint: initialSnapshot.fingerprint,
    fileCount: stats.files,
    hunkCount: stats.hunks,
    warnings:
      ignored === null
        ? ['.review/がGit ignoreされていません。導入時にignoreへ追加してください。']
        : [],
  }
}

function parseArguments(argv) {
  const options = { rulePaths: [] }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--no-plan') {
      options.noPlan = true
      continue
    }
    const value = argv[index + 1]
    if (!value) throw new Error(`値が必要です: ${argument}`)
    if (argument === '--base') options.baseRef = value
    else if (argument === '--output') options.outputDirectory = value
    else if (argument === '--plan') options.planPath = value
    else if (argument === '--repository') options.repository = value
    else if (argument === '--review-id') options.reviewId = value
    else if (argument === '--scope') options.scope = value
    else if (argument === '--rule') options.rulePaths.push(value)
    else throw new Error(`不明な引数です: ${argument}`)
    index += 1
  }
  return options
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
    const result = collectDiff(parseArguments(process.argv.slice(2)))
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`差分収集に失敗しました: ${message}\n`)
    process.exitCode = 1
  }
}
