import { test } from '@playwright/test'

import { captureStory } from './capture-story'

for (const story of ['default', 'empty', 'loading', 'updating', 'stock-conflict']) {
  for (const width of [375, 1440]) {
    test(`VRT-004-cart-${story}-${width}`, async ({ page }) => {
      await captureStory(page, {
        height: width === 375 ? 812 : 1000,
        name: `VRT-004-cart-${story}-${width}`,
        storyId: `features-cart-cart--${story}`,
        width,
      })
    })
  }
}
