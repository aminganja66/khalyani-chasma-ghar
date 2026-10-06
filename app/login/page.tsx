'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { BrandLogo } from '@/components/brand-logo'
import { Eye, EyeOff, LogIn, Mail, UserPlus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Mode = 'signin' | 'signup' | 'forgot'

const friendly = (message: string) => {
  const m = message.toLowerCase()
  if (m.includes('invalid login')) return 'Wrong email or password'
  if (m.includes('email not confirmed')) return 'Please confirm your email first. Check your inbox for the link.'
  if (m.includes('already registered')) return 'An account with this email already exists. Try signing in.'
  if (m.includes('rate limit')) return 'Too many emails sent. Please wait a few minutes and try again.'
  if (m.includes('password should be')) return 'Password must be at least 6 characters'
  return message
}

function LoginForm() {
  const params = useSearchParams()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [shopName, setShopName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [mobile, setMobile] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState(params.get('error') === 'link' ? 'That link is invalid or has expired. Please try again.' : '')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  const switchMode = (m: Mode) => { setMode(m); setError(''); setInfo('') }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true); setError(''); setInfo('')
    const supabase = createClient()
    const origin = window.location.origin
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
        window.location.assign('/'); return
      }
      if (mode === 'signup') {
        const phone = mobile.replace(/\D/g, '')
        if (!shopName.trim()) throw new Error('Enter your shop name')
        if (!ownerName.trim()) throw new Error('Enter the owner name')
        if (phone && phone.length !== 10) throw new Error('Mobile number must be 10 digits, or leave it empty')
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${origin}/auth/callback`, data: { shop_name: shopName.trim(), owner_name: ownerName.trim(), phone } } })
        if (error) throw error
        if (data.session) { window.location.assign('/'); return }
        // Supabase hides whether an address is already registered; an empty identities list means it is.
        if (data.user && data.user.identities?.length === 0) throw new Error('already registered')
        setInfo(`We sent a confirmation link to ${email.trim()}. Open it to activate your account, then sign in.`)
        setMode('signin'); setPassword(''); setShopName(''); setOwnerName(''); setMobile('')
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${origin}/auth/callback?next=/reset-password` })
        if (error) throw error
        setInfo(`If ${email.trim()} has an account, a reset link is on its way.`)
      }
    } catch (err) {
      setError(friendly(err instanceof Error ? err.message : 'Something went wrong'))
    }
    setBusy(false)
  }

  const title = mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Reset password'
  const sub = mode === 'signin' ? 'Enter your email and password to open the shop dashboard.' : mode === 'signup' ? 'Sign up with your email. We will send a link to confirm it.' : 'Enter your email and we will send you a link to choose a new password.'

  return <main className="login-shell">
    <form className="login-card" onSubmit={submit}>
      <BrandLogo size="lg" />
      <h1>{title}</h1>
      <p className="login-sub">{sub}</p>
      {mode === 'signup' && <>
        <label>Shop name<input autoFocus autoComplete="organization" placeholder="e.g. Chasma Ghar" value={shopName} onChange={e => setShopName(e.target.value)} required /></label>
        <label>Owner name<input autoComplete="name" placeholder="Your full name" value={ownerName} onChange={e => setOwnerName(e.target.value)} required /></label>
        <label>Mobile number <span className="optional">(optional)</span><input type="tel" inputMode="numeric" autoComplete="tel" placeholder="10-digit mobile" value={mobile} onChange={e => setMobile(e.target.value)} /></label>
      </>}
      <label>Email<input type="email" autoFocus={mode !== 'signup'} autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
      {mode !== 'forgot' && <label>Password<span className="password-field"><input type={show ? 'text' : 'password'} minLength={6} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} required /><button type="button" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow(s => !s)}>{show ? <EyeOff /> : <Eye />}</button></span></label>}
      {error && <p className="login-error" role="alert">{error}</p>}
      {info && <p className="login-info" role="status">{info}</p>}
      <Button type="submit" className="login-submit" disabled={busy || !email || (mode !== 'forgot' && !password) || (mode === 'signup' && (!shopName.trim() || !ownerName.trim()))}>
        {mode === 'signin' ? <LogIn data-icon="inline-start" /> : mode === 'signup' ? <UserPlus data-icon="inline-start" /> : <Mail data-icon="inline-start" />}
        {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
      </Button>
      <div className="login-links">
        {mode === 'signin' && <><button type="button" onClick={() => switchMode('forgot')}>Forgot password?</button><button type="button" onClick={() => switchMode('signup')}>Create an account</button></>}
        {mode !== 'signin' && <button type="button" onClick={() => switchMode('signin')}>← Back to sign in</button>}
      </div>
    </form>
  </main>
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>
}
