import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

const SCRYPT_VERSION = 'v1'
const SCRYPT_N = 16_384
const SCRYPT_R = 8
const SCRYPT_P = 1
const SCRYPT_KEY_LENGTH = 64
const SCRYPT_SALT_LENGTH = 16
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024

export const DUMMY_PASSWORD_HASH =
  'scrypt$v1$16384$8$1$bW9ja3Nob3AtZHVtbXktcw$43T4SfQXyn8IypJ5-BdUGbmXX6kLWChOQKnqE6gbInUXKi50dhdKEHRCO4udFmHc3W4cDmJ4uKAobRmWNx7zLw'

function derivePassword(password: string, salt: Uint8Array) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password,
      salt,
      SCRYPT_KEY_LENGTH,
      {
        N: SCRYPT_N,
        p: SCRYPT_P,
        r: SCRYPT_R,
        maxmem: SCRYPT_MAX_MEMORY,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error)
          return
        }
        resolve(derivedKey)
      },
    )
  })
}

function decodeBase64Url(value: string, expectedLength: number) {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) return null

  const decoded = Buffer.from(value, 'base64url')
  if (decoded.length !== expectedLength || decoded.toString('base64url') !== value) {
    return null
  }
  return decoded
}

export async function hashPassword(
  password: string,
  salt: Uint8Array = randomBytes(SCRYPT_SALT_LENGTH),
) {
  if (salt.byteLength !== SCRYPT_SALT_LENGTH) {
    throw new RangeError(`scrypt saltは${SCRYPT_SALT_LENGTH} bytesである必要があります。`)
  }

  const derivedKey = await derivePassword(password, salt)
  return [
    'scrypt',
    SCRYPT_VERSION,
    String(SCRYPT_N),
    String(SCRYPT_R),
    String(SCRYPT_P),
    Buffer.from(salt).toString('base64url'),
    derivedKey.toString('base64url'),
  ].join('$')
}

export async function verifyPassword(password: string, encodedHash: string) {
  const [algorithm, version, n, r, p, encodedSalt, encodedKey, ...rest] = encodedHash.split('$')

  if (
    rest.length > 0 ||
    algorithm !== 'scrypt' ||
    version !== SCRYPT_VERSION ||
    n !== String(SCRYPT_N) ||
    r !== String(SCRYPT_R) ||
    p !== String(SCRYPT_P) ||
    !encodedSalt ||
    !encodedKey
  ) {
    return false
  }

  const salt = decodeBase64Url(encodedSalt, SCRYPT_SALT_LENGTH)
  const expectedKey = decodeBase64Url(encodedKey, SCRYPT_KEY_LENGTH)
  if (!salt || !expectedKey) return false

  const actualKey = await derivePassword(password, salt)
  return timingSafeEqual(actualKey, expectedKey)
}
