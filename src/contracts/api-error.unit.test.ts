import { describe, expect, it } from 'vitest'

import { apiErrorSchema } from './api-error'

describe('apiErrorSchema', () => {
  it('field errorを含むAPIエラーを受理する', () => {
    const result = apiErrorSchema.safeParse({
      code: 'VALIDATION_ERROR',
      message: '入力内容を確認してください。',
      fieldErrors: {
        email: ['メールアドレスを入力してください。'],
      },
    })

    expect(result.success).toBe(true)
  })

  it.each([
    { message: 'codeがない', value: { message: 'エラーです。' } },
    { message: 'messageが空', value: { code: 'INTERNAL_ERROR', message: '' } },
    {
      message: 'fieldErrorsが文字列配列ではない',
      value: {
        code: 'VALIDATION_ERROR',
        message: '入力内容を確認してください。',
        fieldErrors: { email: '必須です。' },
      },
    },
  ])('$message場合は拒否する', ({ value }) => {
    expect(apiErrorSchema.safeParse(value).success).toBe(false)
  })
})
