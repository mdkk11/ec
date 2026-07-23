'use client'

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import type { UserDto } from '@/contracts/session'
import { ApiClientError } from '@/lib/api-client/request-json'
import {
  getCurrentSession,
  logout as requestLogout,
} from '@/lib/api-client/session'

export type SessionState =
  | { status: 'anonymous' }
  | { status: 'authenticated'; user: UserDto }
  | { status: 'error' }
  | { status: 'loading' }

type SessionContextValue = {
  logout: () => Promise<void>
  refresh: () => Promise<void>
  setAuthenticated: (user: UserDto) => void
  state: SessionState
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading' })
  const requestVersion = useRef(0)

  const refresh = useCallback(async () => {
    const version = requestVersion.current + 1
    requestVersion.current = version
    setState({ status: 'loading' })
    try {
      const session = await getCurrentSession()
      if (requestVersion.current !== version) return
      setState({ status: 'authenticated', user: session.user })
    } catch (error) {
      if (requestVersion.current !== version) return
      if (error instanceof ApiClientError && error.status === 401) {
        setState({ status: 'anonymous' })
        return
      }
      setState({ status: 'error' })
    }
  }, [])

  useEffect(() => {
    let active = true
    const version = requestVersion.current + 1
    requestVersion.current = version

    void getCurrentSession()
      .then((session) => {
        if (active && requestVersion.current === version) {
          setState({ status: 'authenticated', user: session.user })
        }
      })
      .catch((error: unknown) => {
        if (!active || requestVersion.current !== version) return
        if (error instanceof ApiClientError && error.status === 401) {
          setState({ status: 'anonymous' })
          return
        }
        setState({ status: 'error' })
      })

    return () => {
      active = false
    }
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
