import { describe, expect, it } from 'vitest'

import { Temporal } from '@/lib/date-time/temporal'

import { createTestNow, TEST_NOW_ISO } from './time'

describe('createTestNow', () => {
  it('固定したUTC時刻をTemporal.Instantとして返す', () => {
    const now = createTestNow()

    expect(now).toBeInstanceOf(Temporal.Instant)
    expect(now.toString({ smallestUnit: 'millisecond' })).toBe(TEST_NOW_ISO)
  })
})
