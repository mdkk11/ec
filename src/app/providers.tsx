'use client'

import {
  isServer,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import type { ReactNode } from 'react'

import {
  SessionProvider,
  type SessionState,
} from '@/features/auth/SessionProvider'
import { CartOperationProvider } from '@/features/cart/CartOperationProvider'

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      mutations: {
        retry: false,
      },
      queries: {
        refetchOnWindowFocus: false,
        retry: false,
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined

function getQueryClient() {
  if (isServer) return makeQueryClient()
  browserQueryClient ??= makeQueryClient()
  return browserQueryClient
}

export function AppProviders({
  children,
  initialSessionState,
}: {
  children: ReactNode
  initialSessionState: SessionState
}) {
  return (
    <QueryClientProvider client={getQueryClient()}>
      <SessionProvider initialState={initialSessionState}>
        <CartOperationProvider>{children}</CartOperationProvider>
      </SessionProvider>
    </QueryClientProvider>
  )
}
