import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const fixtureDirectory = mkdtempSync(path.join(root, 'src/lint-parity-'))
const oxlint = path.join(root, 'node_modules/.bin/oxlint')
const eslint = path.join(root, 'node_modules/.bin/eslint')

const cases = [
  {
    name: 'Next.js',
    file: 'next.tsx',
    source: `'use client'\nexport default async function Page() { return null }\n`,
    rule: 'next(no-async-client-component)',
  },
  {
    name: 'React',
    file: 'react.tsx',
    source: `import { useState } from 'react'\nfunction helper() { useState(0) }\nhelper()\n`,
    rule: 'react-hooks(rules-of-hooks)',
  },
  {
    name: 'Storybook',
    file: 'component.stories.tsx',
    source: `import { storiesOf } from '@storybook/react'\nstoriesOf('Fixture', module)\n`,
    rule: 'storybook/no-renderer-packages',
    executable: eslint,
  },
  {
    name: 'TypeScript type-aware',
    file: 'promise.ts',
    source: `async function run() {}\nrun()\n`,
    rule: 'typescript(no-floating-promises)',
  },
]

try {
  for (const fixture of cases) {
    const fixturePath = path.join(fixtureDirectory, fixture.file)
    writeFileSync(fixturePath, fixture.source)
    const executable = fixture.executable ?? oxlint
    const arguments_ = executable === oxlint ? ['--deny-warnings', fixturePath] : [fixturePath]
    const result = spawnSync(executable, arguments_, {
      cwd: root,
      encoding: 'utf8',
    })
    const output = `${result.stdout}${result.stderr}`
    if (result.status === 0 || !output.includes(fixture.rule)) {
      throw new Error(`${fixture.name} rule was not detected:\n${output}`)
    }
  }
  console.log(`Verified ${cases.length} lint responsibilities.`)
} finally {
  rmSync(fixtureDirectory, { force: true, recursive: true })
}
