import { expect, test } from '@playwright/test'

import { e2ePurchaseFixtures } from '@/server/db/seed'

test('E2E-005: Mobile Chromiumで商品一覧から注文を完了する', async ({
  page,
}) => {
  const fixture = e2ePurchaseFixtures.mobile

  await page.goto('/login')
  await page.getByLabel('メールアドレス').fill(fixture.email)
  await page.getByLabel('パスワード').fill(fixture.password)
  const loginResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === '/api/session',
  )
  await page.getByRole('button', { name: 'ログイン' }).click()
  expect((await loginResponse).ok()).toBe(true)
  await expect(page).toHaveURL('/')
  await expect(page.getByText(fixture.email)).toBeVisible()

  await page.goto('/products')
  await page
    .getByRole('link', { name: /モバイル購入確認用バッグ/u })
    .click()
  await page.getByRole('button', { name: '1点カートに追加' }).click()
  await page.getByRole('link', { name: 'カートを見る' }).click()
  await page.getByRole('button', { name: '注文を確定する' }).click()

  await expect(page).toHaveURL(/\/orders\/[^/]+\/complete$/u)
  await expect(
    page.getByRole('heading', { name: 'ご注文を受け付けました' }),
  ).toBeVisible()
  await expect(page.getByText('¥20,000').last()).toBeVisible()
})
