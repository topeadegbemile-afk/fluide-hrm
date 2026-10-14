import { useEffect, useState } from 'react'
import { AlertCircle, Check, LoaderCircle, RotateCw, Shield, Trash2 } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { ApiError, api } from '../lib/api'

type Office = { id: string; name: string; code: string; address: string; isActive: boolean; approvedNetworks: string[]; networkConfiguredAt: string | null; configuredBy: { id: string; email: string } | null; _count: { employees: number } }
type Device = { id: string; userId: string; label: string | null; userAgent: string | null; lastIpAddress: string | null; lastUsedAt: string; createdAt: string; user: { id: string; email: string; employee: { firstName: string; lastName: string; employeeNumber: string } | null } }
type Event = { id: string; eventType: string; outcome: string; reason: string | null; ipAddress: string | null; createdAt: string; userEmail: string | null }
type Replacement = { id: string; reason: string; createdAt: string; user: { email: string }; device: { label: string | null; lastUsedAt: string } }
type Settings = { attendanceOfficeEnforcement: boolean; unassignedEmployeeCount: number }

export function SecurityPage() {
  const { user } = useAuth()
  const [offices, setOffices] = useState<Office[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [requests, setRequests] = useState<Replacement[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [networks, setNetworks] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const isSuperAdmin = user?.roles.includes('SUPER_ADMIN') ?? false

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [officeRows, deviceRows, eventRows, replacementRows, securitySettings] = await Promise.all([
        api.get<Office[]>('/security/offices'), api.get<Device[]>('/security/devices'), api.get<Event[]>('/security/events'),
        api.get<Replacement[]>('/security/replacement-requests'), api.get<Settings>('/security/settings'),
      ])
      setOffices(officeRows); setNetworks(Object.fromEntries(officeRows.map((office) => [office.id, office.approvedNetworks.join('\n')])))
      setDevices(deviceRows); setEvents(eventRows); setRequests(replacementRows); setSettings(securitySettings)
    } catch (cause) { setError(cause instanceof ApiError ? cause.message : 'Unable to load security settings.') }
    finally { setLoading(false) }
  }
  useEffect(() => { if (isSuperAdmin) void load() }, [isSuperAdmin])

  async function saveNetworks(office: Office) {
    setBusy(office.id); setError(''); setNotice('')
    try {
      const approvedNetworks = networks[office.id].split(/[\r\n,]+/).map((value) => value.trim()).filter(Boolean)
      await api.patch(`/security/offices/${office.id}/networks`, { approvedNetworks })
      setNotice(`${office.name} network configuration saved.`); await load()
    } catch (cause) { setError(cause instanceof ApiError ? cause.message : 'Unable to save network configuration.') }
    finally { setBusy('') }
  }
  async function setEnforcement(enabled: boolean) {
    setBusy('enforcement'); setError(''); setNotice('')
    try { const value = await api.patch<Settings>('/security/settings/attendance-enforcement', { enabled }); setSettings(value); setNotice(`Attendance network enforcement ${enabled ? 'enabled' : 'disabled'}.`) }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : 'Unable to change enforcement.') }
    finally { setBusy('') }
  }
  async function setOfficeActive(office: Office) {
    setBusy(`status-${office.id}`); setError(''); setNotice('')
    try { await api.patch(`/security/offices/${office.id}/status`, { isActive: !office.isActive }); setNotice(`${office.name} ${office.isActive ? 'deactivated' : 'activated'}.`); await load() }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : 'Unable to update office status.') }
    finally { setBusy('') }
  }
  async function revoke(device: Device) {
    if (!window.confirm(`Revoke ${device.label || 'this device'} for ${device.user.email}?`)) return
    setBusy(device.id); setError('')
    try { await api.delete(`/security/devices/${device.id}`); setNotice('Device revoked. Existing access and refresh sessions are invalid.'); await load() }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : 'Unable to revoke device.') }
    finally { setBusy('') }
  }
  async function approve(request: Replacement) {
    setBusy(request.id); setError('')
    try { await api.post(`/security/replacement-requests/${request.id}/approve`, {}); setNotice(`Replacement approved for ${request.user.email}; they can register a new device.`); await load() }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : 'Unable to approve request.') }
    finally { setBusy('') }
  }
  async function reject(request: Replacement) {
    setBusy(request.id); setError('')
    try { await api.post(`/security/replacement-requests/${request.id}/reject`, {}); setNotice(`Replacement request rejected for ${request.user.email}.`); await load() }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : 'Unable to reject request.') }
    finally { setBusy('') }
  }

  if (!isSuperAdmin) return <section className="module-placeholder access-denied" role="alert"><div className="placeholder-icon"><AlertCircle size={21} /></div><div><h2>Access restricted</h2><p>Only super admins can manage security settings.</p></div></section>
  if (loading) return <div className="employees-state" role="status"><LoaderCircle className="loading-icon" size={19} />Loading security settings…</div>

  return <section className="settings-page" aria-label="Security administration">
    <div className="admin-intro"><span className="employee-summary-icon"><Shield size={18} /></span><div><p className="eyebrow">ACCESS CONTROL</p><h2>Security administration</h2><p>Manage office networks, registered devices, replacement approvals, and security events.</p></div><button className="icon-button" type="button" onClick={() => void load()} aria-label="Refresh security data"><RotateCw size={16} /></button></div>
    {error && <p className="employee-form-error" role="alert"><AlertCircle size={15} />{error}</p>}{notice && <p className="employee-inline-warning" role="status"><Check size={15} />{notice}</p>}
    <section className="settings-section"><div className="settings-section-heading"><div><p className="eyebrow">ATTENDANCE SECURITY</p><h3>Office network enforcement</h3><p>When enabled, clock-in and clock-out require the employee’s assigned office network. Unconfigured or inactive offices are denied.</p></div><span className={`employee-status ${settings?.attendanceOfficeEnforcement ? 'employee-status-active' : 'employee-status-inactive'}`}>{settings?.attendanceOfficeEnforcement ? 'Enabled' : 'Disabled'}</span></div>
      {offices.some((office) => office.isActive && (!office.approvedNetworks.length || !office.networkConfiguredAt)) && <p className="employee-inline-warning"><AlertCircle size={15} />One or more active offices have no verified network yet. Enforcement cannot be enabled until each is configured.</p>}
      {(settings?.unassignedEmployeeCount ?? 0) > 0 && <p className="employee-inline-warning"><AlertCircle size={15} />{settings?.unassignedEmployeeCount} employee(s) still need an office assignment before enforcement can be enabled.</p>}
      <button className={settings?.attendanceOfficeEnforcement ? 'button-secondary' : 'button-primary'} type="button" disabled={busy === 'enforcement'} onClick={() => void setEnforcement(!settings?.attendanceOfficeEnforcement)}>{settings?.attendanceOfficeEnforcement ? 'Disable enforcement' : 'Enable enforcement'}</button>
    </section>
    <section className="settings-section"><div className="settings-section-heading"><div><p className="eyebrow">OFFICE CONFIGURATION</p><h3>Approved networks</h3><p>Enter only networks verified by the office network administrator. Do not enter guessed addresses.</p></div></div>
      {offices.map((office) => <article className="security-office-card" key={office.id}><div><h4>{office.name} ({office.code})</h4><p>{office.address}</p><small>{office._count.employees} employees assigned · {office.networkConfiguredAt ? `Configured by ${office.configuredBy?.email ?? 'administrator'}` : 'NOT CONFIGURED'} · {office.isActive ? 'Active' : 'Inactive'}</small></div><label>Approved IPv4/IPv6 addresses or CIDR ranges<textarea rows={3} value={networks[office.id] ?? ''} onChange={(event) => setNetworks((current) => ({ ...current, [office.id]: event.target.value }))} placeholder={'One verified address or CIDR per line'} /></label><div className="appraisal-heading-actions"><button className="button-secondary" type="button" disabled={busy === office.id} onClick={() => void saveNetworks(office)}>{busy === office.id ? 'Saving…' : 'Save network configuration'}</button><button className="button-secondary" type="button" disabled={busy === `status-${office.id}`} onClick={() => void setOfficeActive(office)}>{office.isActive ? 'Deactivate office' : 'Activate office'}</button></div></article>)}
    </section>
    <section className="settings-section"><div className="settings-section-heading"><div><p className="eyebrow">DEVICE SECURITY</p><h3>Active devices <span className="field-optional">Maximum two per account</span></h3><p>Revocation invalidates existing access requests and refresh tokens.</p></div></div>
      <div className="security-record-list">{devices.length ? devices.map((device) => <article key={device.id}><div><strong>{device.user.employee ? `${device.user.employee.firstName} ${device.user.employee.lastName}` : device.user.email}</strong><span>{device.label || 'Registered browser'} · {device.user.email} · Last used {new Date(device.lastUsedAt).toLocaleString()}</span></div><button className="icon-button" type="button" disabled={busy === device.id} onClick={() => void revoke(device)} aria-label="Revoke device"><Trash2 size={15} /></button></article>) : <p className="admin-muted">No registered devices.</p>}</div>
    </section>
    <section className="settings-section"><div className="settings-section-heading"><div><p className="eyebrow">APPROVALS</p><h3>Device replacement requests</h3></div></div>
      <div className="security-record-list">{requests.length ? requests.map((request) => <article key={request.id}><div><strong>{request.user.email}</strong><span>{request.reason} · {request.device.label || 'Device'} · {new Date(request.createdAt).toLocaleString()}</span></div><div className="appraisal-heading-actions"><button className="button-secondary" type="button" disabled={busy === request.id} onClick={() => void approve(request)}>Approve and revoke old device</button><button className="button-secondary" type="button" disabled={busy === request.id} onClick={() => void reject(request)}>Reject</button></div></article>) : <p className="admin-muted">No pending requests.</p>}</div>
    </section>
    <section className="settings-section"><div className="settings-section-heading"><div><p className="eyebrow">MONITORING</p><h3>Recent security events</h3><p>Latest 500 immutable security events.</p></div></div>
      <div className="security-record-list">{events.map((event) => <article key={event.id}><div><strong>{event.eventType} · {event.outcome}</strong><span>{event.reason ?? ''} · {event.userEmail ?? 'System'} · {event.ipAddress ?? 'IP unavailable'} · {new Date(event.createdAt).toLocaleString()}</span></div></article>)}</div>
    </section>
  </section>
}
