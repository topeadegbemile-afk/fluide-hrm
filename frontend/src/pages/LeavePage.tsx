import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  CalendarDays,
  Check,
  CirclePlus,
  Clock3,
  LoaderCircle,
  RotateCw,
  Search,
  X,
} from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { ApiError, api } from '../lib/api'

type LeaveType = 'ANNUAL' | 'SICK' | 'EMERGENCY' | 'MATERNITY' | 'PATERNITY' | 'STUDY' | 'UNPAID' | 'OTHER'
type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
type LeaveFilter = 'ALL' | LeaveStatus

type LeaveRecord = {
  id: string
  employeeId: string
  leaveType: LeaveType
  startDate: string
  endDate: string
  days: number
  reason: string
  status: LeaveStatus
  approvalComment: string | null
  rejectionReason: string | null
  requestedAt: string
  reviewedAt: string | null
  employee: { id: string; employeeNumber: string; firstName: string; lastName: string; email: string }
  approver?: { firstName: string; lastName: string } | null
}

type LeaveBalance = {
  employeeId: string
  annualDays: number
  sickDays: number
  carriedForwardDays: number
  usedDays: number
}

type LeaveFormValues = {
  leaveType: LeaveType
  startDate: string
  endDate: string
  reason: string
}

const leaveTypeLabels: Record<LeaveType, string> = {
  ANNUAL: 'Annual leave',
  SICK: 'Sick leave',
  EMERGENCY: 'Emergency leave',
  MATERNITY: 'Maternity leave',
  PATERNITY: 'Paternity leave',
  STUDY: 'Study leave',
  UNPAID: 'Unpaid leave',
  OTHER: 'Other',
}

const leaveStatusLabels: Record<LeaveStatus, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
}

const emptyLeaveForm: LeaveFormValues = {
  leaveType: 'ANNUAL',
  startDate: '',
  endDate: '',
  reason: '',
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(value))
}

function calendarDays(start: string, end: string) {
  if (!start || !end) return 0
  return Math.max(0, Math.floor((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1)
}

function LeaveRequestDialog({
  onClose,
  onSubmit,
}: {
  onClose: () => void
  onSubmit: (values: LeaveFormValues) => Promise<void>
}) {
  const [form, setForm] = useState(emptyLeaveForm)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const days = calendarDays(form.startDate, form.endDate)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onSubmit(form)
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to submit your leave request.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="employee-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="employee-dialog leave-dialog" role="dialog" aria-modal="true" aria-labelledby="leave-form-title">
        <header className="employee-dialog-header">
          <div><p className="eyebrow">TIME AWAY</p><h2 id="leave-form-title">Request leave</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close request form"><X size={19} /></button>
        </header>
        <form className="employee-form" onSubmit={(event) => void submit(event)}>
          <div className="employee-form-grid">
            <label className="employee-form-full">
              Leave type
              <select value={form.leaveType} onChange={(event) => setForm((current) => ({ ...current, leaveType: event.target.value as LeaveType }))}>
                {Object.entries(leaveTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>
              Start date
              <input type="date" value={form.startDate} onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))} required />
            </label>
            <label>
              End date
              <input type="date" value={form.endDate} min={form.startDate || undefined} onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))} required />
            </label>
            <p className="leave-duration">{days > 0 ? `${days} calendar ${days === 1 ? 'day' : 'days'} requested` : 'Choose the leave dates to see the duration.'}</p>
            <label className="employee-form-full">
              Reason
              <textarea value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} minLength={5} maxLength={1000} rows={4} required />
              <span className="field-optional">5–1,000 characters</span>
            </label>
          </div>
          {error && <p className="employee-form-error" role="alert"><AlertCircle size={15} />{error}</p>}
          <footer className="employee-dialog-actions">
            <button className="button-secondary" type="button" onClick={onClose}>Cancel</button>
            <button className="button-primary" type="submit" disabled={saving || !days || form.reason.trim().length < 5}>
              {saving ? 'Submitting…' : 'Submit request'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}

