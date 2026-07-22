import { expect, test } from '@playwright/test'

test('共通レイアウトをキーボードで利用でき、横方向に崩れない', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle('MockShop')
  await expect(page.getByRole('heading', { level: 1, name: 'テスト境界を、わかりやすく。' })).toBeVisible()

  const hasHorizontalOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth
  })
  expect(hasHorizontalOverflow).toBe(false)

  await page.keyboard.press('Tab')
  const skipLink = page.getByRole('link', { name: 'メインコンテンツへ移動' })
  await expect(skipLink).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('#main-content')).toBeFocused()
})
