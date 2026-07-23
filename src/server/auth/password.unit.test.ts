import { describe, expect, it } from 'vitest'

import {
  DUMMY_PASSWORD_HASH,
  hashPassword,
  verifyPassword,
} from './password'

describe('scrypt password', () => {
  it('同じpasswordとsaltから決定的なhashを生成して検証できる', async () => {
    const hash = await hashPassword(
      'CustomerPass123!',
      Buffer.from('mockshop-cust-v1'),
    )

    expect(hash).toMatch(/^scrypt\$v1\$16384\$8\$1\$/u)
    await expect(verifyPassword('CustomerPass123!', hash)).resolves.toBe(true)
    await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false)
  })

  it.each([
    '',
    'argon2$v1$16384$8$1$c2FsdA$hash',
    'scrypt$v2$16384$8$1$c2FsdA$hash',
    'scrypt$v1$1$8$1$c2FsdA$hash',
    'scrypt$v1$16384$8$1$invalid!$invalid!',
  ])('不正な保存形式を拒否する: %s', async (hash) => {
    await expect(verifyPassword('password', hash)).resolves.toBe(false)
  })

  it('未知email用dummy hashも同じscrypt形式で検証する', async () => {
    await expect(
      verifyPassword('dummy-password-not-used', DUMMY_PASSWORD_HASH),
    ).resolves.toBe(true)
  })
})
