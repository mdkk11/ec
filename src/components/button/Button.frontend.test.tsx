import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Button } from './Button'

describe('Button', () => {
  it('accessible nameとdisabled状態をnative buttonへ渡す', () => {
    render(<Button disabled>保存する</Button>)

    expect(screen.getByRole('button', { name: '保存する' })).toBeDisabled()
  })
})
