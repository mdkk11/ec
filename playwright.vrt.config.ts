import { defineConfig, devices } from '@playwright/test'

const storybookUrl = 'http://127.0.0.1:6006'

export default defineConfig({
  expect: {
    toHaveScreenshot: {
      maxDiffPixels: 0,
      threshold: 0.2,
    },
  },
  fullyParallel: false,
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
  reporter: [['list'], ['html', { open: 'never' }]],
  retries: 0,
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}-{projectName}{ext}',
  testDir: './tests/vrt',
  use: {
    baseURL: storybookUrl,
    colorScheme: 'light',
    locale: 'ja-JP',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm storybook:serve',
    reuseExistingServer: false,
    timeout: 120_000,
    url: storybookUrl,
  },
  workers: 1,
})
