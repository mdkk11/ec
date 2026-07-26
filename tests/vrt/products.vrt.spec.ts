import { expect, test } from '@playwright/test'

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
  ...['default', 'empty', 'loading', 'error'].flatMap((story) =>
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
    await page.setViewportSize({
      height: vrtCase.height,
      width: vrtCase.width,
    })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(`/iframe.html?id=${vrtCase.storyId}&viewMode=story`)
    await expect(page.locator('#storybook-root')).toBeVisible()
    await page.evaluate(async () => {
      await document.fonts.ready
      await Promise.all(
        [...document.images].map((image) => {
          if (image.complete) return Promise.resolve()
          return new Promise<void>((resolve) => {
            image.addEventListener('load', () => resolve(), { once: true })
            image.addEventListener('error', () => resolve(), { once: true })
          })
        }),
      )
    })

    await expect(page).toHaveScreenshot(`${vrtCase.name}.png`, {
      animations: 'disabled',
      caret: 'hide',
      fullPage: true,
    })
  })
}
