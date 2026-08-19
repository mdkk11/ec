import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import {
  SessionProvider,
  type SessionState,
} from '@/features/auth/SessionProvider'
import { HomePage } from '@/features/home/HomePage'

import { SiteFooter } from './SiteFooter'
import { SiteHeader } from './SiteHeader'

function StorefrontShell({ initialState }: { initialState: SessionState }) {
  return (
    <SessionProvider initialState={initialState}>
      <div className="grid min-h-screen grid-rows-[auto_1fr_auto] bg-surface">
        <SiteHeader />
        <main id="main-content">
          <HomePage />
        </main>
        <SiteFooter />
      </div>
    </SessionProvider>
  )
}

const meta = {
  args: { initialState: { status: 'anonymous' } },
  component: StorefrontShell,
  parameters: {
    layout: 'fullscreen',
  },
  title: 'Layout/StorefrontShell',
} satisfies Meta<typeof StorefrontShell>

export default meta
type Story = StoryObj<typeof meta>

export const Anonymous: Story = { name: '匿名' }

const openAccountMenu = ({ canvasElement }: { canvasElement: HTMLElement }) => {
  canvasElement.querySelector('summary')?.click()
}

export const CustomerMenu: Story = {
  args: {
    initialState: {
      status: 'authenticated',
      user: {
        email: 'customer@example.test',
        id: '10000000-0000-4000-8000-000000000001',
        role: 'customer',
      },
    },
  },
  name: '購入者メニュー',
  play: openAccountMenu,
}

export const AdminMenu: Story = {
  args: {
    initialState: {
      status: 'authenticated',
      user: {
        email: 'admin@example.test',
        id: '20000000-0000-4000-8000-000000000001',
        role: 'admin',
      },
    },
  },
  name: '管理者メニュー',
  play: openAccountMenu,
}
