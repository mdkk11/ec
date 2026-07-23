import { expect, test } from '@playwright/test'

test('AUTH-001/004/008/012: 購入者が一度だけログインし、ログアウト後も匿名になる', async ({
  page,
}) => {
  let loginRequestCount = 0
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      new URL(request.url()).pathname === '/api/session'
    ) {
      loginRequestCount += 1
    }
  })

  await page.goto('/login')
  await page.getByLabel('メールアドレス').fill('customer@example.test')
  await page.getByLabel('パスワード').fill('CustomerPass123!')

  const loginButton = page.getByRole('button', { name: 'ログイン' })
  await loginButton.evaluate((button: HTMLButtonElement) => {
    button.click()
    button.click()
  })

  await expect(page).toHaveURL('/')
  await expect(page.getByText('customer@example.test')).toBeVisible()
  expect(loginRequestCount).toBe(1)

  await page.reload()
  await expect(page.getByText('customer@example.test')).toBeVisible()

  await page.getByRole('button', { name: 'ログアウト' }).click()
  await expect(page.getByRole('link', { name: 'ログイン' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('link', { name: 'ログイン' })).toBeVisible()
})
