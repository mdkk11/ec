import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { adminOrderFixture } from './admin-order-fixtures'
import { AdminOrderTable } from './AdminOrderTable'

const meta = {
  component: AdminOrderTable,
  decorators: [
    (Story) => (
      <main className="page-wrap py-12">
        <p className="label text-accent">ADMINISTRATION</p>
        <h1 className="mt-4 font-serif text-4xl">注文管理</h1>
        <div className="mt-8"><Story /></div>
      </main>
    ),
  ],
  parameters: { layout: 'fullscreen' },
  title: 'Features/Admin/AdminOrderTable',
} satisfies Meta<typeof AdminOrderTable>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    items: [adminOrderFixture],
    onSelectStatus: () => undefined,
    onUpdate: () => undefined,
    status: 'success',
  },
}

export const Empty: Story = {
  args: { items: [], status: 'success' },
}

export const Loading: Story = {
  args: { status: 'loading' },
}

export const Updating: Story = {
  args: {
    items: [adminOrderFixture],
    onSelectStatus: () => undefined,
    onUpdate: () => undefined,
    pendingOrderId: adminOrderFixture.id,
    selectedStatuses: { [adminOrderFixture.id]: 'processing' },
    status: 'success',
  },
}

export const Conflict: Story = {
  args: {
    conflictLatest: { ...adminOrderFixture, status: 'processing', version: 2 },
    conflictOrderId: adminOrderFixture.id,
    items: [adminOrderFixture],
    onAcknowledgeConflict: () => undefined,
    status: 'success',
  },
}

export const Error: Story = {
  args: { onRetry: () => undefined, status: 'error' },
}
