import { test } from '@playwright/test'

import { captureStory } from './capture-story'

for (const story of ['default', 'input-error', 'updating', 'conflict']) {
  for (const width of [768, 1440]) {
    test(`VRT-007-admin-product-form-${story}-${width}`, async ({ page }) => {
      await captureStory(page, {
        height: width === 768 ? 1024 : 1000,
        name: `VRT-007-admin-product-form-${story}-${width}`,
        storyId: `features-admin-adminproductform--${story}`,
        width,
      })
    })
  }
}
