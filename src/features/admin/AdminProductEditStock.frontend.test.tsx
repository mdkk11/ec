import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import type { AdminProductDto } from '@/contracts/product'
import { server } from '@/test/msw/server'

import { AdminProductEditPage } from './AdminProductEditPage'
import {
  admin,
  listResponse,
  product,
  renderWithProviders,
} from './admin-product-frontend-test-helpers'
import { adminProductsQueryKey } from './admin-product-query'

describe('管理商品編集・在庫', () => {
  it('商品IDを切り替えた場合だけ編集内容を新しい商品で初期化する', async () => {
    const anotherProduct = {
      ...product,
      id: '30000000-0000-4000-8000-000000000002',
      name: '切替先の商品',
    }
    server.use(
      http.get('/api/admin/products', () =>
        listResponse([product, anotherProduct]),
      ),
    )

    function ProductSwitcher() {
      const [productId, setProductId] = useState(product.id)
      return (
        <>
          <AdminProductEditPage productId={productId} />
          <button onClick={() => setProductId(anotherProduct.id)} type="button">
            別の商品を編集
          </button>
        </>
      )
    }

    const user = userEvent.setup()
    renderWithProviders(<ProductSwitcher />)
    const nameInput = await screen.findByLabelText('商品名')
    await user.clear(nameInput)
    await user.type(nameInput, '未送信の商品名')

    await user.click(screen.getByRole('button', { name: '別の商品を編集' }))

    expect(screen.getByLabelText('商品名')).toHaveValue(anotherProduct.name)
  })

  it('更新中に商品IDを切り替えた場合は完了まで新しい商品の操作を無効化する', async () => {
    const anotherProduct = {
      ...product,
      id: '30000000-0000-4000-8000-000000000002',
      name: '切替先の商品',
    }
    const updated = { ...product, name: '更新中の商品名', version: 2 }
    let releaseUpdate: (() => void) | undefined
    const updateGate = new Promise<void>((resolve) => {
      releaseUpdate = resolve
    })
    server.use(
      http.get('/api/admin/products', () =>
        listResponse([product, anotherProduct]),
      ),
      http.patch('/api/admin/products/:productId', async () => {
        await updateGate
        return HttpResponse.json({ product: updated })
      }),
    )

    function ProductSwitcher() {
      const [productId, setProductId] = useState(product.id)
      return (
        <>
          <AdminProductEditPage productId={productId} />
          <button onClick={() => setProductId(anotherProduct.id)} type="button">
            別の商品を編集
          </button>
        </>
      )
    }

    const user = userEvent.setup()
    renderWithProviders(<ProductSwitcher />)
    const nameInput = await screen.findByLabelText('商品名')
    await user.clear(nameInput)
    await user.type(nameInput, updated.name)
    await user.click(screen.getByRole('button', { name: '商品情報を更新' }))

    await user.click(screen.getByRole('button', { name: '別の商品を編集' }))

    const switchedNameInput = screen.getByLabelText('商品名')
    expect(switchedNameInput).toHaveValue(anotherProduct.name)
    expect(switchedNameInput).toBeDisabled()
    expect(screen.getByRole('button', { name: '商品情報を更新' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent(
      '別の商品を更新しています。完了するまでお待ちください。',
    )
    expect(
      screen.getByRole('heading', { name: anotherProduct.name }).closest('section'),
    ).toHaveAttribute('aria-busy', 'true')

    releaseUpdate?.()
    await waitFor(() => expect(switchedNameInput).toBeEnabled())
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('商品情報を変更fieldだけで更新する', async () => {
    let requestBody: unknown
    const updated = { ...product, name: '更新済み商品', version: 2 }
    server.use(
      http.get('/api/admin/products', () => listResponse([product])),
      http.patch('/api/admin/products/:productId', async ({ request }) => {
        requestBody = await request.json()
        return HttpResponse.json({ product: updated })
      }),
    )
    const user = userEvent.setup()
    renderWithProviders(<AdminProductEditPage productId={product.id} />)

    const nameInput = await screen.findByLabelText('商品名')
    await user.clear(nameInput)
    await user.type(nameInput, updated.name)
    await user.click(screen.getByRole('button', { name: '商品情報を更新' }))

    expect(await screen.findByRole('status')).toHaveTextContent('更新しました')
    expect(requestBody).toEqual({ expectedVersion: 1, name: updated.name })
    expect(screen.getByText('version 2')).toBeVisible()
  })

  it('在庫更新後のversionを共有し、未送信の商品情報を保持する', async () => {
    const stockUpdated = { ...product, stock: 10, version: 2 }
    const metadataUpdated = {
      ...stockUpdated,
      name: '在庫更新前から入力中の商品名',
      version: 3,
    }
    let metadataRequest: unknown
    server.use(
      http.get('/api/admin/products', () => listResponse([product])),
      http.patch('/api/admin/products/:productId/stock', () =>
        HttpResponse.json({ product: stockUpdated }),
      ),
      http.patch('/api/admin/products/:productId', async ({ request }) => {
        metadataRequest = await request.json()
        return HttpResponse.json({ product: metadataUpdated })
      }),
    )
    const user = userEvent.setup()
    renderWithProviders(<AdminProductEditPage productId={product.id} />)

    const nameInput = await screen.findByLabelText('商品名')
    await user.clear(nameInput)
    await user.type(nameInput, metadataUpdated.name)
    const stockInput = screen.getByLabelText('在庫数')
    await user.clear(stockInput)
    await user.type(stockInput, '10')
    await user.click(screen.getByRole('button', { name: '在庫を更新' }))

    expect(await screen.findByText('version 2')).toBeVisible()
    expect(nameInput).toHaveValue(metadataUpdated.name)
    await user.click(screen.getByRole('button', { name: '商品情報を更新' }))

    expect(await screen.findByText('version 3')).toBeVisible()
    expect(metadataRequest).toEqual({
      expectedVersion: 2,
      name: metadataUpdated.name,
    })
  })

  it('ADMIN-005: 在庫競合で入力を保持し、最新値の明示反映まで更新を停止する', async () => {
    const latest = { ...product, stock: 4, version: 2 }
    let listCount = 0
    server.use(
      http.get('/api/admin/products', () => {
        listCount += 1
        return listResponse(listCount === 1 ? [product] : [latest])
      }),
      http.patch('/api/admin/products/:productId/stock', () =>
        HttpResponse.json(
          { code: 'VERSION_CONFLICT', message: '競合しました。' },
          { status: 409 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderWithProviders(<AdminProductEditPage productId={product.id} />)

    const stockInput = await screen.findByLabelText('在庫数')
    await user.clear(stockInput)
    await user.type(stockInput, '10')
    await user.click(screen.getByRole('button', { name: '在庫を更新' }))

    expect(await screen.findByText('最新の商品情報を確認してください')).toBeVisible()
    expect(stockInput).toHaveValue(10)
    expect(screen.getByText('version 2')).toBeVisible()
    expect(screen.getByRole('button', { name: '在庫を更新' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: '最新値をフォームへ反映' }))
    expect(stockInput).toHaveValue(4)
    expect(screen.queryByText('最新の商品情報を確認してください')).not.toBeInTheDocument()
  })

  it('ADMIN-004: 商品情報の競合でも入力を保持して最新値の確認を求める', async () => {
    const latest = { ...product, name: '別の管理者による商品名', version: 2 }
    let listCount = 0
    server.use(
      http.get('/api/admin/products', () => {
        listCount += 1
        return listResponse(listCount === 1 ? [product] : [latest])
      }),
      http.patch('/api/admin/products/:productId', () =>
        HttpResponse.json(
          { code: 'VERSION_CONFLICT', message: '競合しました。' },
          { status: 409 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderWithProviders(<AdminProductEditPage productId={product.id} />)

    const nameInput = await screen.findByLabelText('商品名')
    await user.clear(nameInput)
    await user.type(nameInput, '入力中の商品名')
    await user.click(screen.getByRole('button', { name: '商品情報を更新' }))

    expect(await screen.findByText('最新の商品情報を確認してください')).toBeVisible()
    expect(nameInput).toHaveValue('入力中の商品名')
    expect(screen.getAllByText('別の管理者による商品名')).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: '最新値をフォームへ反映' }))
    expect(nameInput).toHaveValue('別の管理者による商品名')
  })

  it('古いbackground GETがmutation成功後のcacheとversionを巻き戻さない', async () => {
    let listCount = 0
    let releaseOld: (() => void) | undefined
    const oldGate = new Promise<void>((resolve) => { releaseOld = resolve })
    const updated = { ...product, name: '最新の商品名', version: 2 }
    server.use(
      http.get('/api/admin/products', async () => {
        listCount += 1
        if (listCount === 2) await oldGate
        return listResponse([product])
      }),
      http.patch('/api/admin/products/:productId', () =>
        HttpResponse.json({ product: updated }),
      ),
    )
    const user = userEvent.setup()
    const { client } = renderWithProviders(
      <AdminProductEditPage productId={product.id} />,
    )
    const nameInput = await screen.findByLabelText('商品名')

    const background = client.refetchQueries({
      queryKey: adminProductsQueryKey(admin.id),
    })
    await waitFor(() => expect(listCount).toBe(2))
    await user.clear(nameInput)
    await user.type(nameInput, updated.name)
    await user.click(screen.getByRole('button', { name: '商品情報を更新' }))
    expect(await screen.findByText('version 2')).toBeVisible()

    releaseOld?.()
    await background
    await waitFor(() => {
      const cached = client.getQueryData<AdminProductDto[]>(
        adminProductsQueryKey(admin.id),
      )
      expect(cached?.[0]).toMatchObject({ name: updated.name, version: 2 })
    })
  })

  it('mutation中に開始した古いGETも成功後のcacheを巻き戻さない', async () => {
    let listCount = 0
    let releaseMutation: (() => void) | undefined
    let releaseBackground: (() => void) | undefined
    const mutationGate = new Promise<void>((resolve) => {
      releaseMutation = resolve
    })
    const backgroundGate = new Promise<void>((resolve) => {
      releaseBackground = resolve
    })
    const updated = { ...product, name: 'mutation後の最新商品', version: 2 }
    server.use(
      http.get('/api/admin/products', async () => {
        listCount += 1
        if (listCount === 2) await backgroundGate
        return listResponse([product])
      }),
      http.patch('/api/admin/products/:productId', async () => {
        await mutationGate
        return HttpResponse.json({ product: updated })
      }),
    )
    const user = userEvent.setup()
    const { client } = renderWithProviders(
      <AdminProductEditPage productId={product.id} />,
    )
    const nameInput = await screen.findByLabelText('商品名')
    await user.clear(nameInput)
    await user.type(nameInput, updated.name)
    await user.click(screen.getByRole('button', { name: '商品情報を更新' }))

    const background = client.refetchQueries({
      queryKey: adminProductsQueryKey(admin.id),
    })
    await waitFor(() => expect(listCount).toBe(2))
    releaseMutation?.()
    expect(await screen.findByText('version 2')).toBeVisible()

    releaseBackground?.()
    await background
    await waitFor(() => {
      const cached = client.getQueryData<AdminProductDto[]>(
        adminProductsQueryKey(admin.id),
      )
      expect(cached?.[0]).toMatchObject({
        name: updated.name,
        version: 2,
      })
    })
  })

  it('409回復中の401ではログイン導線へ戻る', async () => {
    let listCount = 0
    server.use(
      http.get('/api/admin/products', () => {
        listCount += 1
        return listCount === 1
          ? listResponse([product])
          : HttpResponse.json(
              { code: 'UNAUTHENTICATED', message: 'ログインが必要です。' },
              { status: 401 },
            )
      }),
      http.patch('/api/admin/products/:productId/stock', () =>
        HttpResponse.json(
          { code: 'VERSION_CONFLICT', message: '競合しました。' },
          { status: 409 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderWithProviders(<AdminProductEditPage productId={product.id} />)

    const stockInput = await screen.findByLabelText('在庫数')
    await user.clear(stockInput)
    await user.type(stockInput, '10')
    await user.click(screen.getByRole('button', { name: '在庫を更新' }))

    expect(
      await screen.findByText('商品管理にはログインが必要です'),
    ).toBeVisible()
  })
})
