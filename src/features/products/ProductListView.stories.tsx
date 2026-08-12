import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { productListFixture } from './product-fixtures'
import { ProductListView } from './ProductListView'

const meta = {
  component: ProductListView,
  parameters: {
    layout: 'fullscreen',
  },
  title: 'Features/Products/ProductList',
} satisfies Meta<typeof ProductListView>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    items: productListFixture,
    status: 'success',
  },
  name: '通常',
}

export const Empty: Story = {
  args: {
    items: [],
    status: 'success',
  },
  name: '商品なし',
}

export const Loading: Story = {
  args: {
    status: 'loading',
  },
  name: '読み込み中',
}

export const Error: Story = {
  args: {
    status: 'error',
  },
  name: '取得エラー',
}
