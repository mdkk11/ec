import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { AdminProductEditLoadingView, AdminProductsLoadingView } from './AdminProductLoadingViews'

const statusMessage = '商品を読み込んでいます。しばらくお待ちください。'

const meta = {
  component: AdminProductsLoadingView,
  parameters: { layout: 'fullscreen' },
  title: 'Features/Admin/AdminProductLoading',
} satisfies Meta<typeof AdminProductsLoadingView>

export default meta
type Story = StoryObj<typeof meta>

export const List: Story = {
  args: { statusMessage },
  name: '商品一覧読み込み中',
}

export const Edit: Story = {
  args: { statusMessage },
  name: '商品編集読み込み中',
  render: (args) => <AdminProductEditLoadingView {...args} />,
}
