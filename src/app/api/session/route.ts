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

const noStoreHeaders = {
  'Cache-Control': 'no-store',
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  fieldErrors?: Record<string, string[]>,
) {
  return NextResponse.json(
    {
      code,
      message,
      ...(fieldErrors ? { fieldErrors } : {}),
    },
    { headers: noStoreHeaders, status },
  )
}

function validationErrors(error: {
  issues: { message: string; path: PropertyKey[] }[]
}) {
  const fieldErrors: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const field = issue.path[0]
    if (typeof field !== 'string') continue
    fieldErrors[field] ??= []
    fieldErrors[field].push(issue.message)
  }
  return fieldErrors
}

function unauthenticatedResponse() {
  return errorResponse(
    401,
    'UNAUTHENTICATED',
    'ログインが必要です。',
  )
}

export async function POST(request: NextRequest) {
  try {
    let payload: unknown
    try {
      payload = await request.json()
    } catch {
      return errorResponse(
        400,
        'VALIDATION_ERROR',
        '入力内容を確認してください。',
      )
    }

    const parsed = loginRequestSchema.safeParse(payload)
    if (!parsed.success) {
      return errorResponse(
        400,
        'VALIDATION_ERROR',
        '入力内容を確認してください。',
        validationErrors(parsed.error),
      )
    }

    const result = await loginWithPassword(parsed.data, {
      db: getRuntimeDatabase().db,
      now: Temporal.Now.instant(),
    })
    if (!result) {
      return errorResponse(
        401,
        'INVALID_CREDENTIALS',
        'メールアドレスまたはパスワードが正しくありません。',
      )
    }

    const response = NextResponse.json(
      { user: result.user },
      { headers: noStoreHeaders, status: 200 },
    )
    response.cookies.set(
      SESSION_COOKIE_NAME,
      result.token,
      createSessionCookieOptions(),
    )
    return response
  } catch (error) {
    console.error('セッションの作成に失敗しました。', error)
    return errorResponse(
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

    return NextResponse.json(
      { user: actor },
      { headers: noStoreHeaders, status: 200 },
    )
  } catch (error) {
    console.error('セッションの取得に失敗しました。', error)
    return errorResponse(
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
      response.cookies.set(
        SESSION_COOKIE_NAME,
        '',
        createExpiredSessionCookieOptions(),
      )
      return response
    }

    const response = new NextResponse(null, {
      headers: noStoreHeaders,
      status: 204,
    })
    response.cookies.set(
      SESSION_COOKIE_NAME,
      '',
      createExpiredSessionCookieOptions(),
    )
    return response
  } catch (error) {
    console.error('セッションの削除に失敗しました。', error)
    return errorResponse(
      500,
      'INTERNAL_ERROR',
      '処理に失敗しました。時間をおいてもう一度お試しください。',
    )
  }
}
