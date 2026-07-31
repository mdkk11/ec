import { expect, test } from '@playwright/test'

test('E2E-007/PRODUCT-001/010/011: Server Componentの商品一覧から詳細へ移動する', async ({
  page,
}) => {
  let browserProductApiRequests = 0
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/products')) {
      browserProductApiRequests += 1
    }
  })

  await page.goto('/products')

  await expect(
    page.getByRole('heading', { level: 1, name: '商品一覧' }),
  ).toBeVisible()
  await expect(page.getByText('9点')).toBeVisible()

  const firstProductLink = page
    .getByRole('article')
    .first()
    .getByRole('link')
  await expect(firstProductLink).toHaveAccessibleName(
    'リネンブレンド オーバーシャツの詳細を見る',
  )
  await expect(firstProductLink).toHaveAttribute(
    'href',
    '/products/30000000-0000-4000-8000-000000000001',
  )

  for (let index = 0; index < 20; index += 1) {
    if (await firstProductLink.evaluate((link) => link === document.activeElement)) {
      break
    }
    await page.keyboard.press('Tab')
  }
  await expect(firstProductLink).toBeFocused()
  await page.keyboard.press('Enter')

  await expect(page).toHaveURL(
    '/products/30000000-0000-4000-8000-000000000001',
  )
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'リネンブレンド オーバーシャツ',
    }),
  ).toBeVisible()
  await expect(page.getByText('¥28,600')).toBeVisible()
  await expect(page.getByText('在庫あり')).toBeVisible()
  await expect(
    page.getByRole('img', { name: 'リネンブレンド オーバーシャツ' }),
  ).toBeVisible()

  const backLink = page.getByRole('link', { name: '商品一覧へ戻る' })
  for (let index = 0; index < 20; index += 1) {
    if (await backLink.evaluate((link) => link === document.activeElement)) {
      break
    }
    await page.keyboard.press('Tab')
  }
  await expect(backLink).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL('/products')
  expect(browserProductApiRequests).toBe(0)
})

test('E2E-007/PRODUCT-006/007: 不正IDと非公開商品を画面上の404にする', async ({
  page,
}) => {
  let browserProductApiRequests = 0
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/products')) {
      browserProductApiRequests += 1
    }
  })

  for (const productPath of [
    '/products/not-a-uuid',
    '/products/30000000-0000-4000-8000-000000000005',
  ]) {
    await page.goto(productPath)

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: '商品が見つかりませんでした',
      }),
    ).toBeVisible()
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
      'content',
      /noindex/u,
    )
    await expect(
      page.getByRole('link', { name: '商品一覧へ戻る' }),
    ).toHaveAttribute('href', '/products')
  }

  expect(browserProductApiRequests).toBe(0)
})