function LeaveDecisionDialog({
  kind,
  onClose,
  onSubmit,
}: {
  kind: 'approve' | 'reject'
  onClose: () => void
  onSubmit: (comment: string) => Promise<void>
}) {
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onSubmit(comment)
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : `Unable to ${kind} this request.`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="employee-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="employee-dialog leave-dialog" role="dialog" aria-modal="true" aria-labelledby="leave-decision-title">
        <header className="employee-dialog-header">
          <div><p className="eyebrow">LEAVE REVIEW</p><h2 id="leave-decision-title">{kind === 'approve' ? 'Approve request' : 'Reject request'}</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close review"><X size={19} /></button>
        </header>
        <form className="employee-form" onSubmit={(event) => void submit(event)}>
          <div className="employee-form-grid">
            <label className="employee-form-full">
              {kind === 'approve' ? 'Comment' : 'Reason for rejection'}
              {kind === 'approve' && <span className="field-optional">Optional</span>}
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                minLength={kind === 'reject' ? 5 : undefined}
                maxLength={kind === 'approve' ? 500 : 500}
                rows={4}
                required={kind === 'reject'}
              />
            </label>
          </div>
          {error && <p className="employee-form-error" role="alert"><AlertCircle size={15} />{error}</p>}
          <footer className="employee-dialog-actions">
            <button className="button-secondary" type="button" onClick={onClose}>Cancel</button>
            <button className="button-primary" type="submit" disabled={saving || (kind === 'reject' && comment.trim().length < 5)}>
              {saving ? 'Saving…' : kind === 'approve' ? 'Approve request' : 'Reject request'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}

export function LeavePage() {
  const { user, hasPermission } = useAuth()
  const [leaves, setLeaves] = useState<LeaveRecord[]>([])
  const [balance, setBalance] = useState<LeaveBalance | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<LeaveFilter>('ALL')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [balanceWarning, setBalanceWarning] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [showRequest, setShowRequest] = useState(false)
  const [decision, setDecision] = useState<{ kind: 'approve' | 'reject'; leave: LeaveRecord } | null>(null)
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')
  const [busyLeaveId, setBusyLeaveId] = useState<string | null>(null)
  const canRead = hasPermission('leave:read')
  const canCreate = hasPermission('leave:create')
  const canApprove = hasPermission('leave:approve')
  const canReject = hasPermission('leave:reject')

  useEffect(() => {
    if (!canRead) return
    let cancelled = false
    const requests: [Promise<LeaveRecord[]>, Promise<LeaveBalance>] = [
      api.get<LeaveRecord[]>('/leaves'),
      api.get<LeaveBalance>('/leaves/balance'),
    ]
    void Promise.allSettled(requests).then(([leaveResult, balanceResult]) => {
      if (cancelled) return
      if (leaveResult.status === 'fulfilled') {
        setLeaves(leaveResult.value)
        setError('')
      } else {
        const cause: unknown = leaveResult.reason
        setLeaves([])
        setError(cause instanceof ApiError ? cause.message : 'Unable to load leave requests.')
      }
      if (balanceResult.status === 'fulfilled') {
        setBalance(balanceResult.value)
        setBalanceWarning('')
      } else {
        setBalance(null)
        setBalanceWarning('Leave balance is unavailable for this account.')
      }
      setIsLoading(false)
    })
    return () => { cancelled = true }
  }, [canRead, reloadKey])

  const filteredLeaves = useMemo(() => {
    const query = search.trim().toLowerCase()
    return leaves.filter((leave) => {
      const employeeText = `${leave.employee.firstName} ${leave.employee.lastName} ${leave.employee.employeeNumber} ${leave.employee.email}`
      return (filter === 'ALL' || leave.status === filter)
        && (!query || `${employeeText} ${leaveTypeLabels[leave.leaveType]} ${leave.reason}`.toLowerCase().includes(query))
    })
  }, [filter, leaves, search])

  async function submitRequest(form: LeaveFormValues) {
    const created = await api.post<LeaveRecord>('/leaves', {
      leaveType: form.leaveType,
      startDate: new Date(`${form.startDate}T00:00:00.000Z`).toISOString(),
      endDate: new Date(`${form.endDate}T00:00:00.000Z`).toISOString(),
      reason: form.reason.trim(),
    })
    setLeaves((current) => [created, ...current])
    setShowRequest(false)
    setNotice('Your leave request was submitted.')
  }

  async function reviewLeave(comment: string) {
    if (!decision) return
    setBusyLeaveId(decision.leave.id)
    try {
      const result = decision.kind === 'approve'
        ? await api.patch<LeaveRecord>(`/leaves/${decision.leave.id}/approve`, { approvalComment: comment.trim() || undefined })
        : await api.patch<LeaveRecord>(`/leaves/${decision.leave.id}/reject`, { rejectionReason: comment.trim() })
      setLeaves((current) => current.map((leave) => leave.id === result.id ? result : leave))
      setNotice(`Leave request ${decision.kind === 'approve' ? 'approved' : 'rejected'}.`)
      setDecision(null)
    } finally {
      setBusyLeaveId(null)
    }
  }

  async function cancelLeave(leave: LeaveRecord) {
    setBusyLeaveId(leave.id)
    setActionError('')
    try {
      const result = await api.patch<LeaveRecord>(`/leaves/${leave.id}/cancel`, {})
      setLeaves((current) => current.map((item) => item.id === result.id ? result : item))
      setNotice('Your leave request was cancelled.')
    } catch (cause) {
      setActionError(cause instanceof ApiError ? cause.message : 'Unable to cancel this leave request.')
    } finally {
      setBusyLeaveId(null)
    }
  }

  if (!canRead) {
    return (
      <section className="module-placeholder access-denied" role="alert">
        <div className="placeholder-icon"><AlertCircle size={21} aria-hidden="true" /></div>
        <div><h2>Access restricted</h2><p>Your account does not have permission to view leave requests.</p></div>
      </section>
    )
  }

  const pendingCount = leaves.filter((leave) => leave.status === 'PENDING').length
  const isApprover = canApprove || canReject
  const ownEmployeeId = user?.employee?.id

  return (
    <section className="leave-page" aria-label="Leave management">
      <div className="leave-overview">
        <div className="leave-balance-card">
          <div className="leave-balance-heading">
            <span className="employee-summary-icon"><CalendarDays size={17} aria-hidden="true" /></span>
            <div><p className="eyebrow">YOUR LEAVE BALANCE</p><h2>Leave entitlement</h2></div>
          </div>
          {balance ? (
            <div className="leave-balance-metrics">
              <div><span>Annual allocation</span><strong>{balance.annualDays} <small>days</small></strong></div>
                <div><span>Carried forward</span><strong>{balance.carriedForwardDays} <small>days</small></strong></div>
                <div><span>Sick leave</span><strong>{balance.sickDays} <small>days</small></strong></div>
            </div>
          ) : (
            <p className="leave-balance-unavailable">{balanceWarning || 'Leave balance is available to accounts linked to an employee profile.'}</p>
          )}
        </div>
        <div className="leave-pending-card">
          <span><Clock3 size={16} aria-hidden="true" /> {isApprover ? 'Awaiting review' : 'Your pending requests'}</span>
          <strong>{pendingCount}</strong>
          <small>{pendingCount === 1 ? 'request' : 'requests'}</small>
        </div>
      </div>

      {balanceWarning && balance && <p className="employee-inline-warning" role="status"><AlertCircle size={15} />{balanceWarning}</p>}
      {notice && <div className="employee-notice" role="status"><Check size={15} /><span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Dismiss message"><X size={15} /></button></div>}
      {actionError && <p className="employee-form-error" role="alert"><AlertCircle size={15} />{actionError}</p>}

      <div className="leave-heading-row">
        <div><h2>Leave requests</h2><p>{isApprover ? 'Review team requests and track leave activity.' : 'Track the status of your time-off requests.'}</p></div>
        {canCreate && <button className="button-primary" type="button" onClick={() => setShowRequest(true)}><CirclePlus size={16} /> Request leave</button>}
      </div>

      <div className="employee-toolbar">
        <label className="employee-search">
          <Search size={16} aria-hidden="true" /><span className="sr-only">Search leave requests</span>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={isApprover ? 'Search employee or leave type…' : 'Search leave type or reason…'} />
        </label>
        <label className="employee-status-filter">
          <span>Status</span>
          <select value={filter} onChange={(event) => setFilter(event.target.value as LeaveFilter)}>
            <option value="ALL">All requests</option>
            {Object.entries(leaveStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <button className="icon-button employee-refresh" type="button" onClick={() => { setIsLoading(true); setReloadKey((key) => key + 1) }} disabled={isLoading} aria-label="Refresh leave requests">
          {isLoading ? <LoaderCircle className="loading-icon" size={17} /> : <RotateCw size={16} />}
        </button>
      </div>

      {error ? (
        <div className="employees-state employees-error" role="alert">
          <AlertCircle size={20} />
          <div><h2>Leave requests unavailable</h2><p>{error}</p><button className="text-button" type="button" onClick={() => { setIsLoading(true); setReloadKey((key) => key + 1) }}><RotateCw size={14} /> Try again</button></div>
        </div>
      ) : isLoading ? (
        <div className="employees-state" role="status"><LoaderCircle className="loading-icon" size={19} />Loading leave requests…</div>
      ) : filteredLeaves.length === 0 ? (
        <div className="employees-state empty-directory">
          <CalendarDays size={22} /><h2>{leaves.length ? 'No matching requests' : 'No leave requests yet'}</h2>
          <p>{leaves.length ? 'Adjust the search or status filter.' : 'Leave requests will appear here when submitted.'}</p>
          {!leaves.length && canCreate && <button className="button-primary" type="button" onClick={() => setShowRequest(true)}><CirclePlus size={16} /> Request leave</button>}
          {leaves.length > 0 && <button className="text-button" type="button" onClick={() => { setSearch(''); setFilter('ALL') }}>Clear filters</button>}
        </div>
      ) : (
        <div className="leave-table-wrap">
          <table className="leave-table">
            <thead><tr><th scope="col">Employee</th><th scope="col">Type</th><th scope="col">Dates</th><th scope="col">Days</th><th scope="col">Status</th><th scope="col">Reason / review</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {filteredLeaves.map((leave) => {
                const isOwn = ownEmployeeId ? leave.employeeId === ownEmployeeId : leave.employee.email.toLowerCase() === user?.email.toLowerCase()
                const isBusy = busyLeaveId === leave.id
                return (
                  <tr key={leave.id}>
                    <td><span className="employee-primary"><strong>{leave.employee.firstName} {leave.employee.lastName}</strong><span>{leave.employee.employeeNumber}</span></span></td>
                    <td>{leaveTypeLabels[leave.leaveType]}</td>
                    <td><span className="leave-dates">{formatDate(leave.startDate)}<i>to</i>{formatDate(leave.endDate)}</span></td>
                    <td>{leave.days}</td>
                    <td><span className={`employee-status leave-status-${leave.status.toLowerCase()}`}>{leaveStatusLabels[leave.status]}</span></td>
                    <td className="leave-reason-cell">
                      <span title={leave.rejectionReason || leave.approvalComment || leave.reason}>{leave.rejectionReason || leave.approvalComment || leave.reason}</span>
                    </td>
                    <td className="leave-actions-cell">
                      {leave.status === 'PENDING' && isApprover && !isOwn && (
                        <>
                          {canApprove && <button className="leave-action-approve" type="button" onClick={() => setDecision({ kind: 'approve', leave })} disabled={isBusy}>Approve</button>}
                          {canReject && <button className="leave-action-reject" type="button" onClick={() => setDecision({ kind: 'reject', leave })} disabled={isBusy}>Reject</button>}
                        </>
                      )}
                      {leave.status === 'PENDING' && isOwn && (
                        <button className="leave-action-cancel" type="button" onClick={() => void cancelLeave(leave)} disabled={isBusy}>
                          {isBusy ? 'Cancelling…' : 'Cancel'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="employee-table-footer"><span>Showing {filteredLeaves.length} of {leaves.length} requests</span><span><CalendarDays size={13} /> Leave management</span></div>
        </div>
      )}

      {showRequest && <LeaveRequestDialog onClose={() => setShowRequest(false)} onSubmit={submitRequest} />}
      {decision && <LeaveDecisionDialog kind={decision.kind} onClose={() => setDecision(null)} onSubmit={reviewLeave} />}
    </section>
  )
}
