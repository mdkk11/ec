import { NextResponse } from 'next/server'
import type { ZodType } from 'zod'

import type { ApiError } from '@/contracts/api-error'

const noStoreHeaders = {
  'Cache-Control': 'no-store',
}

type JsonRequestParseResult<T> = { ok: true; data: T } | { ok: false; response: Response }

function validationFieldErrors(error: { issues: { message: string; path: PropertyKey[] }[] }) {
  const fieldErrors: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const field = issue.path[0]
    if (typeof field !== 'string') continue
    fieldErrors[field] ??= []
    fieldErrors[field].push(issue.message)
  }
  return Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined
}

export function noStoreJsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, { headers: noStoreHeaders, status })
}

export function apiErrorResponse(
  status: number,
  code: string,
  message: string,
  fieldErrors?: Record<string, string[]>,
) {
  const body: ApiError = {
    code,
    message,
    ...(fieldErrors ? { fieldErrors } : {}),
  }
  return noStoreJsonResponse(body, status)
}

export async function parseJsonRequest<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<JsonRequestParseResult<T>> {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return {
      ok: false,
      response: apiErrorResponse(400, 'VALIDATION_ERROR', '入力内容を確認してください。'),
    }
  }

  const parsed = schema.safeParse(payload)
  if (!parsed.success) {
    return {
      ok: false,
      response: apiErrorResponse(
        400,
        'VALIDATION_ERROR',
        '入力内容を確認してください。',
        validationFieldErrors(parsed.error),
      ),
    }
  }

  return { data: parsed.data, ok: true }
}
