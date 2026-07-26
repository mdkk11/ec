import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import {
  longProductFixture,
  outOfStockProductFixture,
  productFixture,
} from './product-fixtures'
import { ProductDetailView } from './ProductDetailView'

const meta = {
  component: ProductDetailView,
  parameters: {
    layout: 'fullscreen',
  },
  title: 'Features/Products/ProductDetail',
} satisfies Meta<typeof ProductDetailView>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    product: productFixture,
    status: 'success',
  },
}

export const OutOfStock: Story = {
  args: {
    product: outOfStockProductFixture,
    status: 'success',
  },
}

export const LongContent: Story = {
  args: {
    product: longProductFixture,
    status: 'success',
  },
}
