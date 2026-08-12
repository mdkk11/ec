import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { CouponForm } from './CouponForm'

const appliedCoupon = {
  code: 'WELCOME15',
  discountPercent: 15,
  endsAt: '2099-01-01T00:00:00Z',
  minimumSubtotal: 10_000,
  startsAt: '2020-01-01T00:00:00Z',
}

const meta = {
  args: {
    coupon: null,
    onApply: () => undefined,
    onRemove: () => undefined,
  },
  component: CouponForm,
  decorators: [
    (Story) => (
      <div className="w-[min(22rem,calc(100vw-2rem))] bg-surface p-6">
        <h2 className="sr-only">注文合計</h2>
        <Story />
      </div>
    ),
  ],
  parameters: { layout: 'centered' },
  title: 'Features/Coupons/CouponForm',
} satisfies Meta<typeof CouponForm>

export default meta
type Story = StoryObj<typeof meta>

export const BeforeApply: Story = { name: '適用前' }

export const Applied: Story = {
  args: { coupon: appliedCoupon },
  name: '適用済み',
}

export const InputError: Story = {
  args: {
    errorMessage: 'クーポンが見つかりませんでした。',
  },
  name: '入力エラー',
}

export const Expired: Story = {
  args: {
    coupon: appliedCoupon,
    issueCode: 'COUPON_EXPIRED',
  },
  name: '期限切れ',
}
