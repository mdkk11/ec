import type { NextRequest } from 'next/server'

import { Temporal } from '@/lib/date-time/temporal'
import { getRuntimeDatabase } from '@/server/db/runtime'

import { requireAdmin, requireCustomer } from './authorization'
import { SESSION_COOKIE_NAME } from './session-cookie'
import { resolveSessionActor } from './session-service'

export async function requireCustomerRequest(request: NextRequest, now = Temporal.Now.instant()) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
  const actor = token
    ? await resolveSessionActor(token, {
        db: getRuntimeDatabase().db,
        now,
      })
    : null

  return requireCustomer(actor)
}

export async function requireAdminRequest(request: NextRequest, now = Temporal.Now.instant()) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
  const actor = token
    ? await resolveSessionActor(token, {
        db: getRuntimeDatabase().db,
        now,
      })
    : null

  return requireAdmin(actor)
}
