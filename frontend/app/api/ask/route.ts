import { NextRequest } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000'

export async function POST(request: NextRequest) {
  const body = await request.json()

  const response = await fetch(`${BACKEND_URL}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const error = await response.text()
    return Response.json({ error }, { status: response.status })
  }

  const data = await response.json()
  return Response.json(data)
}
