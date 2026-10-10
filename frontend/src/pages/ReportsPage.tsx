import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  RotateCw,
  UsersRound,
} from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { ApiError, api } from '../lib/api'

type ReportKind = 'employees' | 'attendance'
type EmploymentStatus = 'ACTIVE' | 'PROBATION' | 'ON_LEAVE' | 'SUSPENDED' | 'RESIGNED' | 'TERMINATED'
type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'HALF_DAY' | 'ON_LEAVE'

type Department = { id: string; name: string }
type EmployeeReportRow = {
  id: string
  employeeNumber: string
  firstName: string
  middleName: string | null
  lastName: string
  email: string
  phone: string | null
  employmentType: string
  employmentStatus: EmploymentStatus
  dateJoined: string
  confirmationDate: string | null
  department: Department | null
  position: { id: string; title: string } | null
  manager: { firstName: string; lastName: string } | null
}
type AttendanceReportRow = {
  id: string
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
    department: Department | null
  }
}

const pageSize = 10
const employeeStatusLabels: Record<EmploymentStatus, string> = {
  ACTIVE: 'Active',
  PROBATION: 'Probation',
  ON_LEAVE: 'On leave',
  SUSPENDED: 'Suspended',
  RESIGNED: 'Resigned',
  TERMINATED: 'Terminated',
}
const attendanceStatusLabels: Record<AttendanceStatus, string> = {
  PRESENT: 'Present',
  LATE: 'Late',
  ABSENT: 'Absent',
  HALF_DAY: 'Half day',
  ON_LEAVE: 'On leave',
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value))
}

