import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { cartFixture, emptyCartFixture, stockConflictCartFixture } from './cart-fixtures'
import { CartLoadingView, CartView } from './CartView'

const meta = {
  component: CartView,
  parameters: {
    layout: 'fullscreen',
  },
  title: 'Features/Cart/Cart',
} satisfies Meta<typeof CartView>

export default meta
type Story = StoryObj<typeof meta>

const handlers = {
  onApplyCoupon: () => undefined,
  onCheckout: () => undefined,
  onDelete: () => undefined,
  onRemoveCoupon: () => undefined,
  onUpdate: () => undefined,
}

export const Default: Story = {
  args: { cart: cartFixture, ...handlers },
  name: '通常',
}

export const Empty: Story = {
  args: { cart: emptyCartFixture, ...handlers },
  name: '空のカート',
}

export const Loading: Story = {
  args: { cart: cartFixture, ...handlers },
  name: '読み込み中',
  render: () => (
    <CartLoadingView statusMessage="カートを読み込んでいます。しばらくお待ちください。" />
  ),
}

export const Updating: Story = {
  args: {
    cart: cartFixture,
    operationState: {
      errors: [],
      pending: [
        {
          itemId: cartFixture.items[0]!.id,
          kind: 'update',
          quantity: 2,
        },
      ],
    },
    ...handlers,
  },
  name: '更新中',
}

export const StockConflict: Story = {
  args: { cart: stockConflictCartFixture, ...handlers },
  name: '在庫競合',
}
