import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  FileClock,
  LoaderCircle,
  RotateCw,
  Search,
  X,
} from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { ApiError, api } from '../lib/api'

type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'APPROVE' | 'REJECT' | 'ASSIGN' | 'EXPORT'
type AuditLog = {
  id: string
  entityType: string
  entityId: string | null
  action: AuditAction
  details: string | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
  actor: { firstName: string; lastName: string; employeeNumber: string } | null
  user: { id: string; email: string; status: string } | null
}
const actions: AuditAction[] = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'APPROVE', 'REJECT', 'ASSIGN', 'EXPORT']
const pageSize = 20

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function csvCell(value: string | null | undefined) {
  const normalized = value ?? ''
  const safeValue = /^[\t\r ]*[=+\-@]/.test(normalized) ? `'${normalized}` : normalized
  return `"${safeValue.replace(/"/g, '""')}"`
}

function exportAuditLogs(logs: AuditLog[]) {
  const rows = [
    ['Date and time', 'Action', 'Entity type', 'Entity ID', 'Actor', 'Account email', 'Details', 'IP address', 'User agent'],
    ...logs.map((log) => [
      log.createdAt,
      log.action,
      log.entityType,
      log.entityId,
      log.actor ? `${log.actor.firstName} ${log.actor.lastName} (${log.actor.employeeNumber})` : '',
      log.user?.email,
      log.details,
      log.ipAddress,
      log.userAgent,
    ]),
  ]
  const blob = new Blob(['\uFEFF', rows.map((row) => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function AuditDetailsDialog({ log, onClose }: { log: AuditLog; onClose: () => void }) {
  return (
    <div className="employee-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="employee-dialog audit-details-dialog" role="dialog" aria-modal="true" aria-labelledby="audit-details-title">
        <header className="employee-dialog-header"><div><p className="eyebrow">AUDIT EVENT</p><h2 id="audit-details-title">{log.action} · {log.entityType}</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close audit event"><X size={19} /></button></header>
        <dl className="employee-detail-list">
          <div><dt>Time</dt><dd>{formatDateTime(log.createdAt)}</dd></div>
          <div><dt>Entity ID</dt><dd className="audit-value">{log.entityId ?? '—'}</dd></div>
          <div><dt>Actor</dt><dd>{log.actor ? `${log.actor.firstName} ${log.actor.lastName} · ${log.actor.employeeNumber}` : 'System / unknown'}</dd></div>
          <div><dt>Account</dt><dd>{log.user?.email ?? '—'}</dd></div>
          <div><dt>IP address</dt><dd>{log.ipAddress ?? '—'}</dd></div>
          <div className="employee-detail-full"><dt>User agent</dt><dd className="audit-value">{log.userAgent ?? '—'}</dd></div>
          <div className="employee-detail-full"><dt>Details</dt><dd className="audit-event-details">{log.details || 'No details recorded.'}</dd></div>
        </dl>
      </section>
    </div>
  )
}

export function AuditLogsPage() {
  const { hasPermission } = useAuth()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState<'ALL' | AuditAction>('ALL')
  const [entityFilter, setEntityFilter] = useState('ALL')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const canRead = hasPermission('audit:read')

  useEffect(() => {
    if (!canRead) return
    let cancelled = false
    void api.get<AuditLog[]>('/audit-logs').then((result) => {
      if (cancelled) return
      setLogs(result)
      setError('')
      setIsLoading(false)
    }).catch((cause: unknown) => {
      if (cancelled) return
      setLogs([])
      setError(cause instanceof ApiError ? cause.message : 'Unable to load audit logs.')
      setIsLoading(false)
    })
    return () => { cancelled = true }
  }, [canRead, reloadKey])

  const entities = useMemo(() => [...new Set(logs.map((log) => log.entityType))].sort((a, b) => a.localeCompare(b)), [logs])
  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase()
    return logs.filter((log) => {
      const eventDate = log.createdAt.slice(0, 10)
      const actorName = log.actor ? `${log.actor.firstName} ${log.actor.lastName} ${log.actor.employeeNumber}` : ''
      const searchable = [log.action, log.entityType, log.entityId, log.details, log.ipAddress, actorName, log.user?.email].filter(Boolean).join(' ').toLowerCase()
      return (actionFilter === 'ALL' || log.action === actionFilter)
        && (entityFilter === 'ALL' || log.entityType === entityFilter)
        && (!startDate || eventDate >= startDate)
        && (!endDate || eventDate <= endDate)
        && (!query || searchable.includes(query))
    })
  }, [actionFilter, endDate, entityFilter, logs, search, startDate])
  const totalPages = Math.ceil(filteredLogs.length / pageSize)
  const currentPage = Math.min(page, Math.max(totalPages, 1))
  const visibleLogs = filteredLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  function reload() {
    setIsLoading(true)
    setError('')
    setReloadKey((key) => key + 1)
  }

  function clearFilters() {
    setSearch('')
    setActionFilter('ALL')
    setEntityFilter('ALL')
    setStartDate('')
    setEndDate('')
    setPage(1)
  }

  if (!canRead) return <section className="module-placeholder access-denied" role="alert"><div className="placeholder-icon"><AlertCircle size={21} /></div><div><h2>Access restricted</h2><p>Your account does not have permission to view audit logs.</p></div></section>

  return (
    <section className="admin-page" aria-label="Audit logs">
      <div className="admin-intro"><span className="employee-summary-icon"><FileClock size={18} /></span><div><p className="eyebrow">SECURITY &amp; ACCOUNTABILITY</p><h2>Audit logs</h2><p>Review recorded account activity and administrative changes.</p></div></div>
      <div className="admin-summary-row"><span><strong>{logs.length}</strong> recorded events</span><div className="admin-summary-actions"><button className="button-secondary" type="button" onClick={() => exportAuditLogs(filteredLogs)} disabled={!filteredLogs.length}><Download size={15} /> Export CSV</button><button className="icon-button employee-refresh" type="button" onClick={reload} disabled={isLoading} aria-label="Refresh audit logs">{isLoading ? <LoaderCircle className="loading-icon" size={17} /> : <RotateCw size={16} />}</button></div></div>
      <div className="admin-toolbar audit-toolbar">
        <label className="employee-search"><Search size={16} /><span className="sr-only">Search audit logs</span><input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search actor, account, event, or details…" /></label>
        <label className="employee-status-filter"><span>Action</span><select value={actionFilter} onChange={(event) => { setActionFilter(event.target.value as 'ALL' | AuditAction); setPage(1) }}><option value="ALL">All actions</option>{actions.map((action) => <option key={action} value={action}>{action}</option>)}</select></label>
        <label className="employee-status-filter"><span>Entity</span><select value={entityFilter} onChange={(event) => { setEntityFilter(event.target.value); setPage(1) }}><option value="ALL">All entities</option>{entities.map((entity) => <option key={entity} value={entity}>{entity}</option>)}</select></label>
        <label className="admin-date-filter"><span>From</span><input type="date" value={startDate} max={endDate || undefined} onChange={(event) => { setStartDate(event.target.value); setPage(1) }} /></label>
        <label className="admin-date-filter"><span>To</span><input type="date" value={endDate} min={startDate || undefined} onChange={(event) => { setEndDate(event.target.value); setPage(1) }} /></label>
        <button className="text-button audit-clear-filters" type="button" onClick={clearFilters}>Clear filters</button>
      </div>
      {error ? <div className="employees-state employees-error" role="alert"><AlertCircle size={20} /><div><h2>Audit logs unavailable</h2><p>{error}</p><button className="text-button" type="button" onClick={reload}><RotateCw size={14} /> Try again</button></div></div>
        : isLoading ? <div className="employees-state" role="status"><LoaderCircle className="loading-icon" size={19} />Loading audit events…</div>
        : !filteredLogs.length ? <div className="employees-state empty-directory"><FileClock size={22} /><h2>{logs.length ? 'No matching events' : 'No audit events recorded'}</h2><p>{logs.length ? 'Adjust filters to see more events.' : 'Audit events will appear here as activity is recorded.'}</p></div>
        : <div className="admin-table-wrap"><table className="admin-table audit-table"><thead><tr><th>Time</th><th>Action</th><th>Entity</th><th>Actor</th><th>Account</th><th><span className="sr-only">Details</span></th></tr></thead><tbody>{visibleLogs.map((log) => (
          <tr key={log.id}><td>{formatDateTime(log.createdAt)}</td><td><span className={`audit-action audit-action-${log.action.toLowerCase()}`}>{log.action}</span></td><td><strong>{log.entityType}</strong><span className="admin-audit-id">{log.entityId ?? '—'}</span></td><td>{log.actor ? <><strong>{log.actor.firstName} {log.actor.lastName}</strong><span>{log.actor.employeeNumber}</span></> : <span className="admin-muted">System / unknown</span>}</td><td>{log.user?.email ?? '—'}</td><td><button className="button-secondary audit-view-button" type="button" onClick={() => setSelectedLog(log)}>Details</button></td></tr>
        ))}</tbody></table><div className="employee-table-footer"><span>Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredLogs.length)} of {filteredLogs.length} matching ({logs.length} total)</span>{totalPages > 1 && <div className="employee-pagination"><button className="button-secondary" type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage <= 1}><ChevronLeft size={14} /> Previous</button><span>Page {currentPage} of {totalPages}</span><button className="button-secondary" type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={currentPage >= totalPages}>Next <ChevronRight size={14} /></button></div>}</div></div>}
      {selectedLog && <AuditDetailsDialog log={selectedLog} onClose={() => setSelectedLog(null)} />}
    </section>
  )
}
