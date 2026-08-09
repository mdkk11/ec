import { test } from '@playwright/test'

import { captureStory } from './capture-story'

for (const story of ['default', 'empty', 'updating', 'conflict']) {
  for (const width of [768, 1440]) {
    test(`VRT-008-admin-order-table-${story}-${width}`, async ({ page }) => {
      await captureStory(page, {
        height: width === 768 ? 1024 : 1000,
        name: `VRT-008-admin-order-table-${story}-${width}`,
        storyId: `features-admin-adminordertable--${story}`,
        width,
      })
    })
  }
}
