import { expect, test } from '@playwright/test'

test('COUPON-001: 商品追加からクーポン適用までを完了する', async ({
  page,
}) => {
  await page.goto('/login')
  await page.getByLabel('メールアドレス').fill('coupon-e2e@example.test')
  await page.getByLabel('パスワード').fill('CouponPass123!')
  await page.getByRole('button', { name: 'ログイン' }).click()
  await expect(page).toHaveURL('/')

  await page.goto('/products/31000000-0000-4000-8000-000000000001')
  await page.getByRole('button', { name: '1点カートに追加' }).click()
  await expect(page.getByText('カートへ追加しました。')).toBeVisible()
  await page.getByRole('link', { name: 'カートを見る' }).click()

  await page.getByLabel('クーポンコード').fill('  welcome15  ')
  await page.getByRole('button', { name: 'クーポンを適用' }).click()

  await expect(page.getByText('WELCOME15')).toBeVisible()
  await expect(page.getByText('−¥3,000')).toBeVisible()
  await expect(page.getByText('¥17,000')).toBeVisible()
})
