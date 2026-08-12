import { describe, expect, it } from 'vitest'

import { ApiClientError } from '@/lib/api-client/request-json'

import {
  checkoutFeedbackAfterRefresh,
  decideCheckoutError,
  initialCheckoutFeedback,
} from './cartCheckoutFeedback'

function httpError(status: number, code: string, message = 'APIエラー') {
  return new ApiClientError('http', message, {
    error: { code, message },
    status,
  })
}

describe('注文確定feedback', () => {
  it('401はsessionをanonymousにするactionを返す', () => {
    const actual = decideCheckoutError(httpError(401, 'UNAUTHENTICATED'))

    expect(actual).toEqual({ type: 'unauthenticated' })
  })

  it.each([
    {
      code: 'CHECKOUT_CHANGED',
      expected:
        '注文内容が変更されました。最新の内容を確認し、もう一度注文を確定してください。',
      status: 409,
    },
    {
      code: 'STOCK_CONFLICT',
      expected:
        '在庫が変更されました。最新のカートを確認し、数量を調整してください。',
      status: 409,
    },
    {
      code: 'EMPTY_CART',
      expected: 'カートの内容が変更されました。最新の状態を確認してください。',
      status: 400,
    },
  ])('$codeは原因別messageとcart再取得actionを返す', ({ code, expected, status }) => {
    const actual = decideCheckoutError(httpError(status, code))

    expect(actual).toEqual({
      feedback: { ...initialCheckoutFeedback, message: expected },
      type: 'refresh-cart',
    })
  })

  it.each(['network', 'invalid_response'] as const)(
    '%sは注文結果の確認を要求する',
    (kind) => {
      const actual = decideCheckoutError(new ApiClientError(kind, '失敗'))

      expect(actual).toEqual({
        feedback: {
          ...initialCheckoutFeedback,
          confirmationRequired: true,
          errorMessage:
            '注文結果を確認できませんでした。注文履歴または最新のカートを確認してから、もう一度お試しください。',
        },
        type: 'show-feedback',
      })
    },
  )

  it('通常のAPIエラーはサーバーmessageを表示する', () => {
    const actual = decideCheckoutError(
      httpError(500, 'INTERNAL_ERROR', '時間をおいてもう一度お試しください。'),
    )

    expect(actual).toEqual({
      feedback: {
        ...initialCheckoutFeedback,
        errorMessage: '時間をおいてもう一度お試しください。',
      },
      type: 'show-feedback',
    })
  })

  it('未知errorは共通messageを表示する', () => {
    const actual = decideCheckoutError(new Error('unknown'))

    expect(actual).toEqual({
      feedback: {
        ...initialCheckoutFeedback,
        errorMessage:
          '注文を確定できませんでした。時間をおいてもう一度お試しください。',
      },
      type: 'show-feedback',
    })
  })

  it('注文結果不明後の再取得成功は再送前の確認messageへ更新する', () => {
    const actual = checkoutFeedbackAfterRefresh(
      {
        ...initialCheckoutFeedback,
        confirmationRequired: true,
        errorMessage: '注文結果を確認できませんでした。',
      },
      false,
    )

    expect(actual).toEqual({
      ...initialCheckoutFeedback,
      message:
        '最新のカートを取得しました。注文履歴も確認してから、もう一度お試しください。',
    })
  })

  it('確認不要の再取得成功は現在のfeedbackを保持して失敗状態を解除する', () => {
    const current = {
      ...initialCheckoutFeedback,
      message: '最新のカートを確認してください。',
      refreshFailed: true,
    }
    const actual = checkoutFeedbackAfterRefresh(current, false)

    expect(actual).toEqual({ ...current, refreshFailed: false })
  })

  it('cart再取得失敗は現在のfeedbackを保持して失敗状態にする', () => {
    const current = {
      ...initialCheckoutFeedback,
      message: '最新のカートを確認してください。',
    }
    const actual = checkoutFeedbackAfterRefresh(current, true)

    expect(actual).toEqual({ ...current, refreshFailed: true })
  })
})
