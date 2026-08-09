import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { adminProductFixture } from './admin-product-fixtures'
import {
  AdminProductForm,
  type AdminProductFormValues,
} from './AdminProductForm'

const values: AdminProductFormValues = {
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
          <div className="mt-8"><Story /></div>
        </div>
      </main>
    ),
  ],
  parameters: { layout: 'fullscreen' },
  title: 'Features/Admin/AdminProductForm',
} satisfies Meta<typeof AdminProductForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const InputError: Story = {
  args: {
    fieldErrors: {
      name: ['商品名を入力してください。'],
      price: ['価格は0以上で入力してください。'],
      stock: ['在庫数は整数で入力してください。'],
    },
    values: { ...values, name: '', price: '-1', stock: '1.5' },
  },
}

export const Updating: Story = {
  args: { pending: true },
}

export const Conflict: Story = {
  args: {
    blocked: true,
    conflictProduct: {
      ...adminProductFixture,
      isPublished: false,
      price: 30_800,
      stock: 5,
      version: 4,
    },
    onAcceptLatest: () => undefined,
    values: { ...values, name: '入力中の商品名', price: '29700', stock: '10' },
  },
}
