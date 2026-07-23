import { useEffect, useState } from 'react'
import { http, HttpResponse } from 'msw'
import { render, screen } from '@testing-library/react'
import { z } from 'zod'
import { describe, expect, it } from 'vitest'

import { server } from '@/test/msw/server'

import { requestJson, requestNoContent } from './request-json'

const smokeResponseSchema = z.object({ message: z.string() })

function ApiClientSmoke() {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    void requestJson('/api/test/smoke', smokeResponseSchema).then((response) => {
      setMessage(response.message)
    })
  }, [])

  return <p aria-live="polite">{message ?? '読み込み中'}</p>
}

describe('API client smoke', () => {
  it('MSWを通してschema検証済みのレスポンスを表示する', async () => {
    server.use(
      http.get('http://localhost:3000/api/test/smoke', () => {
        return HttpResponse.json(smokeResponseSchema.parse({ message: '接続できました' }))
      }),
    )

    render(<ApiClientSmoke />)

    expect(screen.getByText('読み込み中')).toBeInTheDocument()
    expect(await screen.findByText('接続できました')).toBeInTheDocument()
  })

  it('bodyのない204レスポンスを成功として扱う', async () => {
    server.use(
      http.delete('http://localhost:3000/api/test/no-content', () => {
        return new HttpResponse(null, { status: 204 })
      }),
    )

    await expect(
      requestNoContent('/api/test/no-content', { method: 'DELETE' }),
    ).resolves.toBeUndefined()
  })

  it('外部originのURLを拒否する', async () => {
    await expect(
      requestJson('https://example.com/api/test/smoke', smokeResponseSchema),
    ).rejects.toThrow('同一生成元')
  })
})
