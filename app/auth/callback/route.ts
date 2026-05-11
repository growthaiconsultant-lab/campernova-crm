import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // Sync authId to the User row on first login
      await db.user.updateMany({
        where: { email: data.user.email!, authId: null },
        data: { authId: data.user.id },
      })

      // Block inactive users before they reach the app
      const dbUser = await db.user.findUnique({
        where: { email: data.user.email! },
        select: { active: true },
      })
      if (!dbUser?.active) {
        return NextResponse.redirect(`${origin}/login?error=inactive`)
      }

      return NextResponse.redirect(`${origin}/dashboard`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=callback`)
}
