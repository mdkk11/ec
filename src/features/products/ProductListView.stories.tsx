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
}

export const Empty: Story = {
  args: {
    items: [],
    status: 'success',
  },
}

export const Loading: Story = {
  args: {
    status: 'loading',
  },
}

export const Error: Story = {
  args: {
    status: 'error',
  },
}
