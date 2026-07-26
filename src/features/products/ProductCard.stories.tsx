import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import {
  longProductFixture,
  outOfStockProductFixture,
  productFixture,
} from './product-fixtures'
import { ProductCard } from './ProductCard'

const meta = {
  args: {
    product: productFixture,
  },
  component: ProductCard,
  decorators: [
    (Story) => (
      <div className="w-[min(22rem,calc(100vw-2rem))]">
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: 'centered',
  },
  title: 'Features/Products/ProductCard',
} satisfies Meta<typeof ProductCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const OutOfStock: Story = {
  args: {
    product: outOfStockProductFixture,
  },
}

export const LongName: Story = {
  args: {
    product: longProductFixture,
  },
}
