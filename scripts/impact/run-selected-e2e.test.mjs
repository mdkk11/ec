import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { buildE2eCommand } from './run-selected-e2e.mjs'

test('selected mode invokes Playwright once with every selected spec', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'e2e-selection-'))
  const selectionPath = path.join(directory, 'selection.json')
  writeFileSync(
    selectionPath,
    JSON.stringify({
      mode: 'selected',
      selectedSpecs: ['tests/e2e/cart.spec.ts', 'tests/e2e/app-shell.spec.ts'],
    }),
  )
  assert.deepEqual(
    buildE2eCommand({
      IMPACT_E2E_MODE: 'selected',
      IMPACT_E2E_SELECTION: selectionPath,
    }),
    [
      'pnpm',
      ['exec', 'playwright', 'test', 'tests/e2e/cart.spec.ts', 'tests/e2e/app-shell.spec.ts'],
    ],
  )
  assert.deepEqual(buildE2eCommand({ IMPACT_E2E_SELECTION: selectionPath }), [
    'pnpm',
    ['exec', 'playwright', 'test', 'tests/e2e/cart.spec.ts', 'tests/e2e/app-shell.spec.ts'],
  ])
})

test('missing or invalid selection falls back to the existing full command', () => {
  assert.deepEqual(buildE2eCommand({ IMPACT_E2E_SELECTION: '/missing/selection.json' }), [
    'pnpm',
    ['test:e2e'],
  ])
  assert.deepEqual(
    buildE2eCommand({
      IMPACT_E2E_MODE: 'selected',
      IMPACT_E2E_SELECTION: '/missing/selection.json',
    }),
    ['pnpm', ['test:e2e']],
  )
})
