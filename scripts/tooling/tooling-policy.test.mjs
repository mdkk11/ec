import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
const workspace = readFileSync('pnpm-workspace.yaml', 'utf8')
const lockfile = readFileSync('pnpm-lock.yaml', 'utf8')

test('toolchain versions have one exact source of truth', () => {
  assert.equal(packageJson.packageManager, 'pnpm@11.23.0')
  assert.deepEqual(packageJson.devEngines.runtime, {
    name: 'node',
    version: '24.19.0',
    onFail: 'download',
  })
  assert.equal(packageJson.engines.node, '>=24 <25')
  assert.equal(packageJson.engines.pnpm, '>=11 <12')
})

test('pnpm dependency policies stay enabled', () => {
  assert.match(workspace, /^saveExact: true$/mu)
  assert.match(workspace, /^minimumReleaseAge: 10080$/mu)
  assert.match(workspace, /^minimumReleaseAgeExcludePrune: true$/mu)
  assert.match(workspace, /^  esbuild: true$/mu)
  assert.match(workspace, /^  msw: false$/mu)
  assert.match(workspace, /^  unrs-resolver: true$/mu)
  assert.doesNotMatch(workspace, /dangerouslyAllowAllBuilds/u)
})

test('the lockfile contains the exact Node runtime and platform checksums', () => {
  assert.match(lockfile, /specifier: runtime:24\.19\.0/u)
  assert.match(lockfile, /node@runtime:24\.19\.0:/u)
  assert.match(
    lockfile,
    /https:\/\/nodejs\.org\/download\/release\/v24\.19\.0\/node-v24\.19\.0-/u,
  )
  assert.match(lockfile, /integrity: sha256-[A-Za-z0-9+/=]+/u)
})
