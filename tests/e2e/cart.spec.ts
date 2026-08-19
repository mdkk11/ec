import { expect, test } from '@playwright/test'

test('CART-001/005/014: 商品詳細から追加し、カートで数量変更・削除する', async ({
  page,
}) => {
  await page.goto('/login')
  await page.getByLabel('メールアドレス').fill('customer@example.test')
  await page.getByLabel('パスワード').fill('CustomerPass123!')
  await page.getByRole('button', { name: 'ログイン' }).click()
  await expect(page).toHaveURL('/')

  let addRequestCount = 0
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      new URL(request.url()).pathname === '/api/cart/items'
    ) {
      addRequestCount += 1
    }
  })

  await page.goto('/products/30000000-0000-4000-8000-000000000001')
  await page.getByRole('button', { name: '1点カートに追加' }).click()
  await expect(page.getByText('カートへ追加しました。')).toBeVisible()
  expect(addRequestCount).toBe(1)

  await page.getByRole('link', { name: 'カートを見る' }).click()
  await expect(page).toHaveURL('/cart')
  await expect(
    page.getByRole('heading', {
      level: 2,
      name: 'リネンブレンド オーバーシャツ',
    }),
  ).toBeVisible()
  await expect(
    page.getByRole('img', { name: 'リネンブレンド オーバーシャツ' }),
  ).toHaveAttribute('src', /linen-overshirt/u)

  const quantityInput = page.getByRole('combobox', {
    exact: true,
    name: 'リネンブレンド オーバーシャツの数量',
  })
  const updateResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      new URL(response.url()).pathname.startsWith('/api/cart/items/'),
  )
  await quantityInput.selectOption('2')
  await updateResponse
  await expect(quantityInput).toHaveValue('2')
  await expect(page.getByText('¥57,200').first()).toBeVisible()

  await page
    .getByRole('button', { name: 'リネンブレンド オーバーシャツを削除' })
    .click()
  await expect(page.getByText('カートは空です')).toBeVisible()
  await expect(
    page.getByRole('link', { name: '商品一覧を見る' }),
  ).toBeVisible()
})
