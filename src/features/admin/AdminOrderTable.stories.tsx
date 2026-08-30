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
        <div className="mt-8">
          <Story />
        </div>
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
  name: '通常',
}

export const Empty: Story = {
  args: { items: [], status: 'success' },
  name: '注文なし',
}

export const Loading: Story = {
  args: { status: 'loading' },
  name: '読み込み中',
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
  name: '更新中',
}

export const Conflict: Story = {
  args: {
    conflictLatest: { ...adminOrderFixture, status: 'processing', version: 2 },
    conflictOrderId: adminOrderFixture.id,
    items: [adminOrderFixture],
    onAcknowledgeConflict: () => undefined,
    status: 'success',
  },
  name: '競合',
}

export const Error: Story = {
  args: { onRetry: () => undefined, status: 'error' },
  name: '取得エラー',
}
