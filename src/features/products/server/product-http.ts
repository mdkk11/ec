import { NextResponse } from 'next/server'

export const productResponseHeaders = {
  'Cache-Control': 'no-store',
}

export function productErrorResponse(
  status: number,
  code: string,
  message: string,
) {
  return NextResponse.json(
    { code, message },
    { headers: productResponseHeaders, status },
  )
}
