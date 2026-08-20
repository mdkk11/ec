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

for (const story of ['default', 'empty']) {
  for (const width of [375, 1440]) {
    test(`VRT-010-admin-product-list-${story}-${width}`, async ({ page }) => {
      await captureStory(page, {
        height: width === 375 ? 812 : 1000,
        name: `VRT-010-admin-product-list-${story}-${width}`,
        storyId: `features-admin-adminproductlist--${story}`,
        width,
      })
    })
  }
}

for (const { story, widths } of [
  { story: 'list', widths: [375, 1440] },
  { story: 'edit', widths: [768, 1440] },
]) {
  for (const width of widths) {
    test(`VRT-012-admin-product-${story}-loading-${width}`, async ({ page }) => {
      await captureStory(page, {
        height: width === 375 ? 812 : width === 768 ? 1024 : 1000,
        name: `VRT-012-admin-product-${story}-loading-${width}`,
        storyId: `features-admin-adminproductloading--${story}`,
        width,
      })
    })
  }
}
