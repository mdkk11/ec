import { test } from '@playwright/test'

import { captureStory } from './capture-story'

for (const story of ['default', 'empty', 'loading', 'error']) {
  for (const width of [375, 1440]) {
    test(`VRT-006-order-history-${story}-${width}`, async ({ page }) => {
      await captureStory(page, {
        height: width === 375 ? 812 : 1000,
        name: `VRT-006-order-history-${story}-${width}`,
        storyId: `features-orders-orderhistory--${story}`,
        width,
      })
    })
  }
}
