import {
  loginRequestSchema,
  sessionResponseSchema,
  type LoginRequest,
} from '@/contracts/session'

import { requestJson, requestNoContent } from './request-json'

export function getCurrentSession() {
  return requestJson('/api/session', sessionResponseSchema)
}

export function login(input: LoginRequest) {
  const normalizedInput = loginRequestSchema.parse(input)

  return requestJson('/api/session', sessionResponseSchema, {
    body: JSON.stringify(normalizedInput),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })
}

export function logout() {
  return requestNoContent('/api/session', {
    method: 'DELETE',
  })
}
