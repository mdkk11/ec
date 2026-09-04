import { describe, expect, it } from 'vitest'

import { loginRequestSchema, sessionResponseSchema } from './session'

describe('session contract', () => {
  it('emailだけをtrim・lowercaseし、passwordはそのまま保持する', () => {
    expect(
      loginRequestSchema.parse({
        email: '  CUSTOMER@EXAMPLE.TEST ',
        password: ' password with spaces ',
      }),
    ).toEqual({
      email: 'customer@example.test',
      password: ' password with spaces ',
    })
  })

  it('空欄と長すぎる入力を拒否する', () => {
    expect(loginRequestSchema.safeParse({ email: '', password: '' }).success).toBe(false)
    expect(
      loginRequestSchema.safeParse({
        email: `${'a'.repeat(244)}@example.test`,
        password: 'p'.repeat(257),
      }).success,
    ).toBe(false)
  })

  it('UserDtoにpassword hashを含めない', () => {
    const result = sessionResponseSchema.parse({
      user: {
        email: 'customer@example.test',
        id: '10000000-0000-4000-8000-000000000001',
        passwordHash: 'secret',
        role: 'customer',
      },
    })

    expect(result).toEqual({
      user: {
        email: 'customer@example.test',
        id: '10000000-0000-4000-8000-000000000001',
        role: 'customer',
      },
    })
  })
})
