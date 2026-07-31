import 'server-only'

import { cookies } from 'next/headers'

import {
  orderListResponseSchema,
  orderResponseSchema,
} from '@/contracts/order'
import { Temporal } from '@/lib/date-time/temporal'
import { requireCustomer } from '@/server/auth/authorization'
import { SESSION_COOKIE_NAME } from '@/server/auth/session-cookie'
import { resolveSessionActor } from '@/server/auth/session-service'
import { getRuntimeDatabase } from '@/server/db/runtime'

import { findOrder, listOrders } from './order-service'

export type OrderPageAccess =
  | { status: 'unauthenticated' }
  | { status: 'forbidden' }
  | { status: 'authorized'; userId: string }

async function resolveOrderPageAccess(): Promise<OrderPageAccess> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value
  const actor = token
    ? await resolveSessionActor(token, {
        db: getRuntimeDatabase().db,
        now: Temporal.Now.instant(),
      })
    : null
  const authorization = requireCustomer(actor)
  if (authorization.ok) {
    return {
      status: 'authorized',
      userId: authorization.actor.id,
    }
  }
  return {
    status:
      authorization.code === 'UNAUTHENTICATED'
        ? 'unauthenticated'
        : 'forbidden',
  }
}

export async function loadOrderHistoryPageData() {
  const access = await resolveOrderPageAccess()
  if (access.status !== 'authorized') return { access, items: null }

  const items = await listOrders({
    db: getRuntimeDatabase().db,
    userId: access.userId,
  })
  return {
    access,
    items: orderListResponseSchema.parse({ items }).items,
  }
}

export async function loadOrderDetailPageData(orderId: string) {
  const access = await resolveOrderPageAccess()
  if (access.status !== 'authorized') return { access, order: null }

  const order = await findOrder(orderId, {
    db: getRuntimeDatabase().db,
    userId: access.userId,
  })
  return {
    access,
    order: order ? orderResponseSchema.parse({ order }).order : null,
  }
}
