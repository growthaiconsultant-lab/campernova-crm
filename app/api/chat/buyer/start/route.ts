import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { BUYER_GREETING } from '@/lib/chat/system-prompt'

async function verifyHCaptcha(token: string): Promise<boolean> {
  const res = await fetch('https://hcaptcha.com/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      secret: process.env.HCAPTCHA_SECRET_KEY ?? '',
      response: token,
    }),
  })
  const json = (await res.json()) as { success: boolean }
  return json.success
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { captchaToken?: string }

    if (!body.captchaToken) {
      return NextResponse.json({ error: 'captcha_required' }, { status: 400 })
    }

    const captchaOk = await verifyHCaptcha(body.captchaToken)
    if (!captchaOk) {
      return NextResponse.json({ error: 'captcha_failed' }, { status: 400 })
    }

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('x-real-ip') ??
      null

    // Rate limit: max 3 new sessions per IP per day
    if (ip) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const count = await db.buyerChatSession.count({
        where: { ipAddress: ip, startedAt: { gte: since } },
      })
      if (count >= 3) {
        return NextResponse.json({ error: 'rate_limit' }, { status: 429 })
      }
    }

    const initialMessage = {
      role: 'assistant',
      content: BUYER_GREETING,
      timestamp: new Date().toISOString(),
    }

    const session = await db.buyerChatSession.create({
      data: {
        sessionToken: `csk_${crypto.randomUUID().replace(/-/g, '')}`,
        messages: [initialMessage],
        ipAddress: ip,
        userAgent: req.headers.get('user-agent'),
      },
    })

    return NextResponse.json({ sessionToken: session.sessionToken, greeting: BUYER_GREETING })
  } catch (err) {
    console.error('[chat/buyer/start]', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
