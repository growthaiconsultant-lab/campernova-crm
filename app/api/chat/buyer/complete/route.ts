import { NextResponse } from 'next/server'

// Lead creation is now handled server-side in /api/chat/buyer/message via tool use.
export async function POST() {
  return NextResponse.json(
    {
      error: 'deprecated',
      message: 'Lead creation is now handled server-side in /api/chat/buyer/message',
    },
    { status: 410 }
  )
}
