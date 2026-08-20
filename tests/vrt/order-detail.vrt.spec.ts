import { test } from '@playwright/test'

import { captureStory } from './capture-story'

for (const width of [375, 1440]) {
  test(`VRT-011-order-detail-loading-${width}`, async ({ page }) => {
    await captureStory(page, {
      height: width === 375 ? 812 : 1000,
      name: `VRT-011-order-detail-loading-${width}`,
      storyId: 'features-orders-orderdetailloading--default',
      width,
    })
  })
}
