import { expect, test } from '@playwright/test'

import { e2eAdminFixtures, e2eAdminOrderFixtures } from '@/server/db/seed'

function projectFixtures(projectName: string) {
  if (projectName.startsWith('chromium')) {
    return {
      admin: e2eAdminFixtures.chromium,
      order: e2eAdminOrderFixtures.chromium,
    }
  }
  if (projectName.startsWith('firefox')) {
    return {
      admin: e2eAdminFixtures.firefox,
      order: e2eAdminOrderFixtures.firefox,
    }
  }
  return {
    admin: e2eAdminFixtures.webkit,
    order: e2eAdminOrderFixtures.webkit,
  }
}

test('E2E-006: 管理者が受付注文を処理中へ更新できる', async ({
  page,
}, testInfo) => {
  const { admin, order } = projectFixtures(testInfo.project.name)

  await page.goto('/login')
  await page.getByLabel('メールアドレス').fill(admin.email)
  await page.getByLabel('パスワード').fill(admin.password)
  await page.getByRole('button', { name: 'ログイン' }).click()
  await expect(page).toHaveURL('/')
  await page.getByRole('button', { name: 'マイページ' }).click()
  await page.getByRole('link', { name: 'オーダー' }).click()
  await expect(page).toHaveURL('/admin/orders')

  const row = page.getByRole('row').filter({ hasText: order.orderId })
  await expect(row).toBeVisible()
  await row
    .getByLabel(`注文 ${order.orderId} の変更先状態`)
    .selectOption('processing')
  await row.getByRole('button', { name: '状態を更新' }).click()
  await expect(row.getByRole('cell', { name: /処理中/u })).toBeVisible()
})
