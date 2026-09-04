import { expect, test } from '@playwright/test'

import { e2ePurchaseFixtures } from '@/server/db/seed'

const fixtureByProject = {
  'chromium-purchase': e2ePurchaseFixtures.chromium,
  'firefox-purchase': e2ePurchaseFixtures.firefox,
  'webkit-purchase': e2ePurchaseFixtures.webkit,
} as const

test('E2E-001/COUPON-001: ログインからクーポン適用・注文・履歴確認まで完了する', async ({
  page,
}, testInfo) => {
  const fixture = fixtureByProject[testInfo.project.name as keyof typeof fixtureByProject]
  if (!fixture) {
    throw new Error(`購入fixtureがありません: ${testInfo.project.name}`)
  }

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
  await expect(page.getByText('カートへ追加しました。')).toBeVisible()
  await page.getByRole('link', { name: 'カートを見る' }).click()

  await page.getByLabel('クーポンコード').fill(`  ${fixture.couponCode.toLowerCase()}  `)
  await page.getByRole('button', { name: 'クーポンを適用' }).click()
  await expect(page.getByText(fixture.couponCode)).toBeVisible()
  await expect(page.getByText('−¥3,000')).toBeVisible()
  await expect(page.getByText('¥17,000')).toBeVisible()

  await page.getByRole('button', { name: '注文を確定する' }).click()
  await expect(page).toHaveURL(/\/orders\/[^/]+\/complete$/u)
  await expect(page.getByRole('heading', { name: 'ご注文を受け付けました' })).toBeVisible()
  await expect(page.getByText(fixture.couponCode)).toBeVisible()

  await page.getByRole('link', { name: '注文履歴を見る' }).click()
  await expect(page).toHaveURL('/orders')
  await expect(page.getByRole('heading', { name: '注文履歴' })).toBeVisible()
  await expect(page.getByText('¥17,000')).toBeVisible()
})