function formatTime(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function csvCell(value: string | null | undefined) {
  const normalized = value ?? ''
  const safeValue = /^[\t\r ]*[=+\-@]/.test(normalized) ? `'${normalized}` : normalized
  return `"${safeValue.replace(/"/g, '""')}"`
}

function downloadCsv(filename: string, columns: string[], rows: (string | null | undefined)[][]) {
  const content = [columns, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
  const blob = new Blob(['\uFEFF', content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function dateTimeBoundary(date: string, endOfDay = false) {
  if (!date) return ''
  return new Date(`${date}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`).toISOString()
}

export function ReportsPage() {
  const { hasPermission } = useAuth()
  const [reportKind, setReportKind] = useState<ReportKind>('employees')
  const [departments, setDepartments] = useState<Department[]>([])
  const [departmentWarning, setDepartmentWarning] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [employeeStatus, setEmployeeStatus] = useState<'ALL' | EmploymentStatus>('ALL')
  const [attendanceStatus, setAttendanceStatus] = useState<'ALL' | AttendanceStatus>('ALL')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [employees, setEmployees] = useState<EmployeeReportRow[]>([])
  const [attendance, setAttendance] = useState<AttendanceReportRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [page, setPage] = useState(1)
  const canRead = hasPermission('report:read')
  const canReadDepartments = hasPermission('department:read')

  useEffect(() => {
    if (!canReadDepartments) return
    let cancelled = false
    void api.get<Department[]>('/departments').then((result) => {
      if (cancelled) return
      setDepartments(result)
      setDepartmentWarning('')
    }).catch((cause: unknown) => {
      if (cancelled) return
      setDepartmentWarning(cause instanceof ApiError
        ? `Department filter unavailable: ${cause.message}`
        : 'Department filter unavailable.')
    })
    return () => { cancelled = true }
  }, [canReadDepartments])

  useEffect(() => {
    if (!canRead) return
    let cancelled = false
    const params = new URLSearchParams()
    if (departmentId) params.set('departmentId', departmentId)
    if (reportKind === 'attendance') {
      const start = dateTimeBoundary(startDate)
      const end = dateTimeBoundary(endDate, true)
      if (start) params.set('startDate', start)
      if (end) params.set('endDate', end)
    }
    const query = params.size ? `?${params.toString()}` : ''
    void (async () => {
      try {
        if (reportKind === 'employees') {
          setEmployees(await api.get<EmployeeReportRow[]>(`/reports/employees${query}`))
        } else {
          setAttendance(await api.get<AttendanceReportRow[]>(`/reports/attendance${query}`))
        }
      } catch (cause) {
        if (cancelled) return
        setError(cause instanceof ApiError ? cause.message : `Unable to load the ${reportKind} report.`)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [canRead, departmentId, endDate, reloadKey, reportKind, startDate])

  const filteredEmployees = useMemo(() => employees.filter((employee) => (
    employeeStatus === 'ALL' || employee.employmentStatus === employeeStatus
  )), [employeeStatus, employees])

  const filteredAttendance = useMemo(() => attendance.filter((record) => (
    attendanceStatus === 'ALL' || record.status === attendanceStatus
  )), [attendance, attendanceStatus])

  const currentRows = reportKind === 'employees' ? filteredEmployees : filteredAttendance
  const totalPages = Math.ceil(currentRows.length / pageSize)
  const currentPage = Math.min(page, Math.max(totalPages, 1))
  const visibleRows = currentRows.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const attendanceTotals = useMemo(() => filteredAttendance.reduce<Record<AttendanceStatus, number>>((totals, record) => {
    totals[record.status] += 1
    return totals
  }, { PRESENT: 0, LATE: 0, ABSENT: 0, HALF_DAY: 0, ON_LEAVE: 0 }), [filteredAttendance])

  function changeReport(kind: ReportKind) {
    setIsLoading(true)
    setReportKind(kind)
    setPage(1)
    setError('')
  }

  function startReload() {
    setIsLoading(true)
    setError('')
    setReloadKey((key) => key + 1)
  }

  function exportReport() {
    const stamp = new Date().toISOString().slice(0, 10)
    if (reportKind === 'employees') {
      downloadCsv(`employee-report-${stamp}.csv`, [
        'Employee number', 'First name', 'Middle name', 'Last name', 'Email', 'Phone',
        'Department', 'Position', 'Manager', 'Employment type', 'Employment status',
        'Start date', 'Confirmation date',
      ], filteredEmployees.map((employee) => [
        employee.employeeNumber,
        employee.firstName,
        employee.middleName,
        employee.lastName,
        employee.email,
        employee.phone,
        employee.department?.name,
        employee.position?.title,
        employee.manager ? `${employee.manager.firstName} ${employee.manager.lastName}` : '',
        employee.employmentType.replaceAll('_', ' '),
        employeeStatusLabels[employee.employmentStatus],
        employee.dateJoined.slice(0, 10),
        employee.confirmationDate?.slice(0, 10),
      ]))
      return
    }
    downloadCsv(`attendance-report-${stamp}.csv`, [
      'Date', 'Employee number', 'Employee name', 'Email', 'Department',
      'Clock in', 'Clock out', 'Status', 'Notes',
    ], filteredAttendance.map((record) => [
      record.attendanceDate.slice(0, 10),
      record.employee.employeeNumber,
      `${record.employee.firstName} ${record.employee.lastName}`,
      record.employee.email,
      record.employee.department?.name,
      record.clockIn,
      record.clockOut,
      attendanceStatusLabels[record.status],
      record.notes,
    ]))
  }

  if (!canRead) {
    return (
      <section className="module-placeholder access-denied" role="alert">
        <div className="placeholder-icon"><AlertCircle size={21} aria-hidden="true" /></div>
        <div><h2>Access restricted</h2><p>Your account does not have permission to view reports.</p></div>
      </section>
    )
  }

  return (
    <section className="reports-page" aria-label="Reports">
      <div className="reports-intro">
        <span className="employee-summary-icon"><FileSpreadsheet size={18} aria-hidden="true" /></span>
        <div><p className="eyebrow">PEOPLE OPERATIONS</p><h2>Workforce reports</h2><p>Review employee records and attendance activity. Export the filtered results to CSV.</p></div>
      </div>

      <div className="reports-tabs" role="tablist" aria-label="Report type">
        <button type="button" role="tab" aria-selected={reportKind === 'employees'} className={reportKind === 'employees' ? 'is-active' : ''} onClick={() => changeReport('employees')}><UsersRound size={15} /> Employee report</button>
        <button type="button" role="tab" aria-selected={reportKind === 'attendance'} className={reportKind === 'attendance' ? 'is-active' : ''} onClick={() => changeReport('attendance')}><CalendarDays size={15} /> Attendance report</button>
      </div>

      <div className="reports-toolbar">
        {canReadDepartments && (
          <label className="employee-status-filter"><span>Department</span>
            <select value={departmentId} onChange={(event) => { setIsLoading(true); setError(''); setDepartmentId(event.target.value); setPage(1) }}>
              <option value="">All departments</option>
              {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
            </select>
          </label>
        )}
        {reportKind === 'employees' ? (
          <label className="employee-status-filter"><span>Employment status</span>
            <select value={employeeStatus} onChange={(event) => { setEmployeeStatus(event.target.value as 'ALL' | EmploymentStatus); setPage(1) }}>
              <option value="ALL">All statuses</option>
              {Object.entries(employeeStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        ) : (
          <>
            <label className="report-date-filter"><span>From</span><input type="date" value={startDate} max={endDate || undefined} onChange={(event) => { setIsLoading(true); setError(''); setStartDate(event.target.value); setPage(1) }} /></label>
            <label className="report-date-filter"><span>To</span><input type="date" value={endDate} min={startDate || undefined} onChange={(event) => { setIsLoading(true); setError(''); setEndDate(event.target.value); setPage(1) }} /></label>
            <label className="employee-status-filter"><span>Attendance status</span>
              <select value={attendanceStatus} onChange={(event) => { setAttendanceStatus(event.target.value as 'ALL' | AttendanceStatus); setPage(1) }}>
                <option value="ALL">All statuses</option>
                {Object.entries(attendanceStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </>
        )}
        <button className="button-secondary" type="button" onClick={exportReport} disabled={currentRows.length === 0}><Download size={15} /> Export CSV</button>
        <button className="icon-button employee-refresh" type="button" onClick={startReload} disabled={isLoading} aria-label="Refresh report">
          {isLoading ? <LoaderCircle className="loading-icon" size={17} /> : <RotateCw size={16} />}
        </button>
      </div>
      {departmentWarning && <p className="employee-inline-warning" role="status"><AlertCircle size={15} />{departmentWarning}</p>}

      {reportKind === 'attendance' && !isLoading && !error && (
        <div className="attendance-report-summary" aria-label="Attendance totals">
          {(Object.entries(attendanceStatusLabels) as [AttendanceStatus, string][]).map(([status, label]) => (
            <div key={status}><span>{label}</span><strong>{attendanceTotals[status]}</strong></div>
          ))}
        </div>
      )}

      {error ? (
        <div className="employees-state employees-error" role="alert">
          <AlertCircle size={20} /><div><h2>Report unavailable</h2><p>{error}</p><button className="text-button" type="button" onClick={startReload}><RotateCw size={14} /> Try again</button></div>
        </div>
      ) : isLoading ? (
        <div className="employees-state" role="status"><LoaderCircle className="loading-icon" size={19} />Loading report…</div>
      ) : currentRows.length === 0 ? (
        <div className="employees-state empty-directory"><FileSpreadsheet size={22} /><h2>No report records</h2><p>There are no records matching the selected filters.</p></div>
      ) : (
        <div className="report-table-wrap">
          {reportKind === 'employees' ? (
            <table className="report-table">
              <thead><tr><th>Employee</th><th>Department</th><th>Position</th><th>Manager</th><th>Status</th><th>Start date</th></tr></thead>
              <tbody>{(visibleRows as EmployeeReportRow[]).map((employee) => (
                <tr key={employee.id}>
                  <td><strong>{employee.firstName} {employee.middleName ? `${employee.middleName} ` : ''}{employee.lastName}</strong><span>{employee.employeeNumber} · {employee.email}</span></td>
                  <td>{employee.department?.name ?? '—'}</td><td>{employee.position?.title ?? '—'}</td>
                  <td>{employee.manager ? `${employee.manager.firstName} ${employee.manager.lastName}` : '—'}</td>
                  <td><span className="employee-status">{employeeStatusLabels[employee.employmentStatus]}</span></td>
                  <td>{formatDate(employee.dateJoined)}</td>
                </tr>
              ))}</tbody>
            </table>
          ) : (
            <table className="report-table">
              <thead><tr><th>Date</th><th>Employee</th><th>Department</th><th>Clock in</th><th>Clock out</th><th>Status</th></tr></thead>
              <tbody>{(visibleRows as AttendanceReportRow[]).map((record) => (
                <tr key={record.id}>
                  <td>{formatDate(record.attendanceDate)}</td>
                  <td><strong>{record.employee.firstName} {record.employee.lastName}</strong><span>{record.employee.employeeNumber} · {record.employee.email}</span></td>
                  <td>{record.employee.department?.name ?? '—'}</td>
                  <td>{formatTime(record.clockIn)}</td><td>{formatTime(record.clockOut)}</td>
                  <td><span className="employee-status">{attendanceStatusLabels[record.status]}</span></td>
                </tr>
              ))}</tbody>
            </table>
          )}
          <div className="report-table-footer">
            <span>Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, currentRows.length)} of {currentRows.length} records</span>
            {totalPages > 1 && <div className="employee-pagination">
              <button className="button-secondary" type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage <= 1}><ChevronLeft size={14} /> Previous</button>
              <span>Page {currentPage} of {totalPages}</span>
              <button className="button-secondary" type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={currentPage >= totalPages}>Next <ChevronRight size={14} /></button>
            </div>}
          </div>
        </div>
      )}
    </section>
  )
}
