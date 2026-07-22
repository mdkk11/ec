import { Temporal } from '@/lib/date-time/temporal'

export const TEST_NOW_ISO = '2026-01-15T03:00:00.000Z'

export function createTestNow() {
  return Temporal.Instant.from(TEST_NOW_ISO)
}
