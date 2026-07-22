import { expect, test } from '@playwright/test'

test('共通レイアウトをキーボードで利用でき、横方向に崩れない', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle('MockShop')
  await expect(page.getByRole('heading', { level: 1, name: 'Made for quieter days.' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'New essentials' })).toBeVisible()

  const hasHorizontalOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth
  })
  expect(hasHorizontalOverflow).toBe(false)

  const images = page.locator('img')
  const imageCount = await images.count()
  expect(imageCount).toBe(8)
  for (let index = 0; index < imageCount; index += 1) {
    const image = images.nth(index)
    await image.scrollIntoViewIfNeeded()
    await expect
      .poll(() =>
        image.evaluate(
          (element) =>
            element instanceof HTMLImageElement && element.complete && element.naturalWidth > 0,
        ),
      )
      .toBe(true)
    const source = await image.getAttribute('src')
    expect(source).not.toBeNull()
    const imageUrl = new URL(source ?? '', page.url())
    const assetPath =
      imageUrl.pathname === '/_next/image' ? imageUrl.searchParams.get('url') : imageUrl.pathname
    expect(assetPath).toMatch(/^\/images\/home\/[a-z-]+\.jpg$/u)
  }

  await page.keyboard.press('Tab')
  const skipLink = page.getByRole('link', { name: 'メインコンテンツへ移動' })
  await expect(skipLink).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('#main-content')).toBeFocused()
})
