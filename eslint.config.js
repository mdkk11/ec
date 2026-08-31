import parser from '@typescript-eslint/parser'
import storybook from 'eslint-plugin-storybook'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    languageOptions: { parser },
  },
  ...storybook.configs['flat/recommended'],
  globalIgnores([
    '.next/**',
    '.next-e2e/**',
    'storybook-static/**',
    'playwright-report/**',
    'test-results/**',
    '.review/**',
    'next-env.d.ts',
  ]),
])
