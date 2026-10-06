import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

// Email links (confirm sign-up, reset password) land here.
export async function GET(request: Request) {
  const url = new URL(request.url)
  const next = url.searchParams.get('next')
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
  const supabase = await createClient()

  const code = url.searchParams.get('code')
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') as EmailOtpType | null
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type ? await supabase.auth.verifyOtp({ type, token_hash: tokenHash }) : { error: new Error('Missing code') }

  if (error) return NextResponse.redirect(new URL('/login?error=link', url.origin))
  return NextResponse.redirect(new URL(safeNext, url.origin))
}
