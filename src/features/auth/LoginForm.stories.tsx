import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { LoginForm } from './LoginForm'

const meta = {
  component: LoginForm,
  args: {
    onAuthenticated: () => undefined,
  },
  parameters: {
    layout: 'centered',
  },
  render: (args) => (
    <div className="w-[min(28rem,calc(100vw-2rem))]">
      <LoginForm {...args} />
    </div>
  ),
  title: 'Features/Auth/LoginForm',
} satisfies Meta<typeof LoginForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { name: '通常' }
