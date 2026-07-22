import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { Button } from './Button'

const meta = {
  title: 'Components/Button',
  component: Button,
  args: {
    children: '続ける',
  },
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Primary: Story = {}

export const Secondary: Story = {
  args: { variant: 'secondary' },
}

export const Text: Story = {
  args: { variant: 'text' },
}

export const Disabled: Story = {
  args: { disabled: true, children: '処理中' },
}
