import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { adminProductFixture } from './admin-product-fixtures'
import { AdminProductForm, type AdminProductFormValues } from './AdminProductForm'

const values: AdminProductFormValues = {
  categoryId: adminProductFixture.categoryId,
  description: adminProductFixture.description,
  imagePath: adminProductFixture.imagePath,
  isPublished: adminProductFixture.isPublished,
  name: adminProductFixture.name,
  price: String(adminProductFixture.price),
  stock: String(adminProductFixture.stock),
}

const meta = {
  args: {
    idPrefix: 'story-admin-product',
    includeStock: true,
    mode: 'edit',
    onChange: () => undefined,
    onSubmit: (event) => event.preventDefault(),
    values,
  },
  component: AdminProductForm,
  decorators: [
    (Story) => (
      <main className="page-wrap py-12">
        <div className="mx-auto max-w-3xl">
          <p className="label text-accent">ADMINISTRATION</p>
          <h1 className="mt-4 font-serif text-4xl">商品編集</h1>
          <div className="mt-8">
            <Story />
          </div>
        </div>
      </main>
    ),
  ],
  parameters: { layout: 'fullscreen' },
  title: 'Features/Admin/AdminProductForm',
} satisfies Meta<typeof AdminProductForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { name: '通常' }

export const InputError: Story = {
  args: {
    fieldErrors: {
      categoryId: ['カテゴリを選択してください。'],
      name: ['商品名を入力してください。'],
      price: ['価格は0以上で入力してください。'],
      stock: ['在庫数は整数で入力してください。'],
    },
    values: { ...values, categoryId: '', name: '', price: '-1', stock: '1.5' },
  },
  name: '入力エラー',
}

export const Updating: Story = {
  args: { pending: true },
  name: '更新中',
}

export const Conflict: Story = {
  args: {
    blocked: true,
    conflictProduct: {
      ...adminProductFixture,
      category: { name: 'バッグ・服飾小物', slug: 'bags-accessories' },
      categoryId: '40000000-0000-4000-8000-000000000002',
      isPublished: false,
      price: 30_800,
      stock: 5,
      version: 4,
    },
    onAcceptLatest: () => undefined,
    values: { ...values, name: '入力中の商品名', price: '29700', stock: '10' },
  },
  name: '競合',
}
