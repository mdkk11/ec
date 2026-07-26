import { expect, test } from '@playwright/test'

for (const story of ['before-apply', 'applied', 'input-error', 'expired']) {
  for (const width of [375, 1440]) {
    test(`VRT-005-coupon-${story}-${width}`, async ({ page }) => {
      await page.setViewportSize({
        height: width === 375 ? 812 : 1000,
        width,
      })
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto(
        `/iframe.html?id=features-coupons-couponform--${story}&viewMode=story`,
      )
      await expect(page.locator('#storybook-root')).toBeVisible()
      await page.evaluate(async () => {
        await document.fonts.ready
      })
      await expect(page).toHaveScreenshot(
        `VRT-005-coupon-${story}-${width}.png`,
        {
          animations: 'disabled',
          caret: 'hide',
          fullPage: true,
        },
      )
    })
  }
}
