import type { NextRequest } from 'next/server'

import { Temporal } from '@/lib/date-time/temporal'
import { getRuntimeDatabase } from '@/server/db/runtime'

import { requireCustomer } from './authorization'
import { SESSION_COOKIE_NAME } from './session-cookie'
import { resolveSessionActor } from './session-service'

export async function requireCustomerRequest(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
  const actor = token
    ? await resolveSessionActor(token, {
        db: getRuntimeDatabase().db,
        now: Temporal.Now.instant(),
      })
    : null

  return requireCustomer(actor)
}
