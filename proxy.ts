import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: list => {
        list.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })
  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  // redirects must carry any refreshed session cookies
  const redirect = (to: string) => {
    const res = NextResponse.redirect(new URL(to, request.url))
    response.cookies.getAll().forEach(c => res.cookies.set(c))
    return res
  }

  if (pathname === '/auth/callback') return response
  if (pathname === '/login') return user ? redirect('/') : response
  if (user) return response
  return redirect('/login')
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|.*\\.(?:png|jpg|jpeg|svg|webp|ico|css|js)$).*)'],
}
