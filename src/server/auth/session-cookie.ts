import type { Temporal } from '@js-temporal/polyfill'

export const SESSION_COOKIE_NAME = 'mockshop_session'
export const SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60

export function createSessionExpiration(now: Temporal.Instant) {
  return now.add({ seconds: SESSION_DURATION_SECONDS })
}

export function createSessionCookieOptions(nodeEnv = process.env.NODE_ENV) {
  return {
    httpOnly: true,
    maxAge: SESSION_DURATION_SECONDS,
    path: '/',
    sameSite: 'lax' as const,
    secure: nodeEnv === 'production',
  }
}

export function createExpiredSessionCookieOptions(nodeEnv = process.env.NODE_ENV) {
  return {
    ...createSessionCookieOptions(nodeEnv),
    maxAge: 0,
  }
}
