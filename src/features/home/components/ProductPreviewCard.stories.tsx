import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { previewProducts } from '@/features/home/home-content'

import { ProductPreviewCard } from './ProductPreviewCard'

const meta = {
  title: 'Features/Home/ProductPreviewCard',
  component: ProductPreviewCard,
  args: {
    product: previewProducts[0],
  },
  decorators: [
    (Story) => (
      <div className="w-[min(21rem,calc(100vw-2rem))]">
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ProductPreviewCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { name: '通常' }
