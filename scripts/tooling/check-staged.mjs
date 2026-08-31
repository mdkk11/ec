import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const scriptRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const root = path.resolve(process.env.CHECK_STAGED_ROOT ?? scriptRoot)
const extension = /\.(?:[cm]?[jt]sx?|jsonc?|ya?ml|css)$/u
const lintExtension = /\.[cm]?[jt]sx?$/u

function git(args, options = {}) {
  const result = spawnSync('git', args, { cwd: root, ...options })
  if (result.status !== 0) process.exit(result.status ?? 1)
  return result
}

const changed = git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], {
  encoding: 'buffer',
}).stdout
const files = changed
  .toString('utf8')
  .split('\0')
  .filter((file) => file && extension.test(file))

if (files.length === 0) process.exit(0)

const snapshot = mkdtempSync(path.join(tmpdir(), 'ec-staged-'))

try {
  git(['checkout-index', '--all', `--prefix=${snapshot}${path.sep}`])
  symlinkSync(path.join(root, 'node_modules'), path.join(snapshot, 'node_modules'), 'dir')

  const checks = [
    {
      binary: 'oxfmt',
      args: ['--check', ...files],
    },
    {
      binary: 'oxlint',
      args: ['--deny-warnings', ...files.filter((file) => lintExtension.test(file))],
    },
  ]

  for (const check of checks) {
    if (check.args.length === 1) continue
    const binary = path.join(root, 'node_modules/.bin', check.binary)
    const result = spawnSync(binary, check.args, { cwd: snapshot, stdio: 'inherit' })
    if (result.status !== 0) process.exitCode = result.status ?? 1
  }
} finally {
  rmSync(snapshot, { force: true, recursive: true })
}
