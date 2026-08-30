import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { HttpResponse } from 'msw'
import type { ReactNode } from 'react'

import type { CartDto } from '@/contracts/cart'
import { SessionProvider, type SessionState } from '@/features/auth/SessionProvider'

import { CartOperationProvider } from './CartOperationProvider'

export const customer = {
  email: 'customer@example.test',
  id: '10000000-0000-4000-8000-000000000001',
  role: 'customer' as const,
}

const authenticatedState: SessionState = {
  status: 'authenticated',
  user: customer,
}

export function renderWithProviders(
  children: ReactNode,
  initialSessionState: SessionState = authenticatedState,
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
          <CartOperationProvider>{children}</CartOperationProvider>
        </SessionProvider>
      </QueryClientProvider>,
    ),
  }
}

export function cartResponse(cart: CartDto) {
  return HttpResponse.json({ cart })
}
