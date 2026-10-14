import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, LoaderCircle, LockKeyhole } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '../lib/api'
import { useAuth } from '../auth/useAuth'
import { useTheme } from '../theme/useTheme'

export function LoginPage() {
  const { login } = useAuth()
  const { theme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const notice = (location.state as { notice?: string } | null)?.notice
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const logoSrc = theme === 'dark' ? '/fluide-logo-white.png' : '/fluide-logo.png'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      await login(email.trim(), password)
      const destination = (location.state as { from?: string } | null)?.from
        ?? `${location.pathname}${location.search}`
      navigate(destination, { replace: true })
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to sign in. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="login-heading">
        <img className="login-logo" src={logoSrc} alt="Fluidé Homes" />
        <p className="eyebrow">People. Appraisals. Progress.</p>
        <h1 id="login-heading">Welcome back</h1>
        <p className="login-intro">Sign in to your Fluidé Homes workspace.</p>

        {notice && <p className="login-notice" role="status">{notice}</p>}

        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="email">Work email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@fluidehomes.com"
            required
          />

          <div className="password-label-row">
            <label htmlFor="password">Password</label>
          </div>
          <div className="password-input-wrap">
            <LockKeyhole size={16} aria-hidden="true" />
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              required
            />
            <button
              className="password-visibility"
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>

          {error && <p className="form-error" role="alert">{error}</p>}

          <button className="sign-in-button" type="submit" disabled={isSubmitting}>
            {isSubmitting && <LoaderCircle size={16} className="loading-icon" aria-hidden="true" />}
            {isSubmitting ? 'Signing in' : 'Sign in'}
          </button>
        </form>
        <p className="login-footnote">Access is managed by your HR administrator.</p>
      </section>
      <footer className="login-footer">FLUIDÉ HOMES <span>·</span> People. Appraisals. Progress.</footer>
    </main>
  )
}
