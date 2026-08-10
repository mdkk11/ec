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

export const Primary: Story = { name: 'プライマリ' }

export const Secondary: Story = {
  args: { variant: 'secondary' },
  name: 'セカンダリ',
}

export const Text: Story = {
  args: { variant: 'text' },
  name: 'テキスト',
}

export const Disabled: Story = {
  args: { disabled: true, children: '処理中' },
  name: '無効',
}
