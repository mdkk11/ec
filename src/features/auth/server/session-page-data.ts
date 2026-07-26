import 'server-only'

import { cookies } from 'next/headers'

import { sessionResponseSchema } from '@/contracts/session'
import type { SessionState } from '@/features/auth/SessionProvider'
import { Temporal } from '@/lib/date-time/temporal'
import { SESSION_COOKIE_NAME } from '@/server/auth/session-cookie'
import { resolveSessionActor } from '@/server/auth/session-service'
import { getRuntimeDatabase } from '@/server/db/runtime'

export async function loadInitialSessionState(): Promise<SessionState> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value
  if (!token) return { status: 'anonymous' }

  try {
    const user = await resolveSessionActor(token, {
      db: getRuntimeDatabase().db,
      now: Temporal.Now.instant(),
    })
    if (!user) return { status: 'anonymous' }

    return {
      status: 'authenticated',
      user: sessionResponseSchema.parse({ user }).user,
    }
  } catch (error) {
    console.error('初期セッションの取得に失敗しました。', error)
    return { status: 'error' }
  }
}
