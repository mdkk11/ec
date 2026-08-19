import { expect, test, type Page } from '@playwright/test'

async function expectHeaderControlsNotToOverlap(page: Page) {
  const overlaps = await page.getByRole('banner').evaluate((header) => {
    const controls = [...header.querySelectorAll('a, button')].filter((element) => {
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
    })

    return controls.flatMap((control, index) => {
      const first = control.getBoundingClientRect()
      return controls.slice(index + 1).flatMap((otherControl) => {
        const second = otherControl.getBoundingClientRect()
        const overlaps = !(
          first.right <= second.left ||
          second.right <= first.left ||
          first.bottom <= second.top ||
          second.bottom <= first.top
        )
        return overlaps
          ? [`${control.textContent?.trim()} / ${otherControl.textContent?.trim()}`]
          : []
      })
    })
  })
  expect(overlaps).toEqual([])
}

test('共通レイアウトをキーボードで利用でき、横方向に崩れない', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle('Made for quieter days. | MockShop')
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    '軽やかな素材と落ち着いた色を、春から夏の日常へ。',
  )
  await expect(page.getByRole('heading', { level: 1, name: 'Made for quieter days.' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'New essentials' })).toBeVisible()
  const header = page.getByRole('banner')
  await expect(header.getByRole('link', { name: 'ALL ITEMS' })).toHaveAttribute(
    'href',
    '/products',
  )
  await expect(header.getByRole('link', { name: 'ログイン' })).toHaveAttribute(
    'href',
    '/login',
  )
  await expect(
    header.getByRole('link', { name: /SEASONAL EDIT/u }),
  ).toHaveCount(0)
  await expect(
    header.getByRole('link', { name: /POINT OF VIEW/u }),
  ).toHaveCount(0)
  await expectHeaderControlsNotToOverlap(page)

  const hasHorizontalOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth
  })
  expect(hasHorizontalOverflow).toBe(false)

  const images = page.locator('img')
  const imageCount = await images.count()
  expect(imageCount).toBe(12)
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
    expect(imageUrl.origin).toBe(new URL(page.url()).origin)
    const assetPath =
      imageUrl.pathname === '/_next/image' ? imageUrl.searchParams.get('url') : imageUrl.pathname
    expect(assetPath).toMatch(/^\/images\/home\/[a-z-]+\.jpg$/u)
  }

  await page.keyboard.press('Tab')
  const skipLink = page.getByRole('link', { name: 'メインコンテンツへ移動' })
  await expect(skipLink).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('#main-content')).toBeFocused()

  if (test.info().project.name === 'chromium-375') {
    await page.goto('/login')
    await page.getByLabel('メールアドレス').fill('customer@example.test')
    await page.getByLabel('パスワード').fill('CustomerPass123!')
    await page.getByRole('button', { name: 'ログイン' }).click()
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('link', { name: 'カート' })).toHaveAttribute(
      'href',
      '/cart',
    )
    const customerMenu = page.getByRole('button', { name: 'マイページ' })
    await customerMenu.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByText('customer@example.test')).toBeVisible()
    await expect(page.getByRole('link', { name: '注文履歴' })).toHaveAttribute(
      'href',
      '/orders',
    )
    await expectHeaderControlsNotToOverlap(page)

    await page.getByRole('button', { name: 'ログアウト' }).click()
    await expect(page.getByRole('link', { name: 'ログイン' })).toBeVisible()
    await page.goto('/login')
    await page.getByLabel('メールアドレス').fill('admin@example.test')
    await page.getByLabel('パスワード').fill('AdminPass123!')
    await page.getByRole('button', { name: 'ログイン' }).click()
    await expect(page).toHaveURL('/')
    await page.getByRole('button', { name: 'マイページ' }).click()
    await expect(page.getByText('admin@example.test')).toBeVisible()
    await expect(page.getByRole('link', { name: '商品管理' })).toHaveAttribute(
      'href',
      '/admin/products',
    )
    await expect(page.getByRole('link', { name: '注文履歴' })).toHaveAttribute(
      'href',
      '/admin/orders',
    )
    await expect(page.getByRole('link', { name: 'カート' })).toHaveCount(0)
    await expectHeaderControlsNotToOverlap(page)
  }
})
