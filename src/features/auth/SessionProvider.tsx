'use client'

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react'

import type { UserDto } from '@/contracts/session'
import { ApiClientError } from '@/lib/api-client/request-json'
import { logout as requestLogout } from '@/lib/api-client/session'

export type SessionState =
  | { status: 'anonymous' }
  | { status: 'authenticated'; user: UserDto }
  | { status: 'error' }
  | { status: 'loading' }

type SessionContextValue = {
  logout: () => Promise<void>
  refresh: () => void
  setAuthenticated: (user: UserDto) => void
  state: SessionState
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({
  children,
  initialState = { status: 'anonymous' },
}: {
  children: ReactNode
  initialState?: SessionState
}) {
  const [state, setState] = useState<SessionState>(initialState)
  const requestVersion = useRef(0)

  const refresh = useCallback(() => {
    window.location.reload()
  }, [])

  const setAuthenticated = useCallback((user: UserDto) => {
    requestVersion.current += 1
    setState({ status: 'authenticated', user })
  }, [])

  const logout = useCallback(async () => {
    const version = requestVersion.current + 1
    requestVersion.current = version
    try {
      await requestLogout()
      if (requestVersion.current !== version) return
      setState({ status: 'anonymous' })
    } catch (error) {
      if (requestVersion.current !== version) return
      if (error instanceof ApiClientError && error.status === 401) {
        setState({ status: 'anonymous' })
        return
      }
      throw error
    }
  }, [])

  const value = useMemo(
    () => ({ logout, refresh, setAuthenticated, state }),
    [logout, refresh, setAuthenticated, state],
  )

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  const context = useContext(SessionContext)
  if (!context) {
    throw new Error('useSessionはSessionProvider内で使用してください。')
  }
  return context
}
