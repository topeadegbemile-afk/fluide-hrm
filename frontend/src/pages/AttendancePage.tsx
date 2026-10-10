import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  CalendarDays,
  Check,
  Clock3,
  LoaderCircle,
  RotateCw,
  Search,
  Timer,
  UsersRound,
} from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { ApiError, api } from '../lib/api'

type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'HALF_DAY' | 'ON_LEAVE'

type AttendanceRecord = {
  id: string
  employeeId: string
  attendanceDate: string
  clockIn: string | null
  clockOut: string | null
  status: AttendanceStatus
  notes: string | null
  employee: {
    id: string
    employeeNumber: string
    firstName: string
    lastName: string
    email: string
    department?: { name: string } | null
    position?: { title: string } | null
  }
}

type StatusFilter = 'ALL' | AttendanceStatus

const statusLabels: Record<AttendanceStatus, string> = {
  PRESENT: 'Present',
  LATE: 'Late',
  ABSENT: 'Absent',
  HALF_DAY: 'Half day',
  ON_LEAVE: 'On leave',
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))
}

function formatTime(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function sameCalendarDate(left: string, right: string) {
  const a = new Date(left)
  const b = new Date(right)
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
}

function elapsedTime(start: string | null, end: string | null) {
  if (!start || !end) return '—'
  const minutes = Math.max(0, Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 60_000))
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

export function AttendancePage() {
  const { user, hasPermission } = useAuth()
  const [currentDate] = useState(() => new Date())
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [todayRecords, setTodayRecords] = useState<AttendanceRecord[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<StatusFilter>('ALL')
  const [dateFilter, setDateFilter] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isClocking, setIsClocking] = useState(false)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const canRead = hasPermission('attendance:read')

  useEffect(() => {
    if (!canRead) return
    let cancelled = false
    void Promise.allSettled([
      api.get<AttendanceRecord[]>('/attendance'),
      api.get<AttendanceRecord[]>('/attendance/today'),
    ]).then(([listResult, todayResult]) => {
      if (cancelled) return
      if (listResult.status === 'fulfilled') {
        setRecords(listResult.value)
        setError('')
      } else {
        const cause: unknown = listResult.reason
        setRecords([])
        setError(cause instanceof ApiError ? cause.message : 'Unable to load attendance records.')
      }
      if (todayResult.status === 'fulfilled') {
        setTodayRecords(todayResult.value)
      } else {
        setTodayRecords([])
      }
      setIsLoading(false)
    })
    return () => { cancelled = true }
  }, [canRead, reloadKey])

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase()
    return records.filter((record) => {
      const text = [
        record.employee.firstName,
        record.employee.lastName,
        record.employee.employeeNumber,
        record.employee.email,
        record.employee.department?.name,
        record.employee.position?.title,
      ].filter(Boolean).join(' ').toLowerCase()
      return (!query || text.includes(query))
        && (filter === 'ALL' || record.status === filter)
        && (!dateFilter || record.attendanceDate.slice(0, 10) === dateFilter)
    })
  }, [dateFilter, filter, records, search])

  const ownToday = user?.employee
    ? todayRecords.find((record) => record.employeeId === user.employee?.id
      || record.employee.id === user.employee?.id
      || (record.employee.email.toLowerCase() === user.employee?.email.toLowerCase()
        && sameCalendarDate(record.attendanceDate, currentDate.toISOString())))
    : undefined
  const ownRecordToday = ownToday
    ?? records.find((record) => user?.employee
      && (record.employeeId === user.employee.id || record.employee.id === user.employee.id)
      && sameCalendarDate(record.attendanceDate, currentDate.toISOString()))
  const statusCounts = records.reduce<Record<string, number>>((counts, record) => {
    counts[record.status] = (counts[record.status] ?? 0) + 1
    return counts
  }, {})

  async function clock(action: 'clock-in' | 'clock-out') {
    setIsClocking(true)
    setActionError('')
    setNotice('')
    try {
      const result = await api.post<AttendanceRecord>(`/attendance/${action}`, {})
      setNotice(action === 'clock-in' ? `Clock-in recorded at ${formatTime(result.clockIn)}.` : `Clock-out recorded at ${formatTime(result.clockOut)}.`)
      setIsLoading(true)
      setReloadKey((key) => key + 1)
    } catch (cause) {
      setActionError(cause instanceof ApiError ? cause.message : 'Unable to record attendance.')
    } finally {
      setIsClocking(false)
    }
  }

  if (!canRead) {
    return (
      <section className="module-placeholder access-denied" role="alert">
        <div className="placeholder-icon"><AlertCircle size={21} aria-hidden="true" /></div>
        <div><h2>Access restricted</h2><p>Your account does not have permission to view attendance.</p></div>
      </section>
    )
  }

  const hasEmployeeProfile = Boolean(user?.employee)

  return (
    <section className="attendance-page" aria-label="Attendance">
      <div className="attendance-overview">
        <div className="attendance-today-card">
          <div className="attendance-today-heading">
            <span className="employee-summary-icon"><Clock3 size={17} aria-hidden="true" /></span>
            <div>
              <p className="eyebrow">TODAY</p>
              <h2>{new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(currentDate)}</h2>
            </div>
          </div>
          {hasEmployeeProfile ? (
            <>
              <div className="attendance-clock-values">
                <div><span>Clock in</span><strong>{formatTime(ownRecordToday?.clockIn ?? null)}</strong></div>
                <div><span>Clock out</span><strong>{formatTime(ownRecordToday?.clockOut ?? null)}</strong></div>
                <div><span>Hours</span><strong>{elapsedTime(ownRecordToday?.clockIn ?? null, ownRecordToday?.clockOut ?? null)}</strong></div>
              </div>
              <div className="attendance-clock-actions">
                {!ownRecordToday?.clockIn ? (
                  <button className="button-primary" type="button" onClick={() => void clock('clock-in')} disabled={isClocking || isLoading}>
                    {isClocking ? <LoaderCircle className="loading-icon" size={15} /> : <Timer size={15} />} Clock in
                  </button>
                ) : !ownRecordToday.clockOut ? (
                  <button className="button-primary" type="button" onClick={() => void clock('clock-out')} disabled={isClocking || isLoading}>
                    {isClocking ? <LoaderCircle className="loading-icon" size={15} /> : <Timer size={15} />} Clock out
                  </button>
                ) : (
                  <span className="attendance-complete"><Check size={15} /> Workday complete</span>
                )}
                {ownRecordToday && <span className={`employee-status attendance-status-${ownRecordToday.status.toLowerCase()}`}>{statusLabels[ownRecordToday.status]}</span>}
              </div>
            </>
          ) : (
            <p className="attendance-no-profile">Clock-in is available to accounts linked to an employee profile.</p>
          )}
        </div>
        <div className="attendance-summary-card">
          <div className="attendance-summary-heading"><CalendarDays size={17} /><span>Record summary</span></div>
          <strong className="attendance-total">{records.length.toLocaleString()}</strong>
          <span className="attendance-total-caption">attendance records</span>
          <div className="attendance-status-summary">
            {(['PRESENT', 'LATE', 'ABSENT'] as const).map((status) => (
              <span key={status}>{statusLabels[status]}<strong>{statusCounts[status] ?? 0}</strong></span>
            ))}
          </div>
        </div>
      </div>

      {notice && <p className="employee-notice" role="status"><Check size={15} /><span>{notice}</span></p>}
      {actionError && <p className="employee-form-error" role="alert"><AlertCircle size={15} />{actionError}</p>}

      <div className="employee-toolbar attendance-toolbar">
        <label className="employee-search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Search attendance records</span>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search employee, department…" />
        </label>
        <label className="employee-status-filter">
          <span>Status</span>
          <select value={filter} onChange={(event) => setFilter(event.target.value as StatusFilter)}>
            <option value="ALL">All statuses</option>
            {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="attendance-date-filter">
          <CalendarDays size={15} aria-hidden="true" />
          <span className="sr-only">Filter by date</span>
          <input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} />
        </label>
        <button className="icon-button employee-refresh" type="button" onClick={() => { setIsLoading(true); setReloadKey((key) => key + 1) }} disabled={isLoading} aria-label="Refresh attendance">
          {isLoading ? <LoaderCircle className="loading-icon" size={17} /> : <RotateCw size={16} />}
        </button>
      </div>

      {error ? (
        <div className="employees-state employees-error" role="alert">
          <AlertCircle size={20} aria-hidden="true" />
          <div>
            <h2>Attendance records unavailable</h2>
            <p>{error}</p>
            <button className="text-button" type="button" onClick={() => { setIsLoading(true); setReloadKey((key) => key + 1) }}>
              <RotateCw size={14} aria-hidden="true" /> Try again
            </button>
          </div>
        </div>
      ) : isLoading ? (
        <div className="employees-state" role="status"><LoaderCircle className="loading-icon" size={19} />Loading attendance records…</div>
      ) : filteredRecords.length === 0 ? (
        <div className="employees-state empty-directory">
          <Clock3 size={22} aria-hidden="true" />
          <h2>{records.length ? 'No matching records' : 'No attendance records yet'}</h2>
          <p>{records.length ? 'Adjust your search, status, or date filters.' : 'Clock-in records will appear here.'}</p>
          {records.length > 0 && <button className="text-button" type="button" onClick={() => { setSearch(''); setFilter('ALL'); setDateFilter('') }}>Clear filters</button>}
        </div>
      ) : (
        <div className="attendance-table-wrap">
          <table className="attendance-table">
            <thead><tr><th scope="col">Employee</th><th scope="col">Date</th><th scope="col">Clock in</th><th scope="col">Clock out</th><th scope="col">Hours</th><th scope="col">Status</th></tr></thead>
            <tbody>
              {filteredRecords.map((record) => (
                <tr key={record.id}>
                  <td>
                    <span className="employee-name-button attendance-employee">
                      <span className="employee-avatar" aria-hidden="true">{record.employee.firstName.charAt(0)}{record.employee.lastName.charAt(0)}</span>
                      <span className="employee-primary">
                        <strong>{record.employee.firstName} {record.employee.lastName}</strong>
                        <span>{record.employee.employeeNumber}{record.employee.department?.name ? ` · ${record.employee.department.name}` : ''}</span>
                      </span>
                    </span>
                  </td>
                  <td>{formatDate(record.attendanceDate)}</td>
                  <td>{formatTime(record.clockIn)}</td>
                  <td>{formatTime(record.clockOut)}</td>
                  <td>{elapsedTime(record.clockIn, record.clockOut)}</td>
                  <td><span className={`employee-status attendance-status-${record.status.toLowerCase()}`}>{statusLabels[record.status]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="employee-table-footer">
            <span>Showing {filteredRecords.length} of {records.length} records</span>
            <span><UsersRound size={13} aria-hidden="true" /> Attendance</span>
          </div>
        </div>
      )}
    </section>
  )
}
