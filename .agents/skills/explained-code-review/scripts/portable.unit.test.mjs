import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const skillDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function run(command, args, cwd) {
  return execFileSync(command, args, { cwd, encoding: 'utf8' }).trim()
}

test('project-local版とglobal版をnode_modulesなしで同じreportへ生成できる', () => {
  const root = mkdtempSync(join(tmpdir(), 'explained-review-forward-'))
  const repository = join(root, 'repository')
  const localSkill = join(
    root,
    'project',
    '.agents',
    'skills',
    'explained-code-review',
  )
  const globalSkill = join(
    root,
    'home',
    '.codex',
    'skills',
    'explained-code-review',
  )
  mkdirSync(repository, { recursive: true })
  run('git', ['init', '-b', 'main'], repository)
  run('git', ['config', 'user.email', 'review@example.test'], repository)
  run('git', ['config', 'user.name', 'Review Test'], repository)
  writeFileSync(join(repository, 'README.md'), 'fixture\n')
  run('git', ['add', 'README.md'], repository)
  run('git', ['commit', '-m', 'fixture'], repository)

  for (const target of [localSkill, globalSkill]) {
    mkdirSync(dirname(target), { recursive: true })
    cpSync(skillDirectory, target, {
      recursive: true,
      filter: (source) => !source.includes(`${skillDirectory}/node_modules`),
    })
    assert.equal(existsSync(join(target, 'node_modules')), false)
  }

  const inputs = join(root, 'inputs')
  const collected = JSON.parse(
    run(
      process.execPath,
      [
        join(localSkill, 'scripts/collect-diff.mjs'),
        '--repository',
        repository,
        '--base',
        'HEAD',
        '--no-plan',
        '--review-id',
        'portable-review',
        '--output',
        inputs,
      ],
      repository,
    ),
  )
  const stageOnePath = join(inputs, 'stage1.json')
  const analysisPath = join(inputs, 'analysis.json')
  writeFileSync(
    stageOnePath,
    JSON.stringify({ schemaVersion: 2, summary: '空差分', groups: [] }),
  )
  writeFileSync(
    analysisPath,
    JSON.stringify({
      schemaVersion: 2,
      overview: '変更はありません。',
      blindSummary: '空差分',
      planReview: {
        status: 'skipped-no-plan',
        planPath: null,
        summary: '',
      },
      groups: [],
    }),
  )
  const argumentsForGenerator = [
    '--blind-input',
    collected.blindInputPath,
    '--plan-input',
    collected.planInputPath,
    '--stage1',
    stageOnePath,
    '--analysis',
    analysisPath,
  ]

  run(
    process.execPath,
    [join(localSkill, 'scripts/generate-report.mjs'), ...argumentsForGenerator],
    repository,
  )
  const first = readFileSync(
    join(repository, '.review/portable-review/report.json'),
    'utf8',
  )
  rmSync(join(repository, '.review'), { recursive: true })
  run(
    process.execPath,
    [join(globalSkill, 'scripts/generate-report.mjs'), ...argumentsForGenerator],
    repository,
  )
  const second = readFileSync(
    join(repository, '.review/portable-review/report.json'),
    'utf8',
  )
  assert.equal(second, first)
})
