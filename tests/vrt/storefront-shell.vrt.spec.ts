import { test } from '@playwright/test'

import { captureStory } from './capture-story'

for (const width of [375, 768, 1440]) {
  test(`VRT-009-storefront-shell-anonymous-${width}`, async ({ page }) => {
    await captureStory(page, {
      height: width === 375 ? 812 : width === 768 ? 1024 : 1000,
      loadAllImages: true,
      name: `VRT-009-storefront-shell-anonymous-${width}`,
      storyId: 'layout-storefrontshell--anonymous',
      width,
    })
  })
}
