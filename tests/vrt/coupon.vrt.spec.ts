import { test } from '@playwright/test'

import { captureStory } from './capture-story'

for (const story of ['before-apply', 'applied', 'input-error', 'expired']) {
  for (const width of [375, 1440]) {
    test(`VRT-005-coupon-${story}-${width}`, async ({ page }) => {
      await captureStory(page, {
        height: width === 375 ? 812 : 1000,
        name: `VRT-005-coupon-${story}-${width}`,
        storyId: `features-coupons-couponform--${story}`,
        width,
      })
    })
  }
}
