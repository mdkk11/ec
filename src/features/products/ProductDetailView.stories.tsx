import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { Button } from '@/components/button/Button'

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
    purchaseAction: (
      <Button className="mt-7 w-full">1点カートに追加</Button>
    ),
    status: 'success',
  },
  name: '通常',
}

export const OutOfStock: Story = {
  args: {
    product: outOfStockProductFixture,
    purchaseAction: (
      <Button className="mt-7 w-full" disabled>
        在庫切れ
      </Button>
    ),
    status: 'success',
  },
  name: '在庫切れ',
}

export const LongContent: Story = {
  args: {
    product: longProductFixture,
    purchaseAction: (
      <Button className="mt-7 w-full">1点カートに追加</Button>
    ),
    status: 'success',
  },
  name: '長い商品名・説明',
}
