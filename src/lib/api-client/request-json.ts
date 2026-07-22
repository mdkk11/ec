import type { z } from 'zod'

import { apiErrorSchema, type ApiError } from '@/contracts/api-error'

export type ApiClientErrorKind = 'http' | 'network' | 'invalid_response'

type ApiClientErrorOptions = {
  cause?: unknown
  error?: ApiError
  status?: number
}

export class ApiClientError extends Error {
  readonly kind: ApiClientErrorKind
  readonly status?: number
  readonly code?: string
  readonly fieldErrors?: ApiError['fieldErrors']

  constructor(kind: ApiClientErrorKind, message: string, options: ApiClientErrorOptions = {}) {
    super(message, { cause: options.cause })
    this.name = 'ApiClientError'
    this.kind = kind
    this.status = options.status
    this.code = options.error?.code
    this.fieldErrors = options.error?.fieldErrors
  }
}

function resolveUrl(path: string) {
  if (!path.startsWith('/api/')) {
    throw new TypeError('API clientには同一生成元の/api/パスを指定してください。')
  }
  if (typeof window !== 'undefined') return new URL(path, window.location.origin)
  return path
}

async function fetchApi(path: string, init: RequestInit) {
  const url = resolveUrl(path)
  const headers = new Headers(init.headers)
  if (!headers.has('Accept')) headers.set('Accept', 'application/json')

  try {
    return await fetch(url, { ...init, headers })
  } catch (cause) {
    throw new ApiClientError('network', 'サーバーへ接続できませんでした。', { cause })
  }
}

async function throwHttpError(response: Response): Promise<never> {
  let payload: unknown
  try {
    payload = await response.json()
  } catch (cause) {
    throw new ApiClientError('invalid_response', 'サーバーから不正なエラー応答を受け取りました。', {
      cause,
      status: response.status,
    })
  }

  const parsedError = apiErrorSchema.safeParse(payload)
  if (!parsedError.success) {
    throw new ApiClientError('invalid_response', 'サーバーから不正なエラー応答を受け取りました。', {
      cause: parsedError.error,
      status: response.status,
    })
  }

  throw new ApiClientError('http', parsedError.data.message, {
    error: parsedError.data,
    status: response.status,
  })
}

export async function requestJson<TSchema extends z.ZodType>(
  path: string,
  responseSchema: TSchema,
  init: RequestInit = {},
): Promise<z.output<TSchema>> {
  const response = await fetchApi(path, init)

  if (!response.ok) await throwHttpError(response)

  let payload: unknown
  try {
    payload = await response.json()
  } catch (cause) {
    throw new ApiClientError('invalid_response', 'サーバーから不正な応答を受け取りました。', {
      cause,
      status: response.status,
    })
  }

  const parsedResponse = responseSchema.safeParse(payload)
  if (!parsedResponse.success) {
    throw new ApiClientError('invalid_response', 'サーバーから不正な応答を受け取りました。', {
      cause: parsedResponse.error,
      status: response.status,
    })
  }

  return parsedResponse.data
}

export async function requestNoContent(path: string, init: RequestInit = {}): Promise<void> {
  const response = await fetchApi(path, init)

  if (!response.ok) await throwHttpError(response)
  if (response.status !== 204) {
    throw new ApiClientError('invalid_response', 'サーバーから不正な応答を受け取りました。', {
      status: response.status,
    })
  }
}
