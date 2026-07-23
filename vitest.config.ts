import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

const srcDirectory = fileURLToPath(new URL('./src', import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@': srcDirectory,
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.unit.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'frontend',
          environment: 'jsdom',
          environmentOptions: {
            jsdom: {
              url: 'http://localhost:3000',
            },
          },
          include: ['src/**/*.frontend.test.{ts,tsx}'],
          setupFiles: ['./src/test/setup-frontend.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'backend',
          environment: 'node',
          include: ['tests/backend/**/*.backend.test.ts'],
          setupFiles: ['./src/test/setup-backend.ts'],
          fileParallelism: false,
          maxWorkers: 1,
          retry: 0,
        },
      },
    ],
  },
})
