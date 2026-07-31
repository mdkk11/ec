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
    onRetry: () => undefined,
    status: 'error',
  },
}
