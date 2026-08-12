import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { HttpResponse } from 'msw'
import type { ReactNode } from 'react'

import type { AdminProductDto } from '@/contracts/product'
import {
  SessionProvider,
  type SessionState,
} from '@/features/auth/SessionProvider'

export const admin = {
  email: 'admin@example.test',
  id: '20000000-0000-4000-8000-000000000001',
  role: 'admin' as const,
}

const adminState: SessionState = { status: 'authenticated', user: admin }

export const product: AdminProductDto = {
  availability: 'in_stock',
  categoryId: '40000000-0000-4000-8000-000000000001',
  description: '管理画面テスト用の商品です。',
  id: '30000000-0000-4000-8000-000000000001',
  imagePath: '/images/fixtures/product-placeholder.svg',
  isPublished: true,
  name: '管理テスト商品',
  price: 12_100,
  stock: 8,
  version: 1,
}

export function renderWithProviders(
  children: ReactNode,
  initialSessionState: SessionState = adminState,
) {
  const client = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  })
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <SessionProvider initialState={initialSessionState}>
          {children}
        </SessionProvider>
      </QueryClientProvider>,
    ),
  }
}

export function listResponse(items: AdminProductDto[]) {
  return HttpResponse.json({ items })
}
