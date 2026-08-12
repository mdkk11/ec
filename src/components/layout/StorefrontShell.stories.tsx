import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { SessionProvider } from '@/features/auth/SessionProvider'
import { HomePage } from '@/features/home/HomePage'

import { SiteFooter } from './SiteFooter'
import { SiteHeader } from './SiteHeader'

function StorefrontShell() {
  return (
    <SessionProvider initialState={{ status: 'anonymous' }}>
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
  title: 'Layout/StorefrontShell',
  component: StorefrontShell,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof StorefrontShell>

export default meta
type Story = StoryObj<typeof meta>

export const Anonymous: Story = { name: '匿名' }
