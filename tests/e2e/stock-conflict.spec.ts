import { expect, test } from '@playwright/test'

import { e2ePurchaseFixtures } from '@/server/db/seed'

import { updateE2EProductStock } from './update-product-stock'

test('E2E-002: 確認後の在庫変更で注文を止め、最新cartを表示する', async ({ page }) => {
  const fixture = e2ePurchaseFixtures.stockConflict

  await page.goto('/login')
  await page.getByLabel('メールアドレス').fill(fixture.email)
  await page.getByLabel('パスワード').fill(fixture.password)
  const loginResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/session',
  )
  await page.getByRole('button', { name: 'ログイン' }).click()
  expect((await loginResponse).ok()).toBe(true)
  await expect(page).toHaveURL('/')
  await page.getByRole('button', { name: 'マイページ' }).click()
  await expect(page.getByText(fixture.email)).toBeVisible()

  await page.goto(`/products/${fixture.productId}`)
  await page.getByRole('button', { name: '1点カートに追加' }).click()
  await page.getByRole('link', { name: 'カートを見る' }).click()
  await expect(page.getByRole('button', { name: '注文を確定する' })).toBeEnabled()

  await updateE2EProductStock(fixture.productId, 0)
  await page.getByRole('button', { name: '注文を確定する' }).click()

  await expect(
    page.getByText('在庫が変更されました。最新のカートを確認し、数量を調整してください。'),
  ).toBeVisible()
  await expect(page.getByText(/数量を減らして再度/u)).toBeVisible()
  await expect(page.getByRole('button', { name: '注文を確定する' })).toBeDisabled()
})
