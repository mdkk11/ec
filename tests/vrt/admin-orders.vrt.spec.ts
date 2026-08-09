import { expect, test } from '@playwright/test'

for (const story of ['default', 'empty', 'updating', 'conflict']) {
  for (const width of [768, 1440]) {
    test(`VRT-008-admin-order-table-${story}-${width}`, async ({ page }) => {
      await page.setViewportSize({
        height: width === 768 ? 1024 : 1000,
        width,
      })
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto(
        `/iframe.html?id=features-admin-adminordertable--${story}&viewMode=story`,
      )
      await expect(page.locator('#storybook-root')).toBeVisible()
      await page.evaluate(async () => {
        await document.fonts.ready
      })
      await expect(page).toHaveScreenshot(
        `VRT-008-admin-order-table-${story}-${width}.png`,
        { animations: 'disabled', caret: 'hide', fullPage: true },
      )
    })
  }
}
