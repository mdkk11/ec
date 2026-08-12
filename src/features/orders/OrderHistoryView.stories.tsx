import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { OrderHistoryView } from './OrderHistoryView'
import { orderFixture } from './order-fixtures'

const meta = {
  component: OrderHistoryView,
  parameters: {
    layout: 'fullscreen',
  },
  title: 'Features/Orders/OrderHistory',
} satisfies Meta<typeof OrderHistoryView>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    items: [orderFixture],
    status: 'success',
  },
  name: '通常',
}

export const Empty: Story = {
  args: {
    items: [],
    status: 'success',
  },
  name: '注文なし',
}

export const Loading: Story = {
  args: {
    status: 'loading',
  },
  name: '読み込み中',
}

export const Error: Story = {
  args: {
    onRetry: () => undefined,
    status: 'error',
  },
  name: '取得エラー',
}
