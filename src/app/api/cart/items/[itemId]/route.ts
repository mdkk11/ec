import type { NextRequest } from 'next/server'

import {
  cartItemIdSchema,
  updateCartItemRequestSchema,
} from '@/contracts/cart'
import {
  cartErrorResponse,
  cartServiceErrorResponse,
  cartSuccessResponse,
  validationFieldErrors,
} from '@/features/cart/server/cart-http'
import {
  CartServiceError,
  deleteCartItem,
  updateCartItem,
} from '@/features/cart/server/cart-service'
import { Temporal } from '@/lib/date-time/temporal'
import { requireCustomerRequest } from '@/server/auth/request-actor'
import { getRuntimeDatabase } from '@/server/db/runtime'

type RouteContext = {
  params: Promise<{ itemId: string }>
}

async function authorize(request: NextRequest) {
  const authorization = await requireCustomerRequest(request)
  if (!authorization.ok) {
    return {
      response:
        authorization.code === 'UNAUTHENTICATED'
          ? cartErrorResponse(401, authorization.code, 'ログインが必要です。')
          : cartErrorResponse(
              403,
              authorization.code,
              'カートは購入者専用です。',
            ),
    }
  }
  return { actor: authorization.actor }
}

async function parseItemId(context: RouteContext) {
  const { itemId } = await context.params
  return cartItemIdSchema.safeParse(itemId)
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const authorization = await authorize(request)
    if (authorization.response) return authorization.response

    const parsedItemId = await parseItemId(context)
    if (!parsedItemId.success) {
      return cartErrorResponse(
        400,
        'VALIDATION_ERROR',
        'カート明細IDの形式が正しくありません。',
      )
    }

    let payload: unknown
    try {
      payload = await request.json()
    } catch {
      return cartErrorResponse(
        400,
        'VALIDATION_ERROR',
        '入力内容を確認してください。',
      )
    }
    const parsed = updateCartItemRequestSchema.safeParse(payload)
    if (!parsed.success) {
      return cartErrorResponse(
        400,
        'VALIDATION_ERROR',
        '入力内容を確認してください。',
        validationFieldErrors(parsed.error),
      )
    }

    const cart = await updateCartItem(parsedItemId.data, parsed.data, {
      db: getRuntimeDatabase().db,
      now: Temporal.Now.instant().toString(),
      userId: authorization.actor.id,
    })
    return cartSuccessResponse(cart)
  } catch (error) {
    if (error instanceof CartServiceError) {
      return cartServiceErrorResponse(error)
    }
    console.error('カート明細の更新に失敗しました。', error)
    return cartErrorResponse(
      500,
      'INTERNAL_ERROR',
      'カートを更新できませんでした。時間をおいてもう一度お試しください。',
    )
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const authorization = await authorize(request)
    if (authorization.response) return authorization.response

    const parsedItemId = await parseItemId(context)
    if (!parsedItemId.success) {
      return cartErrorResponse(
        400,
        'VALIDATION_ERROR',
        'カート明細IDの形式が正しくありません。',
      )
    }

    const cart = await deleteCartItem(parsedItemId.data, {
      db: getRuntimeDatabase().db,
      now: Temporal.Now.instant().toString(),
      userId: authorization.actor.id,
    })
    return cartSuccessResponse(cart)
  } catch (error) {
    if (error instanceof CartServiceError) {
      return cartServiceErrorResponse(error)
    }
    console.error('カート明細の削除に失敗しました。', error)
    return cartErrorResponse(
      500,
      'INTERNAL_ERROR',
      '商品を削除できませんでした。時間をおいてもう一度お試しください。',
    )
  }
}
