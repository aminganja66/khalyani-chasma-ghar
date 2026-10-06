'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { BrandLogo } from '@/components/brand-logo'
import { Eye, EyeOff, KeyRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) return setError('Passwords do not match')
    setBusy(true); setError('')
    const { error } = await createClient().auth.updateUser({ password })
    if (error) { setError(error.message); setBusy(false); return }
    window.location.assign('/')
  }

  return <main className="login-shell">
    <form className="login-card" onSubmit={submit}>
      <BrandLogo size="lg" />
      <h1>Choose a new password</h1>
      <p className="login-sub">Pick a password you have not used before. At least 6 characters.</p>
      <label>New password<span className="password-field"><input type={show ? 'text' : 'password'} minLength={6} autoComplete="new-password" autoFocus value={password} onChange={e => setPassword(e.target.value)} required /><button type="button" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow(s => !s)}>{show ? <EyeOff /> : <Eye />}</button></span></label>
      <label>Confirm password<input type={show ? 'text' : 'password'} minLength={6} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} required /></label>
      {error && <p className="login-error" role="alert">{error}</p>}
      <Button type="submit" className="login-submit" disabled={busy || !password || !confirm}><KeyRound data-icon="inline-start" /> {busy ? 'Saving…' : 'Save password'}</Button>
    </form>
  </main>
}
