import { expect, test } from '@playwright/test'

for (const story of ['default', 'empty', 'updating', 'stock-conflict']) {
  for (const width of [375, 1440]) {
    test(`VRT-004-cart-${story}-${width}`, async ({ page }) => {
      await page.setViewportSize({
        height: width === 375 ? 812 : 1000,
        width,
      })
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto(
        `/iframe.html?id=features-cart-cart--${story}&viewMode=story`,
      )
      await expect(page.locator('#storybook-root')).toBeVisible()
      await page.evaluate(async () => {
        await document.fonts.ready
        await Promise.all(
          [...document.images].map((image) => {
            if (image.complete) return Promise.resolve()
            return new Promise<void>((resolve) => {
              image.addEventListener('load', () => resolve(), {
                once: true,
              })
              image.addEventListener('error', () => resolve(), {
                once: true,
              })
            })
          }),
        )
      })
      await expect(page).toHaveScreenshot(
        `VRT-004-cart-${story}-${width}.png`,
        {
          animations: 'disabled',
          caret: 'hide',
          fullPage: true,
        },
      )
    })
  }
}
