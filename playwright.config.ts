import { defineConfig, devices } from '@playwright/test'

import {
  loadDatabaseEnvironment,
  requireDatabaseEnvironment,
} from './src/server/db/environment'

loadDatabaseEnvironment()
const e2eDatabaseUrl = requireDatabaseEnvironment('E2E_DATABASE_URL')
const e2eBaseUrl = 'http://127.0.0.1:3105'

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: e2eBaseUrl,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-375',
      testMatch: 'app-shell.spec.ts',
      use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 } },
    },
    {
      name: 'chromium-768',
      testMatch: 'app-shell.spec.ts',
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } },
    },
    {
      name: 'chromium-1440',
      testMatch: 'app-shell.spec.ts',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } },
    },
    {
      name: 'chromium-auth',
      testMatch: 'authentication.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'corepack pnpm dev --hostname 127.0.0.1 --port 3105',
    env: {
      DATABASE_URL: e2eDatabaseUrl,
      NEXT_DIST_DIR: '.next-e2e',
      NODE_ENV: 'development',
    },
    url: e2eBaseUrl,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
