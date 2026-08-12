import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { publicCategoryCatalog } from '@/features/categories/category-catalog'

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
    categories: publicCategoryCatalog,
    items: productListFixture,
    selectedCategory: null,
    status: 'success',
  },
  name: '通常',
}

export const Empty: Story = {
  args: {
    categories: publicCategoryCatalog,
    items: [],
    selectedCategory: null,
    status: 'success',
  },
  name: '商品なし',
}

export const CategorySelected: Story = {
  args: {
    categories: publicCategoryCatalog,
    items: productListFixture.filter(
      ({ category }) => category.slug === 'clothing',
    ),
    selectedCategory: publicCategoryCatalog[0],
    status: 'success',
  },
  name: 'カテゴリ選択',
}

export const CategoryEmpty: Story = {
  args: {
    categories: publicCategoryCatalog,
    items: [],
    selectedCategory: publicCategoryCatalog[3],
    status: 'success',
  },
  name: 'カテゴリ商品なし',
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
