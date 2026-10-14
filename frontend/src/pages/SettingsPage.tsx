import { useEffect, useState } from 'react'
import {
  AlertCircle,
  Check,
  LogOut,
  Moon,
  Shield,
  Sun,
  UserRound,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { useTheme } from '../theme/useTheme'
import { ApiError, api } from '../lib/api'

export function SettingsPage() {
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [devices, setDevices] = useState<Array<{ id: string; label: string | null; lastUsedAt: string }>>([])
  const [replacementDeviceId, setReplacementDeviceId] = useState('')
  const [replacementReason, setReplacementReason] = useState('')
  const [deviceNotice, setDeviceNotice] = useState('')
  const [deviceError, setDeviceError] = useState('')
  const [requestingReplacement, setRequestingReplacement] = useState(false)

  useEffect(() => {
    api.get<typeof devices>('/security/my-devices').then(setDevices).catch(() => setDevices([]))
  }, [])

  async function signOut() {
    setIsSigningOut(true)
    try {
      await logout()
      navigate('/login', { replace: true })
    } catch {
      navigate('/login', {
        replace: true,
        state: { notice: 'You were signed out on this device, but the server could not confirm session revocation.' },
      })
    }
  }

  async function requestReplacement() {
    if (!replacementDeviceId || replacementReason.trim().length < 5) return
    setRequestingReplacement(true); setDeviceError(''); setDeviceNotice('')
    try {
      await api.post('/security/replacement-requests', { deviceId: replacementDeviceId, reason: replacementReason.trim() })
      setDeviceNotice('Request sent to a super admin. The selected device remains active until approval.')
      setReplacementReason('')
    } catch (cause) { setDeviceError(cause instanceof ApiError ? cause.message : 'Unable to submit device replacement request.') }
    finally { setRequestingReplacement(false) }
  }

  if (!user) {
    return <div className="employees-state" role="status"><AlertCircle size={19} />Account details are unavailable.</div>
  }

  const displayName = user.employee
    ? `${user.employee.firstName} ${user.employee.lastName}`
    : 'No employee profile linked'

  return (
    <section className="settings-page" aria-label="Account settings">
      <div className="admin-intro">
        <span className="employee-summary-icon"><UserRound size={18} /></span>
        <div><p className="eyebrow">PREFERENCES &amp; ACCOUNT</p><h2>Settings</h2><p>Manage your display preference and review your account access.</p></div>
      </div>

      <section className="settings-section" aria-labelledby="appearance-title">
        <div className="settings-section-heading"><div><p className="eyebrow">DISPLAY</p><h3 id="appearance-title">Appearance</h3><p>Choose the theme for this browser. Your selection is saved automatically.</p></div><Check size={17} aria-hidden="true" /></div>
        <div className="settings-theme-options">
          <button className={`settings-theme-card${theme === 'light' ? ' is-selected' : ''}`} type="button" onClick={() => setTheme('light')} aria-pressed={theme === 'light'}>
            <span className="settings-theme-preview settings-theme-preview-light"><span /><i /><i /></span>
            <span className="settings-theme-label"><Sun size={15} /> Light mode</span>
            {theme === 'light' && <span className="settings-theme-selected"><Check size={13} /> Selected</span>}
          </button>
          <button className={`settings-theme-card${theme === 'dark' ? ' is-selected' : ''}`} type="button" onClick={() => setTheme('dark')} aria-pressed={theme === 'dark'}>
            <span className="settings-theme-preview settings-theme-preview-dark"><span /><i /><i /></span>
            <span className="settings-theme-label"><Moon size={15} /> Dark mode</span>
            {theme === 'dark' && <span className="settings-theme-selected"><Check size={13} /> Selected</span>}
          </button>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="account-title">
        <div className="settings-section-heading"><div><p className="eyebrow">ACCOUNT</p><h3 id="account-title">Your account</h3><p>Account details provided by your Fluidé Homes HRM profile.</p></div><UserRound size={17} aria-hidden="true" /></div>
        <dl className="settings-account-grid">
          <div><dt>Name</dt><dd>{displayName}</dd></div>
          <div><dt>Email</dt><dd>{user.email}</dd></div>
          <div><dt>Account status</dt><dd><span className={`employee-status admin-status-${user.status.toLowerCase()}`}>{user.status.charAt(0) + user.status.slice(1).toLowerCase()}</span></dd></div>
          <div><dt>Employee number</dt><dd>{user.employee?.employeeNumber ?? 'Not linked'}</dd></div>
          <div className="settings-account-full"><dt>Assigned roles</dt><dd>{user.roles.length ? <div className="admin-role-pills">{user.roles.map((role) => <span key={role}>{role}</span>)}</div> : 'No roles assigned'}</dd></div>
        </dl>
      </section>

      <section className="settings-section" aria-labelledby="access-title">
        <div className="settings-section-heading"><div><p className="eyebrow">AUTHORIZATION</p><h3 id="access-title">Permissions</h3><p>Your access is determined by roles assigned to your account.</p></div><Shield size={17} aria-hidden="true" /></div>
        <details className="settings-permissions">
          <summary>View {user.permissions.length} assigned permissions</summary>
          {user.permissions.length
            ? <div className="admin-role-pills">{[...user.permissions].sort((a, b) => a.localeCompare(b)).map((permission) => <span key={permission}>{permission}</span>)}</div>
            : <p className="admin-muted">No permissions are assigned to this account.</p>}
        </details>
      </section>

      <section className="settings-section settings-signout" aria-labelledby="session-title">
        <div className="settings-section-heading"><div><p className="eyebrow">SESSION</p><h3 id="session-title">Sign out</h3><p>End your current session on this browser.</p></div><LogOut size={17} aria-hidden="true" /></div>
        <button className="button-secondary" type="button" onClick={() => void signOut()} disabled={isSigningOut}><LogOut size={15} />{isSigningOut ? 'Signing out…' : 'Sign out of this account'}</button>
      </section>
      <section className="settings-section" aria-labelledby="device-replacement-title">
        <div className="settings-section-heading"><div><p className="eyebrow">DEVICE SECURITY</p><h3 id="device-replacement-title">Registered devices</h3><p>Each account can have up to two active devices. Ask a super admin to approve a replacement if you need to change devices.</p></div><Shield size={17} aria-hidden="true" /></div>
        {deviceError && <p className="employee-form-error" role="alert"><AlertCircle size={15} />{deviceError}</p>}
        {deviceNotice && <p className="employee-inline-warning" role="status"><Check size={15} />{deviceNotice}</p>}
        {devices.length ? <>
          <div className="security-record-list">{devices.map((device) => <article key={device.id}><div><strong>{device.label || 'Registered browser'}</strong><span>Last used {new Date(device.lastUsedAt).toLocaleString()}</span></div></article>)}</div>
          <label>Device to replace<select value={replacementDeviceId} onChange={(event) => setReplacementDeviceId(event.target.value)}><option value="">Select a registered device</option>{devices.map((device) => <option key={device.id} value={device.id}>{device.label || 'Registered browser'} · {new Date(device.lastUsedAt).toLocaleDateString()}</option>)}</select></label>
          <label>Reason for replacement<textarea rows={2} maxLength={500} value={replacementReason} onChange={(event) => setReplacementReason(event.target.value)} placeholder="For example, this device was lost or replaced" /></label>
          <button className="button-secondary" type="button" disabled={requestingReplacement || !replacementDeviceId || replacementReason.trim().length < 5} onClick={() => void requestReplacement()}>{requestingReplacement ? 'Sending request…' : 'Request device replacement'}</button>
        </> : <p className="admin-muted">No active device registrations were returned. Sign in again to register this browser.</p>}
      </section>
      <p className="settings-readonly-note"><AlertCircle size={14} />Account information and permissions are read-only here. Contact an administrator to change account details or access.</p>
    </section>
  )
}
