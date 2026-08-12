import { ApiClientError } from '@/lib/api-client/request-json'

export type CheckoutFeedback = {
  confirmationRequired: boolean
  errorMessage: string | null
  message: string | null
  refreshFailed: boolean
}

export type CheckoutErrorDecision =
  | { type: 'unauthenticated' }
  | { feedback: CheckoutFeedback; type: 'refresh-cart' | 'show-feedback' }

export const initialCheckoutFeedback: CheckoutFeedback = {
  confirmationRequired: false,
  errorMessage: null,
  message: null,
  refreshFailed: false,
}

const refreshMessages: Record<string, string> = {
  CHECKOUT_CHANGED:
    '注文内容が変更されました。最新の内容を確認し、もう一度注文を確定してください。',
  EMPTY_CART: 'カートの内容が変更されました。最新の状態を確認してください。',
  STOCK_CONFLICT:
    '在庫が変更されました。最新のカートを確認し、数量を調整してください。',
}

export function decideCheckoutError(error: unknown): CheckoutErrorDecision {
  if (error instanceof ApiClientError && error.status === 401) {
    return { type: 'unauthenticated' }
  }

  if (error instanceof ApiClientError && error.code) {
    const message = refreshMessages[error.code]
    if (message) {
      return {
        feedback: { ...initialCheckoutFeedback, message },
        type: 'refresh-cart',
      }
    }
  }

  const confirmationRequired =
    error instanceof ApiClientError &&
    (error.kind === 'network' || error.kind === 'invalid_response')
  return {
    feedback: {
      ...initialCheckoutFeedback,
      confirmationRequired,
      errorMessage: confirmationRequired
        ? '注文結果を確認できませんでした。注文履歴または最新のカートを確認してから、もう一度お試しください。'
        : error instanceof ApiClientError
          ? error.message
          : '注文を確定できませんでした。時間をおいてもう一度お試しください。',
    },
    type: 'show-feedback',
  }
}

export function checkoutFeedbackAfterRefresh(
  current: CheckoutFeedback,
  refreshFailed: boolean,
): CheckoutFeedback {
  if (refreshFailed || !current.confirmationRequired) {
    return { ...current, refreshFailed }
  }
  return {
    ...initialCheckoutFeedback,
    message:
      '最新のカートを取得しました。注文履歴も確認してから、もう一度お試しください。',
  }
}
