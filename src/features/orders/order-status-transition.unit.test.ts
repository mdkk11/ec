import { describe, expect, it } from 'vitest'

import { canTransitionOrderStatus, getAllowedOrderStatuses } from './order-status-transition'

describe('注文状態遷移', () => {
  it('UNIT-ORDER-001: PRODUCTで定義した5遷移だけを許可する', () => {
    const allowed = [
      ['received', 'processing'],
      ['processing', 'shipped'],
      ['shipped', 'completed'],
      ['received', 'cancelled'],
      ['processing', 'cancelled'],
    ] as const

    for (const [from, to] of allowed) {
      expect(canTransitionOrderStatus(from, to)).toBe(true)
    }
  })

  it('UNIT-ORDER-002: 同一状態・逆方向・終端状態からの遷移を拒否する', () => {
    expect(canTransitionOrderStatus('received', 'received')).toBe(false)
    expect(canTransitionOrderStatus('processing', 'received')).toBe(false)
    expect(canTransitionOrderStatus('completed', 'cancelled')).toBe(false)
    expect(canTransitionOrderStatus('cancelled', 'received')).toBe(false)
    expect(getAllowedOrderStatuses('received')).toEqual(['processing', 'cancelled'])
  })
})
