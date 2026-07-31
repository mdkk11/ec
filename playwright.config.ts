import { defineConfig, devices } from '@playwright/test'

import {
  loadDatabaseEnvironment,
  requireDatabaseEnvironment,
} from './src/server/db/environment'

loadDatabaseEnvironment()
const e2eDatabaseUrl = requireDatabaseEnvironment('E2E_DATABASE_URL')
const e2eBaseUrl = 'http://localhost:3105'

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
    {
      name: 'chromium-products',
      testMatch: 'product-browsing.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium-cart',
      testMatch: 'cart.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium-purchase',
      testMatch: 'purchase.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox-purchase',
      testMatch: 'purchase.spec.ts',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit-purchase',
      testMatch: 'purchase.spec.ts',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chromium-purchase',
      testMatch: 'mobile-purchase.spec.ts',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'chromium-stock-conflict',
      testMatch: 'stock-conflict.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command:
      'corepack pnpm build && corepack pnpm start --hostname 127.0.0.1 --port 3105',
    env: {
      DATABASE_URL: e2eDatabaseUrl,
      E2E_DATABASE_URL: e2eDatabaseUrl,
      E2E_HTTP_SERVER: 'true',
      NEXT_DIST_DIR: '.next-e2e',
      NODE_ENV: 'production',
    },
    url: e2eBaseUrl,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
