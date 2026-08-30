import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

export function buildE2eCommand(env = process.env) {
  if (env.IMPACT_E2E_MODE && env.IMPACT_E2E_MODE !== 'selected') {
    return ['pnpm', ['test:e2e']]
  }
  try {
    const selection = JSON.parse(
      readFileSync(env.IMPACT_E2E_SELECTION ?? '.impact/e2e-selection.json', 'utf8'),
    )
    if (
      selection.mode !== 'selected' ||
      !Array.isArray(selection.selectedSpecs) ||
      selection.selectedSpecs.length === 0 ||
      selection.selectedSpecs.some(
        (spec) =>
          typeof spec !== 'string' ||
          !spec.startsWith('tests/e2e/') ||
          !spec.endsWith('.spec.ts') ||
          spec.includes('..'),
      )
    ) {
      return ['pnpm', ['test:e2e']]
    }
    return ['pnpm', ['exec', 'playwright', 'test', ...selection.selectedSpecs]]
  } catch {
    return ['pnpm', ['test:e2e']]
  }
}

export function runCli(env = process.env) {
  const [command, args] = buildE2eCommand(env)
  const result = spawnSync(command, args, {
    env,
    stdio: 'inherit',
  })
  return result.status ?? 1
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
if (isMain) process.exitCode = runCli()
