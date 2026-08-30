import type { Temporal } from '@js-temporal/polyfill'

export const SESSION_COOKIE_NAME = 'mockshop_session'
export const SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60

type SessionCookieEnvironment = {
  DATABASE_URL?: string
  E2E_DATABASE_URL?: string
  E2E_HTTP_SERVER?: string
  GITHUB_ACTIONS?: string
  NEXT_DIST_DIR?: string
}

export function createSessionExpiration(now: Temporal.Instant) {
  return now.add({ seconds: SESSION_DURATION_SECONDS })
}

export function createSessionCookieOptions(
  nodeEnv = process.env.NODE_ENV,
  environment: SessionCookieEnvironment = readSessionCookieEnvironment(),
) {
  return {
    httpOnly: true,
    maxAge: SESSION_DURATION_SECONDS,
    path: '/',
    sameSite: 'lax' as const,
    secure: nodeEnv === 'production' && !isLocalE2eHttpServer(environment),
  }
}

export function createExpiredSessionCookieOptions(
  nodeEnv = process.env.NODE_ENV,
  environment: SessionCookieEnvironment = readSessionCookieEnvironment(),
) {
  return {
    ...createSessionCookieOptions(nodeEnv, environment),
    maxAge: 0,
  }
}

function readSessionCookieEnvironment(): SessionCookieEnvironment {
  return {
    DATABASE_URL: process.env.DATABASE_URL,
    E2E_DATABASE_URL: process.env.E2E_DATABASE_URL,
    E2E_HTTP_SERVER: process.env.E2E_HTTP_SERVER,
    GITHUB_ACTIONS: process.env.GITHUB_ACTIONS,
    NEXT_DIST_DIR: process.env.NEXT_DIST_DIR,
  }
}

function isLocalE2eHttpServer(environment: SessionCookieEnvironment) {
  if (environment.E2E_HTTP_SERVER !== 'true') return false

  const databaseUrl = environment.DATABASE_URL
  if (
    environment.NEXT_DIST_DIR !== '.next-e2e' ||
    !databaseUrl ||
    databaseUrl !== environment.E2E_DATABASE_URL
  ) {
    throw new Error('E2E HTTP serverのCookie guard設定が一致しません。')
  }

  const target = new URL(databaseUrl)
  const databaseName = target.pathname.replace(/^\//u, '')
  const isAllowedHost =
    target.hostname === 'localhost' ||
    target.hostname === '127.0.0.1' ||
    (environment.GITHUB_ACTIONS === 'true' && target.hostname === 'postgres')
  if (!isAllowedHost || databaseName !== 'mockshop_e2e') {
    throw new Error('E2E HTTP serverは許可した専用DBだけを使用できます。')
  }

  return true
}
