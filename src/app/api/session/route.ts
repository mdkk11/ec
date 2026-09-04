import { NextRequest, NextResponse } from 'next/server'

import { loginRequestSchema } from '@/contracts/session'
import { Temporal } from '@/lib/date-time/temporal'
import {
  createExpiredSessionCookieOptions,
  createSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from '@/server/auth/session-cookie'
import {
  deleteSession,
  loginWithPassword,
  resolveSessionActor,
} from '@/server/auth/session-service'
import { getRuntimeDatabase } from '@/server/db/runtime'
import { apiErrorResponse, noStoreJsonResponse, parseJsonRequest } from '@/server/http/json'

function unauthenticatedResponse() {
  return apiErrorResponse(401, 'UNAUTHENTICATED', 'ログインが必要です。')
}

export async function POST(request: NextRequest) {
  try {
    const parsed = await parseJsonRequest(request, loginRequestSchema)
    if (!parsed.ok) return parsed.response

    const result = await loginWithPassword(parsed.data, {
      db: getRuntimeDatabase().db,
      now: Temporal.Now.instant(),
    })
    if (!result) {
      return apiErrorResponse(
        401,
        'INVALID_CREDENTIALS',
        'メールアドレスまたはパスワードが正しくありません。',
      )
    }

    const response = noStoreJsonResponse({ user: result.user })
    response.cookies.set(SESSION_COOKIE_NAME, result.token, createSessionCookieOptions())
    return response
  } catch (error) {
    console.error('セッションの作成に失敗しました。', error)
    return apiErrorResponse(
      500,
      'INTERNAL_ERROR',
      '処理に失敗しました。時間をおいてもう一度お試しください。',
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) return unauthenticatedResponse()

    const actor = await resolveSessionActor(token, {
      db: getRuntimeDatabase().db,
      now: Temporal.Now.instant(),
    })
    if (!actor) return unauthenticatedResponse()

    return noStoreJsonResponse({ user: actor })
  } catch (error) {
    console.error('セッションの取得に失敗しました。', error)
    return apiErrorResponse(
      500,
      'INTERNAL_ERROR',
      '処理に失敗しました。時間をおいてもう一度お試しください。',
    )
  }
}

export async function DELETE(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value

  try {
    if (
      !token ||
      !(await deleteSession(token, {
        db: getRuntimeDatabase().db,
        now: Temporal.Now.instant(),
      }))
    ) {
      const response = unauthenticatedResponse()
      response.cookies.set(SESSION_COOKIE_NAME, '', createExpiredSessionCookieOptions())
      return response
    }

    const response = new NextResponse(null, {
      headers: { 'Cache-Control': 'no-store' },
      status: 204,
    })
    response.cookies.set(SESSION_COOKIE_NAME, '', createExpiredSessionCookieOptions())
    return response
  } catch (error) {
    console.error('セッションの削除に失敗しました。', error)
    return apiErrorResponse(
      500,
      'INTERNAL_ERROR',
      '処理に失敗しました。時間をおいてもう一度お試しください。',
    )
  }
}
