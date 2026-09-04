import type { UserDto, UserRole } from '@/contracts/session'

type AuthorizationFailure = 'FORBIDDEN' | 'UNAUTHENTICATED'

export type AuthorizationResult =
  | { actor: UserDto; ok: true }
  | { code: AuthorizationFailure; ok: false }

function requireRole(actor: UserDto | null, expectedRole: UserRole): AuthorizationResult {
  if (!actor) return { code: 'UNAUTHENTICATED', ok: false }
  if (actor.role !== expectedRole) return { code: 'FORBIDDEN', ok: false }
  return { actor, ok: true }
}

export function requireCustomer(actor: UserDto | null) {
  return requireRole(actor, 'customer')
}

export function requireAdmin(actor: UserDto | null) {
  return requireRole(actor, 'admin')
}
