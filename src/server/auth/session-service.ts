import type { Temporal } from '@js-temporal/polyfill'
import { and, eq, gt } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import type { NormalizedLoginRequest, UserDto } from '@/contracts/session'
import { sessions, users } from '@/server/db/schema'

import { DUMMY_PASSWORD_HASH, verifyPassword } from './password'
import { createSessionExpiration } from './session-cookie'
import { createSessionToken, hashSessionToken } from './session-token'

type LoginDependencies = {
  createToken?: () => string
  db: NodePgDatabase
  now: Temporal.Instant
}

type SessionDependencies = {
  db: NodePgDatabase
  now: Temporal.Instant
}

function toUserDto(user: {
  email: string
  id: string
  role: 'admin' | 'customer'
}): UserDto {
  return {
    email: user.email,
    id: user.id,
    role: user.role,
  }
}

export async function loginWithPassword(
  input: NormalizedLoginRequest,
  { createToken = createSessionToken, db, now }: LoginDependencies,
) {
  const [user] = await db
    .select({
      email: users.email,
      id: users.id,
      passwordHash: users.passwordHash,
      role: users.role,
    })
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1)

  const passwordMatches = await verifyPassword(
    input.password,
    user?.passwordHash ?? DUMMY_PASSWORD_HASH,
  )
  if (!user || !passwordMatches) return null

  const token = createToken()
  const expiresAt = createSessionExpiration(now)

  await db.insert(sessions).values({
    createdAt: now.toString(),
    expiresAt: expiresAt.toString(),
    tokenHash: hashSessionToken(token),
    userId: user.id,
  })

  return {
    expiresAt,
    token,
    user: toUserDto(user),
  }
}

export async function resolveSessionActor(
  token: string,
  { db, now }: SessionDependencies,
) {
  const [record] = await db
    .select({
      email: users.email,
      expiresAt: sessions.expiresAt,
      id: users.id,
      role: users.role,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.tokenHash, hashSessionToken(token)),
        gt(sessions.expiresAt, now.toString()),
      ),
    )
    .limit(1)

  return record ? toUserDto(record) : null
}

export async function deleteSession(
  token: string,
  { db, now }: SessionDependencies,
) {
  const deleted = await db
    .delete(sessions)
    .where(
      and(
        eq(sessions.tokenHash, hashSessionToken(token)),
        gt(sessions.expiresAt, now.toString()),
      ),
    )
    .returning({ id: sessions.id })

  return deleted.length > 0
}
