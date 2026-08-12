import { test } from '@playwright/test'

import { captureStory } from './capture-story'

type VrtCase = {
  height: number
  name: string
  storyId: string
  width: number
}

const cases: VrtCase[] = [
  ...['default', 'out-of-stock', 'long-name'].flatMap((story) =>
    [375, 1440].map((width) => ({
      height: width === 375 ? 812 : 1000,
      name: `VRT-001-product-card-${story}-${width}`,
      storyId: `features-products-productcard--${story}`,
      width,
    })),
  ),
  ...[
    'default',
    'empty',
    'category-selected',
    'category-empty',
    'loading',
    'error',
  ].flatMap((story) =>
    [375, 768, 1440].map((width) => ({
      height: width === 375 ? 812 : width === 768 ? 1024 : 1000,
      name: `VRT-002-product-list-${story}-${width}`,
      storyId: `features-products-productlist--${story}`,
      width,
    })),
  ),
  ...['default', 'out-of-stock', 'long-content'].flatMap((story) =>
    [375, 1440].map((width) => ({
      height: width === 375 ? 812 : 1000,
      name: `VRT-003-product-detail-${story}-${width}`,
      storyId: `features-products-productdetail--${story}`,
      width,
    })),
  ),
]

for (const vrtCase of cases) {
  test(vrtCase.name, async ({ page }) => {
    await captureStory(page, vrtCase)
  })
}
