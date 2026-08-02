import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'
import storybook from 'eslint-plugin-storybook'

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  ...storybook.configs['flat/recommended'],
  globalIgnores([
    '.next/**',
    '.next-e2e/**',
    'storybook-static/**',
    'playwright-report/**',
    'test-results/**',
    '.review/**',
    '.agents/**/scripts/batch-output-validator.mjs',
    '.agents/**/scripts/report-validator.mjs',
    '.agents/**/scripts/syntax-highlighter.bundle.mjs',
    'next-env.d.ts',
  ]),
])
