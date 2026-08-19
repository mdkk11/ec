import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { adminProductFixture } from './admin-product-fixtures'
import { AdminProductList } from './AdminProductList'

const meta = {
  component: AdminProductList,
  decorators: [
    (Story) => (
      <div className="page-wrap py-12">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: 'fullscreen' },
  title: 'Features/Admin/AdminProductList',
} satisfies Meta<typeof AdminProductList>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    items: [
      adminProductFixture,
      {
        ...adminProductFixture,
        id: '30000000-0000-4000-8000-000000000002',
        imagePath: '/images/home/suede-sneakers.jpg',
        isPublished: false,
        name: 'スエード コートスニーカー',
        price: 22_000,
        stock: 0,
        version: 5,
      },
    ],
  },
  name: '通常',
}

export const Empty: Story = {
  args: { items: [] },
  name: '空',
}
