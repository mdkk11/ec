import { expect, test } from '@playwright/test'

import {
  e2eAdminFixtures,
  e2ePurchaseFixtures,
} from '@/server/db/seed'

function projectFixtures(projectName: string) {
  if (projectName.startsWith('chromium')) {
    return {
      admin: e2eAdminFixtures.chromium,
      customer: e2ePurchaseFixtures.chromium,
    }
  }
  if (projectName.startsWith('firefox')) {
    return {
      admin: e2eAdminFixtures.firefox,
      customer: e2ePurchaseFixtures.firefox,
    }
  }
  return {
    admin: e2eAdminFixtures.webkit,
    customer: e2ePurchaseFixtures.webkit,
  }
}

test('E2E-003: 管理者が商品を作成し、在庫変更後に非公開化できる', async ({
  page,
}, testInfo) => {
  const { admin } = projectFixtures(testInfo.project.name)

  await page.goto('/login')
  await page.getByLabel('メールアドレス').fill(admin.email)
  await page.getByLabel('パスワード').fill(admin.password)
  await page.getByRole('button', { name: 'ログイン' }).click()
  await expect(page).toHaveURL('/')
  await page.getByRole('link', { name: '商品管理' }).click()
  await expect(page).toHaveURL('/admin/products')

  await page.getByLabel('商品名').fill(admin.productName)
  await page.getByLabel('商品説明').fill('管理E2Eで作成した固定商品です。')
  await page.getByLabel('価格（円）').fill('19800')
  await page.getByLabel('在庫数').fill('3')
  await page.getByLabel('購入者へ公開する').check()
  await page.getByRole('button', { name: '商品を作成' }).click()
  await expect(page.getByRole('status')).toContainText('作成しました')

  const row = page.getByRole('listitem').filter({ hasText: admin.productName })
  await row.getByRole('link', { name: '編集する' }).click()
  await expect(page).toHaveURL(new RegExp(`/admin/products/[0-9a-f-]+$`, 'u'))
  await expect(
    page.getByRole('heading', { level: 1, name: admin.productName }),
  ).toBeVisible()

  await page.getByLabel('在庫数').fill('5')
  await page.getByRole('button', { name: '在庫を更新' }).click()
  await expect(page.getByRole('status')).toContainText('在庫数を更新しました')

  await page.getByLabel('購入者へ公開する').uncheck()
  await page.getByRole('button', { name: '商品情報を更新' }).click()
  await expect(page.getByRole('status')).toContainText('商品情報を更新しました')

  await page.goto('/products')
  await expect(page.getByText(admin.productName)).toHaveCount(0)
})

test('E2E-004: customerは管理URLと管理APIを利用できない', async ({
  page,
}, testInfo) => {
  const { customer } = projectFixtures(testInfo.project.name)

  await page.goto('/login')
  await page.getByLabel('メールアドレス').fill(customer.email)
  await page.getByLabel('パスワード').fill(customer.password)
  await page.getByRole('button', { name: 'ログイン' }).click()
  await expect(page).toHaveURL('/')

  await page.goto('/admin/products')
  await expect(page.getByText('この画面は管理者専用です。')).toBeVisible()
  const response = await page.request.get('/api/admin/products')
  expect(response.status()).toBe(403)
})
