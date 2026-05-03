import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const sessionToken = req.nextUrl.searchParams.get('sessionToken')
  if (!sessionToken) {
    return NextResponse.json({ error: 'missing_token' }, { status: 400 })
  }
  const session = await db.buyerChatSession.findUnique({
    where: { sessionToken },
    select: { status: true, buyerLeadId: true },
  })
  if (!session) {
    return NextResponse.json({ error: 'session_not_found' }, { status: 404 })
  }
  return NextResponse.json({ status: session.status, buyerLeadId: session.buyerLeadId })
}
