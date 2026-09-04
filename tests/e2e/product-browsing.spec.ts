import { expect, test } from '@playwright/test'

test('E2E-007: トップの新着8商品から実在する詳細へ移動する', async ({ page, request }) => {
  await page.goto('/')

  const previewProductLinks = page.getByRole('main').getByRole('link', { name: /の詳細を見る$/u })
  await expect(previewProductLinks).toHaveCount(8)

  const hrefs = await previewProductLinks.evaluateAll((links) =>
    links.map((link) => link.getAttribute('href')),
  )
  expect(hrefs.every((href): href is string => href !== null)).toBe(true)
  expect(new Set(hrefs).size).toBe(8)

  for (const href of hrefs) {
    if (!href) throw new Error('トップの商品詳細リンクにhrefがありません。')
    const response = await request.get(href)
    expect(response.status()).toBe(200)
  }

  const firstProductLink = previewProductLinks.first()
  await expect(firstProductLink).toHaveAccessibleName('リネンブレンド オーバーシャツの詳細を見る')
  await firstProductLink.click()
  await expect(page).toHaveURL('/products/30000000-0000-4000-8000-000000000001')
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'リネンブレンド オーバーシャツ',
    }),
  ).toBeVisible()
})

test('E2E-008: 商品一覧の下部から詳細へ移動するとページ先頭を表示する', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 })
  await page.goto('/products')

  const productLink = page.getByRole('link', {
    name: 'コンパクトウール ブルゾンの詳細を見る',
  })
  await expect(productLink).toBeVisible()
  await page.evaluate(() => window.scrollTo(0, 1_700))
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(1_700)
  await expect(productLink).toBeInViewport()

  await productLink.click()
  await expect(page).toHaveURL('/products/30000000-0000-4000-8000-000000000010')
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'コンパクトウール ブルゾン',
    }),
  ).toBeVisible()
  await page.waitForLoadState('networkidle')
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
})

test('E2E-007/PRODUCT-001/010/011/014/015: Server Componentの商品一覧からカテゴリ別の詳細へ移動して戻る', async ({
  page,
}) => {
  let browserProductApiRequests = 0
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/products')) {
      browserProductApiRequests += 1
    }
  })

  await page.goto('/products')

  await expect(page.getByRole('heading', { level: 1, name: 'ALL ITEMS' })).toBeVisible()
  await expect(page.getByText('29点')).toBeVisible()

  const catalogProductImages = page.locator(
    'article:has(a[href^="/products/30000000-0000-4000-8000-"]) img',
  )
  await expect(catalogProductImages).toHaveCount(24)

  const fixturePaths = new Set<string>()
  for (let index = 0; index < 24; index += 1) {
    const productImage = catalogProductImages.nth(index)
    await productImage.scrollIntoViewIfNeeded()
    await expect(productImage).toBeVisible()

    const imageState = await productImage.evaluate((image) => {
      if (!(image instanceof HTMLImageElement)) {
        throw new Error('商品画像がimg要素ではありません。')
      }

      const optimizedUrl = new URL(image.currentSrc, image.ownerDocument.baseURI)
      return {
        complete: image.complete,
        naturalWidth: image.naturalWidth,
        originalPath: optimizedUrl.searchParams.get('url'),
        optimizedOrigin: optimizedUrl.origin,
      }
    })
    expect(imageState.complete).toBe(true)
    expect(imageState.naturalWidth).toBeGreaterThan(0)
    expect(imageState.optimizedOrigin).toBe(new URL(page.url()).origin)
    expect(imageState.originalPath).toMatch(/^\/images\/home\/[a-z-]+\.jpg$/u)
    fixturePaths.add(imageState.originalPath ?? '')
  }
  expect(fixturePaths.size).toBe(24)

  await page.getByRole('link', { name: '衣類', exact: true }).click()
  await expect(page).toHaveURL('/products?category=clothing')
  await expect(page.getByRole('heading', { level: 1, name: '衣類' })).toBeVisible()
  await expect(page.getByText('8点')).toBeVisible()
  await expect(page.getByRole('article')).toHaveCount(8)
  await expect(page.getByText('ソフトレザー デイバッグ')).toHaveCount(0)

  const firstProductLink = page.getByRole('article').first().getByRole('link')
  await expect(firstProductLink).toHaveAccessibleName('リネンブレンド オーバーシャツの詳細を見る')
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

  await expect(page).toHaveURL('/products/30000000-0000-4000-8000-000000000001')
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'リネンブレンド オーバーシャツ',
    }),
  ).toBeVisible()
  await expect(page.getByText('¥28,600')).toBeVisible()
  await expect(page.getByText('在庫 8点')).toBeVisible()
  await expect(page.getByRole('img', { name: 'リネンブレンド オーバーシャツ' })).toBeVisible()

  const backLink = page.getByRole('link', { name: '衣類の商品一覧へ戻る' })
  for (let index = 0; index < 20; index += 1) {
    if (await backLink.evaluate((link) => link === document.activeElement)) {
      break
    }
    await page.keyboard.press('Tab')
  }
  await expect(backLink).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL('/products?category=clothing')
  expect(browserProductApiRequests).toBe(0)
})

test('PRODUCT-017: 不明なcategory slugを画面上の404にする', async ({ page }) => {
  let browserProductApiRequests = 0
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/products')) {
      browserProductApiRequests += 1
    }
  })

  await page.goto('/products?category=unknown-category')
  await expect(page.getByRole('heading', { name: 'カテゴリが見つかりませんでした' })).toBeVisible()
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute('content', /noindex/u)
  await expect(page.getByRole('link', { name: 'ALL ITEMSへ戻る' })).toHaveAttribute(
    'href',
    '/products',
  )

  expect(browserProductApiRequests).toBe(0)
})

test('E2E-007/PRODUCT-006/007: 不正IDと非公開商品を画面上の404にする', async ({ page }) => {
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
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute('content', /noindex/u)
    await expect(page.getByRole('link', { name: '商品一覧へ戻る' })).toHaveAttribute(
      'href',
      '/products',
    )
  }

  expect(browserProductApiRequests).toBe(0)
})
