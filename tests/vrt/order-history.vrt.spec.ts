import { expect, test } from '@playwright/test'

for (const story of ['default', 'empty', 'loading', 'error']) {
  for (const width of [375, 1440]) {
    test(`VRT-006-order-history-${story}-${width}`, async ({ page }) => {
      await page.setViewportSize({
        height: width === 375 ? 812 : 1000,
        width,
      })
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto(
        `/iframe.html?id=features-orders-orderhistory--${story}&viewMode=story`,
      )
      await expect(page.locator('#storybook-root')).toBeVisible()
      await page.evaluate(async () => {
        await document.fonts.ready
      })
      await expect(page).toHaveScreenshot(
        `VRT-006-order-history-${story}-${width}.png`,
        {
          animations: 'disabled',
          caret: 'hide',
          fullPage: true,
        },
      )
    })
  }
}
