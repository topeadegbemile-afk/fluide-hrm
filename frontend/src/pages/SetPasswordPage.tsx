import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ApiError, api } from '../lib/api'
import { useTheme } from '../theme/useTheme'

export function SetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { theme } = useTheme()
  const token = searchParams.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [complete, setComplete] = useState(false)
  const [saving, setSaving] = useState(false)
  const logoSrc = theme === 'dark' ? '/fluide-logo-white.png' : '/fluide-logo.png'

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!token) {
      setError('This password setup link is missing its token. Ask your administrator for a new invitation.')
      return
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match.')
      return
    }

    setSaving(true)
    try {
      await api.post<null>('/auth/set-password', { token, password })
      setComplete(true)
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to set your password. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="setup-password-heading">
        <img className="login-logo" src={logoSrc} alt="Fluidé Homes" />
        <p className="eyebrow">PEOPLE OPERATIONS</p>
        <h1 id="setup-password-heading">Set your password</h1>
        <p className="login-intro">Choose a password to access your Fluidé Homes workspace.</p>
        {complete ? (
          <>
            <p className="login-notice" role="status">Your password is ready. You can now sign in.</p>
            <button className="sign-in-button" type="button" onClick={() => navigate('/login', { replace: true })}>Go to sign in</button>
          </>
        ) : (
          <form className="login-form" onSubmit={submit}>
            <label htmlFor="new-password">New password</label>
            <input id="new-password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required />
            <label htmlFor="confirm-password">Confirm password</label>
            <input id="confirm-password" type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="sign-in-button" type="submit" disabled={saving}>
              {saving ? 'Saving password' : 'Set password'}
            </button>
          </form>
        )}
      </section>
      <footer className="login-footer">FLUIDÉ HOMES <span>·</span> PEOPLE OPERATIONS</footer>
    </main>
  )
}
