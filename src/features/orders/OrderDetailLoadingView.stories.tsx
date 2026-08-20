import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { OrderDetailLoadingView } from './OrderDetailLoadingView'

const meta = {
  component: OrderDetailLoadingView,
  parameters: {
    layout: 'fullscreen',
  },
  title: 'Features/Orders/OrderDetailLoading',
} satisfies Meta<typeof OrderDetailLoadingView>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
