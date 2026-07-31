import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import {
  cartFixture,
  emptyCartFixture,
  stockConflictCartFixture,
} from './cart-fixtures'
import { CartView } from './CartView'

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
}

export const Empty: Story = {
  args: { cart: emptyCartFixture, ...handlers },
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
}

export const StockConflict: Story = {
  args: { cart: stockConflictCartFixture, ...handlers },
}
