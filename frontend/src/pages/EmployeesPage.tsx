import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  AlertCircle,
  ArrowDownUp,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  Download,
  FileDown,
  LoaderCircle,
  Pencil,
  RotateCw,
  Search,
  UsersRound,
  Upload,
  X,
} from 'lucide-react'
import { ApiError, api } from '../lib/api'
import { useAuth } from '../auth/useAuth'
import { EmployeeAvatar } from '../components/EmployeeAvatar'

type EmploymentStatus = 'ACTIVE' | 'PROBATION' | 'ON_LEAVE' | 'SUSPENDED' | 'RESIGNED' | 'TERMINATED'
type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN' | 'TEMPORARY'

type Department = {
  id: string
  name: string
  isActive: boolean
}

type Position = {
  id: string
  title: string
  isActive: boolean
}

type PersonalInformationRow = Record<string, string>

type EmployeePersonalInformationData = {
  spouse: PersonalInformationRow
  beneficiaries: PersonalInformationRow[]
  dependants: PersonalInformationRow[]
  interests: string[]
  qualifications: PersonalInformationRow[]
  guarantors: PersonalInformationRow[]
}

type EmployeePersonalInformationRecord = {
  data: EmployeePersonalInformationData
  updatedAt: string
} | null

type Employee = {
  id: string
  employeeNumber: string
  firstName: string
  lastName: string
  middleName: string | null
  email: string
  phone: string | null
  dateOfBirth: string | null
  gender: string | null
  address: string | null
  profilePhoto: string | null
  user?: { id: string; email: string; status: string } | null
  employmentType: EmploymentType
  employmentStatus: EmploymentStatus
  dateJoined: string
  confirmationDate: string | null
  departmentId: string | null
  positionId: string | null
  managerId: string | null
  department: Department | null
  position: Position | null
  manager: Pick<Employee, 'id' | 'employeeNumber' | 'firstName' | 'lastName' | 'email'> | null
  personalInformation?: EmployeePersonalInformationRecord
}

type EmployeeForm = {
  employeeNumber: string
  firstName: string
  lastName: string
  middleName: string
  email: string
  phone: string
  dateOfBirth: string
  gender: string
  address: string
  employmentType: EmploymentType
  employmentStatus: EmploymentStatus
  dateJoined: string
  confirmationDate: string
  departmentId: string
  positionId: string
  managerId: string
}

const emptyForm: EmployeeForm = {
  employeeNumber: '',
  firstName: '',
  lastName: '',
  middleName: '',
  email: '',
  phone: '',
  dateOfBirth: '',
  gender: '',
  address: '',
  employmentType: 'FULL_TIME',
  employmentStatus: 'PROBATION',
  dateJoined: '',
  confirmationDate: '',
  departmentId: '',
  positionId: '',
  managerId: '',
}

const statusLabels: Record<EmploymentStatus, string> = {
  ACTIVE: 'Active',
  PROBATION: 'Probation',
  ON_LEAVE: 'On leave',
  SUSPENDED: 'Suspended',
  RESIGNED: 'Resigned',
  TERMINATED: 'Terminated',
}

const typeLabels: Record<EmploymentType, string> = {
  FULL_TIME: 'Full time',
  PART_TIME: 'Part time',
  CONTRACT: 'Contract',
  INTERN: 'Intern',
  TEMPORARY: 'Temporary',
}

const statusOptions = Object.entries(statusLabels) as [EmploymentStatus, string][]
const typeOptions = Object.entries(typeLabels) as [EmploymentType, string][]
const employeePageSize = 5

const employeeImportHeaders = [
  'employeeNumber', 'firstName', 'middleName', 'lastName', 'email', 'phone',
  'dateOfBirth', 'gender', 'address', 'employmentType', 'employmentStatus',
  'dateJoined', 'confirmationDate', 'departmentId', 'positionId', 'managerId',
]

type EmployeeImportFailure = {
  row: number
  employeeNumber: string
  message: string
}

type EmployeeImportResponse = {
  created: number
  failed: number
  failures: EmployeeImportFailure[]
}

function csvCell(value: string | null | undefined) {
  const normalized = value ?? ''
  const safeValue = /^[\t\r ]*[=+\-@]/.test(normalized) ? `'${normalized}` : normalized
  return `"${safeValue.replace(/"/g, '""')}"`
}

function downloadEmployeeTemplate() {
  const csv = employeeImportHeaders.map(csvCell).join(',')
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'employee-import-template.csv'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function parseCsv(content: string) {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const source = content.replace(/^\uFEFF/, '')

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (character === '"') {
        quoted = false
      } else {
        field += character
      }
    } else if (character === '"' && field.length === 0) {
      quoted = true
    } else if (character === ',') {
      row.push(field)
      field = ''
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && source[index + 1] === '\n') index += 1
      row.push(field)
      if (row.some((value) => value.trim())) rows.push(row)
      row = []
      field = ''
    } else {
      field += character
    }
  }

  if (quoted) throw new Error('The CSV contains an unclosed quoted field.')
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    if (row.some((value) => value.trim())) rows.push(row)
  }
  return rows
}

function exportEmployeesCsv(employees: Employee[]) {
  const columns = [
    'Employee number',
    'First name',
    'Middle name',
    'Last name',
    'Email',
    'Phone',
    'Date of birth',
    'Gender',
    'Department',
    'Position',
    'Manager',
    'Employment type',
    'Employment status',
    'Start date',
    'Confirmation date',
    'Address',
  ]
  const rows = employees.map((employee) => [
    employee.employeeNumber,
    employee.firstName,
    employee.middleName,
    employee.lastName,
    employee.email,
    employee.phone,
    dateInputValue(employee.dateOfBirth),
    employee.gender,
    employee.department?.name,
    employee.position?.title,
    employee.manager ? employeeName(employee.manager) : '',
    typeLabels[employee.employmentType],
    statusLabels[employee.employmentStatus],
    dateInputValue(employee.dateJoined),
    dateInputValue(employee.confirmationDate),
    employee.address,
  ])
  const csv = [columns, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `employees-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function dateInputValue(value: string | null | undefined) {
  if (!value) return ''
  return value.slice(0, 10)
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value))
}

function employeeName(employee: {
  firstName: string
  lastName: string
  middleName?: string | null
}) {
  return [employee.firstName, employee.middleName, employee.lastName].filter(Boolean).join(' ')
}

function inputPayload(form: EmployeeForm) {
  return {
    employeeNumber: form.employeeNumber.trim(),
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    ...(form.middleName.trim() && { middleName: form.middleName.trim() }),
    email: form.email.trim(),
    ...(form.phone.trim() && { phone: form.phone.trim() }),
    ...(form.dateOfBirth && {
      dateOfBirth: new Date(`${form.dateOfBirth}T00:00:00.000Z`).toISOString(),
    }),
    ...(form.gender && { gender: form.gender }),
    ...(form.address.trim() && { address: form.address.trim() }),
    employmentType: form.employmentType,
    employmentStatus: form.employmentStatus,
    dateJoined: new Date(`${form.dateJoined}T00:00:00.000Z`).toISOString(),
    ...(form.confirmationDate && {
      confirmationDate: new Date(`${form.confirmationDate}T00:00:00.000Z`).toISOString(),
    }),
    ...(form.departmentId && { departmentId: form.departmentId }),
    ...(form.positionId && { positionId: form.positionId }),
    ...(form.managerId && { managerId: form.managerId }),
  }
}

async function requestEmployeeData() {
  return Promise.allSettled([
    api.get<Employee[]>('/employees'),
    api.get<Department[]>('/departments'),
    api.get<Position[]>('/positions'),
  ])
}

function formFromEmployee(employee: Employee): EmployeeForm {
  return {
    employeeNumber: employee.employeeNumber,
    firstName: employee.firstName,
    lastName: employee.lastName,
    middleName: employee.middleName ?? '',
    email: employee.email,
    phone: employee.phone ?? '',
    dateOfBirth: dateInputValue(employee.dateOfBirth),
    gender: employee.gender ?? '',
    address: employee.address ?? '',
    employmentType: employee.employmentType,
    employmentStatus: employee.employmentStatus,
    dateJoined: dateInputValue(employee.dateJoined),
    confirmationDate: dateInputValue(employee.confirmationDate),
    departmentId: employee.departmentId ?? '',
    positionId: employee.positionId ?? '',
    managerId: employee.managerId ?? '',
  }
}

function StatusLabel({ status }: { status: EmploymentStatus }) {
  return <span className={`employee-status employee-status-${status.toLowerCase()}`}>{statusLabels[status]}</span>
}

function EmployeeFormDialog({
  initialEmployee,
  departments,
  positions,
  employees,
  canEdit,
  onClose,
  onSave,
}: {
  initialEmployee: Employee | null
  departments: Department[]
  positions: Position[]
  employees: Employee[]
  canEdit: boolean
  onClose: () => void
  onSave: (form: EmployeeForm, photoFile: File | null) => Promise<void>
}) {
  const [form, setForm] = useState<EmployeeForm>(
    initialEmployee ? formFromEmployee(initialEmployee) : emptyForm,
  )
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const isEditing = initialEmployee !== null

  useEffect(() => {
    if (!photoFile) { setPhotoPreview(null); return }
    const objectUrl = URL.createObjectURL(photoFile)
    setPhotoPreview(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [photoFile])

  function setField<K extends keyof EmployeeForm>(key: K, value: EmployeeForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSaving(true)
    try {
      await onSave(form, photoFile)
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to save this employee.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="employee-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="employee-dialog" role="dialog" aria-modal="true" aria-labelledby="employee-form-title">
        <header className="employee-dialog-header">
          <div>
            <p className="eyebrow">{isEditing ? 'EMPLOYEE RECORD' : 'PEOPLE DIRECTORY'}</p>
            <h2 id="employee-form-title">{isEditing ? 'Edit employee' : 'Add employee'}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close form">
            <X size={19} aria-hidden="true" />
          </button>
        </header>

        <form className="employee-form" onSubmit={handleSubmit}>
          <div className="employee-form-grid">
            <div className="employee-form-full employee-photo-upload-row">
              {photoPreview ? <img className="employee-form-photo-preview" src={photoPreview} alt="Selected employee profile" /> : <EmployeeAvatar className="employee-form-photo-preview" photo={initialEmployee?.profilePhoto} name={initialEmployee ? employeeName(initialEmployee) : form.firstName || 'New employee'} />}
              <div><strong>Profile photo</strong><span>PNG, JPG, or WebP · up to 1 MB</span><label className="button-secondary employee-photo-select"><Upload size={14} />{photoFile ? 'Change photo' : 'Upload photo'}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; if (file.size > 1024 * 1024) { setError('Profile photos must be 1 MB or smaller.'); return } setError(''); setPhotoFile(file) }} /></label></div>
            </div>
            <label>
              Employee number
              <input
                value={form.employeeNumber}
                onChange={(event) => setField('employeeNumber', event.target.value)}
                required
                maxLength={40}
                autoComplete="off"
              />
            </label>
            <label>
              Work email
              <input
                type="email"
                value={form.email}
                onChange={(event) => setField('email', event.target.value)}
                required
                autoComplete="email"
              />
            </label>
            <label>
              First name
              <input
                value={form.firstName}
                onChange={(event) => setField('firstName', event.target.value)}
                required
                maxLength={100}
                autoComplete="given-name"
              />
            </label>
            <label>
              Last name
              <input
                value={form.lastName}
                onChange={(event) => setField('lastName', event.target.value)}
                required
                maxLength={100}
                autoComplete="family-name"
              />
            </label>
            <label>
              Middle name <span className="field-optional">Optional</span>
              <input
                value={form.middleName}
                onChange={(event) => setField('middleName', event.target.value)}
                maxLength={100}
              />
            </label>
            <label>
              Phone <span className="field-optional">Optional</span>
              <input
                value={form.phone}
                onChange={(event) => setField('phone', event.target.value)}
                maxLength={30}
                autoComplete="tel"
              />
            </label>
            <label>
              Date of birth <span className="field-optional">Optional</span>
              <input
                type="date"
                value={form.dateOfBirth}
                onChange={(event) => setField('dateOfBirth', event.target.value)}
              />
            </label>
            <label>
              Department <span className="field-optional">Optional</span>
              <select
                value={form.departmentId}
                onChange={(event) => setField('departmentId', event.target.value)}
                disabled={!departments.length}
              >
                <option value="">{isEditing ? 'Keep current department' : 'Not assigned'}</option>
                {departments.filter((item) => item.isActive).map((department) => (
                  <option key={department.id} value={department.id}>{department.name}</option>
                ))}
              </select>
            </label>
            <label>
              Position <span className="field-optional">Optional</span>
              <select
                value={form.positionId}
                onChange={(event) => setField('positionId', event.target.value)}
                disabled={!positions.length}
              >
                <option value="">{isEditing ? 'Keep current position' : 'Not assigned'}</option>
                {positions.filter((item) => item.isActive).map((position) => (
                  <option key={position.id} value={position.id}>{position.title}</option>
                ))}
              </select>
            </label>
            <label>
              Manager <span className="field-optional">Optional</span>
              <select
                value={form.managerId}
                onChange={(event) => setField('managerId', event.target.value)}
              >
                <option value="">{isEditing ? 'Keep current manager' : 'No manager'}</option>
                {employees
                  .filter((employee) => employee.id !== initialEmployee?.id && !['RESIGNED', 'TERMINATED'].includes(employee.employmentStatus))
                  .map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employeeName(employee)} · {employee.employeeNumber}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Employment type
              <select
                value={form.employmentType}
                onChange={(event) => setField('employmentType', event.target.value as EmploymentType)}
              >
                {typeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>
              Employment status
              <select
                value={form.employmentStatus}
                onChange={(event) => setField('employmentStatus', event.target.value as EmploymentStatus)}
              >
                {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>
              Start date
              <input
                type="date"
                value={form.dateJoined}
                onChange={(event) => setField('dateJoined', event.target.value)}
                required
              />
            </label>
            <label>
              Confirmation date <span className="field-optional">Optional</span>
              <input
                type="date"
                value={form.confirmationDate}
                onChange={(event) => setField('confirmationDate', event.target.value)}
              />
            </label>
            <label>
              Gender <span className="field-optional">Optional</span>
              <input
                value={form.gender}
                onChange={(event) => setField('gender', event.target.value)}
                maxLength={50}
              />
            </label>
            <label className="employee-form-full">
              Address <span className="field-optional">Optional</span>
              <textarea
                value={form.address}
                onChange={(event) => setField('address', event.target.value)}
                maxLength={500}
                rows={2}
              />
            </label>
          </div>

          {(!departments.length || !positions.length) && (
            <p className="form-help">
              Some department or position choices are unavailable. Your access may not include those directory permissions.
            </p>
          )}
          {error && <p className="employee-form-error" role="alert"><AlertCircle size={15} />{error}</p>}

          <footer className="employee-dialog-actions">
            <button className="button-secondary" type="button" onClick={onClose}>Cancel</button>
            <button className="button-primary" type="submit" disabled={isSaving || !canEdit}>
              {isSaving ? <LoaderCircle className="loading-icon" size={15} /> : <Check size={15} />}
              {isSaving ? 'Saving' : isEditing ? 'Save changes' : 'Add employee'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}

function EmployeeDetailsDialog({
  employee,
  onClose,
}: {
  employee: Employee
  onClose: () => void
}) {
  const personalInformation = employee.personalInformation?.data

  return (
    <div className="employee-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="employee-dialog employee-details-dialog" role="dialog" aria-modal="true" aria-labelledby="employee-details-title">
        <header className="employee-dialog-header">
          <div>
            <p className="eyebrow">EMPLOYEE PROFILE</p>
            <h2 id="employee-details-title">{employeeName(employee)}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close profile">
            <X size={19} aria-hidden="true" />
          </button>
        </header>
        <div className="employee-detail-lead">
          <span>{employee.employeeNumber}</span>
          <StatusLabel status={employee.employmentStatus} />
        </div>
        <EmployeeAvatar className="employee-details-photo" photo={employee.profilePhoto} name={employeeName(employee)} />
        <dl className="employee-detail-list">
          <div><dt>First name</dt><dd>{employee.firstName}</dd></div>
          <div><dt>Middle name</dt><dd>{employee.middleName || '—'}</dd></div>
          <div><dt>Last name</dt><dd>{employee.lastName}</dd></div>
          <div><dt>Email</dt><dd>{employee.email}</dd></div>
          <div><dt>Phone</dt><dd>{employee.phone || '—'}</dd></div>
          <div><dt>Date of birth</dt><dd>{formatDate(employee.dateOfBirth)}</dd></div>
          <div><dt>Gender</dt><dd>{employee.gender || '—'}</dd></div>
          <div><dt>Department</dt><dd>{employee.department?.name || 'Not assigned'}</dd></div>
          <div><dt>Position</dt><dd>{employee.position?.title || 'Not assigned'}</dd></div>
          <div><dt>Manager</dt><dd>{employee.manager ? employeeName(employee.manager) : '—'}</dd></div>
          <div><dt>Employment type</dt><dd>{typeLabels[employee.employmentType]}</dd></div>
          <div><dt>Employment status</dt><dd>{statusLabels[employee.employmentStatus]}</dd></div>
          <div><dt>Start date</dt><dd>{formatDate(employee.dateJoined)}</dd></div>
          <div><dt>Confirmation date</dt><dd>{formatDate(employee.confirmationDate)}</dd></div>
          <div><dt>Linked account</dt><dd>{employee.user ? `${employee.user.email} (${employee.user.status.toLowerCase()})` : 'No user account linked'}</dd></div>
          <div className="employee-detail-full"><dt>Address</dt><dd>{employee.address || '—'}</dd></div>
        </dl>
        {employee.personalInformation !== undefined && (
          <section className="employee-personal-details">
            <div className="employee-personal-details-heading">
              <div><p className="eyebrow">STAFF SUBMITTED</p><h3>Personal information</h3></div>
              {employee.personalInformation?.updatedAt && <span>Updated {formatDate(employee.personalInformation.updatedAt)}</span>}
            </div>
            {!personalInformation ? <p className="employee-personal-empty">This employee has not added personal information yet.</p> : (
              <>
                <div className="employee-personal-block">
                  <h4>Spouse details</h4>
                  <dl className="employee-detail-list">
                    <div><dt>Name</dt><dd>{personalInformation.spouse.fullName || '—'}</dd></div>
                    <div><dt>Phone</dt><dd>{personalInformation.spouse.phone || '—'}</dd></div>
                    <div><dt>Email</dt><dd>{personalInformation.spouse.email || '—'}</dd></div>
                    <div><dt>Occupation</dt><dd>{personalInformation.spouse.occupation || '—'}</dd></div>
                  </dl>
                </div>
                {([
                  ['Beneficiaries', personalInformation.beneficiaries, ['fullName', 'relationship', 'phone', 'allocation']],
                  ['Dependants', personalInformation.dependants, ['fullName', 'relationship', 'dateOfBirth']],
                  ['Qualifications', personalInformation.qualifications, ['qualification', 'institution', 'fieldOfStudy', 'yearCompleted']],
                  ['Guarantors', personalInformation.guarantors, ['fullName', 'relationship', 'phone', 'email', 'address']],
                ] as const).map(([title, records, fields]) => (
                  <div className="employee-personal-block" key={title}>
                    <h4>{title}</h4>
                    {records.length === 0 ? <p className="employee-personal-empty">None provided.</p> : records.map((record, index) => (
                      <dl className="employee-detail-list" key={`${title}-${index}`}>
                        {fields.map((field) => <div key={field}><dt>{field.replace(/[A-Z]/g, (letter) => ` ${letter}`).replace(/^./, (letter) => letter.toUpperCase())}</dt><dd>{record[field] || '—'}</dd></div>)}
                      </dl>
                    ))}
                  </div>
                ))}
                <div className="employee-personal-block"><h4>Interests</h4><p className="employee-personal-interests">{personalInformation.interests.length ? personalInformation.interests.join(', ') : 'None provided.'}</p></div>
              </>
            )}
          </section>
        )}
      </section>
    </div>
  )
}

export function EmployeesPage() {
  const { hasPermission } = useAuth()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<EmploymentStatus | 'ALL'>('ALL')
  const [joinedFrom, setJoinedFrom] = useState('')
  const [joinedTo, setJoinedTo] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [lookupWarning, setLookupWarning] = useState('')
  const [dialogEmployee, setDialogEmployee] = useState<Employee | null | undefined>(undefined)
  const [detailEmployee, setDetailEmployee] = useState<Employee | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [isImporting, setIsImporting] = useState(false)
  const [importFailures, setImportFailures] = useState<EmployeeImportFailure[]>([])
  const fileInput = useRef<HTMLInputElement>(null)

  const canCreate = hasPermission('employee:create')
  const canUpdate = hasPermission('employee:update')
  const canRead = hasPermission('employee:read')

  useEffect(() => {
    if (!canRead) return
    let cancelled = false

    void requestEmployeeData().then(([employeeResult, departmentResult, positionResult]) => {
      if (cancelled) return

      if (employeeResult.status === 'rejected') {
        const cause: unknown = employeeResult.reason
        setEmployees([])
        setError(cause instanceof ApiError ? cause.message : 'Unable to load the employee directory.')
      } else {
        setEmployees(employeeResult.value)
        setError('')
      }

      const warnings: string[] = []
      if (departmentResult.status === 'fulfilled') setDepartments(departmentResult.value)
      else warnings.push('department')
      if (positionResult.status === 'fulfilled') setPositions(positionResult.value)
      else warnings.push('position')
      setLookupWarning(warnings.length
        ? `Could not load ${warnings.join(' and ')} choices. You may need the matching directory permission.`
        : '')
      setIsLoading(false)
    })

    return () => { cancelled = true }
  }, [canRead, reloadKey])

  const filteredEmployees = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return employees.filter((employee) => {
      const matchesStatus = statusFilter === 'ALL' || employee.employmentStatus === statusFilter
      const joinedDate = dateInputValue(employee.dateJoined)
      const matchesDate = (!joinedFrom || joinedDate >= joinedFrom) && (!joinedTo || joinedDate <= joinedTo)
      const searchableText = [
        employee.firstName,
        employee.middleName,
        employee.lastName,
        employee.employeeNumber,
        employee.email,
        employee.department?.name,
        employee.position?.title,
      ].filter(Boolean).join(' ').toLowerCase()
      return matchesStatus && matchesDate && (!normalizedSearch || searchableText.includes(normalizedSearch))
    })
  }, [employees, joinedFrom, joinedTo, search, statusFilter])

  const totalPages = Math.ceil(filteredEmployees.length / employeePageSize)
  const visiblePage = Math.min(currentPage, Math.max(totalPages, 1))
  const paginatedEmployees = filteredEmployees.slice(
    (visiblePage - 1) * employeePageSize,
    visiblePage * employeePageSize,
  )

  async function saveEmployee(form: EmployeeForm, photoFile: File | null) {
    if (isSaving) return
    setIsSaving(true)
    try {
      const payload = inputPayload(form)
      if (dialogEmployee) {
        let updated = await api.patch<Employee>(`/employees/${dialogEmployee.id}`, payload)
        if (photoFile) updated = await api.uploadFile<Employee>(`/employees/${updated.id}/profile-photo`, photoFile)
        setEmployees((current) => current.map((employee) => employee.id === updated.id ? updated : employee))
        setNotice(`${employeeName(updated)}’s record was updated.`)
      } else {
        let created = await api.post<Employee>('/employees', payload)
        if (photoFile) {
          setDialogEmployee(created)
          created = await api.uploadFile<Employee>(`/employees/${created.id}/profile-photo`, photoFile)
        }
        setEmployees((current) => [...current, created].sort((a, b) =>
          employeeName(a).localeCompare(employeeName(b)),
        ))
        setNotice(`${employeeName(created)} was added to the directory.`)
      }
      setCurrentPage(1)
      setDialogEmployee(undefined)
    } finally {
      setIsSaving(false)
    }
  }

  async function importEmployees(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return

    setNotice('')
    setImportFailures([])
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setNotice('Choose a CSV file to import employee records.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setNotice('The CSV file is larger than 2 MB. Split it into smaller files and try again.')
      return
    }

    setIsImporting(true)
    try {
      const rows = parseCsv(await file.text())
      if (rows.length < 2) throw new Error('The CSV must include a header row and at least one employee row.')

      const headers = rows[0].map((header) => header.trim().toLowerCase())
      const requiredHeaders = ['employeeNumber', 'firstName', 'lastName', 'email', 'dateJoined']
      const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header.toLowerCase()))
      if (missingHeaders.length) throw new Error(`Missing template columns: ${missingHeaders.join(', ')}`)

      const dataRows = rows.slice(1)
      if (dataRows.length > 50) throw new Error('Import up to 50 employees per CSV file.')

      const optionalColumns = new Set([
        'middlename', 'phone', 'dateofbirth', 'gender', 'address', 'employmenttype',
        'employmentstatus', 'confirmationdate', 'departmentid', 'positionid', 'managerid',
      ])
      const employeesToImport = dataRows.map((values) => {
        const record: Record<string, string> = {}
        employeeImportHeaders.forEach((header) => {
          const column = headers.indexOf(header.toLowerCase())
          let value = (values[column] ?? '').trim()
          if (optionalColumns.has(header.toLowerCase()) && !value) return
          if (['dateOfBirth', 'dateJoined', 'confirmationDate'].includes(header) && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
            value = `${value}T00:00:00.000Z`
          }
          record[header] = value
        })
        return record
      })

      const result = await api.post<EmployeeImportResponse>('/employees/bulk', { employees: employeesToImport })
      setImportFailures(result.failures)
      setNotice(`CSV import complete: ${result.created} employee${result.created === 1 ? '' : 's'} added${result.failed ? `, ${result.failed} row${result.failed === 1 ? '' : 's'} need attention` : ''}.`)
      if (result.created > 0) {
        setIsLoading(true)
        setReloadKey((key) => key + 1)
      }
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Could not import this CSV file.')
    } finally {
      setIsImporting(false)
    }
  }

  async function showDetails(employee: Employee) {
    setDetailEmployee(employee)
    try {
      const details = await api.get<Employee>(`/employees/${employee.id}`)
      if (canUpdate) {
        const personalInformation = await api.get<EmployeePersonalInformationRecord>(`/employees/${employee.id}/personal-information`)
        setDetailEmployee({ ...details, personalInformation })
      } else {
        setDetailEmployee(details)
      }
    } catch (cause) {
      setNotice(cause instanceof ApiError ? cause.message : 'Could not load the full employee profile.')
    }
  }

  if (!canRead) {
    return (
      <section className="module-placeholder access-denied" role="alert">
        <div className="placeholder-icon"><AlertCircle size={21} aria-hidden="true" /></div>
        <div>
          <h2>Access restricted</h2>
          <p>Your account does not have permission to view the employee directory.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="employees-page" aria-label="Employee directory">
      <div className="employee-summary-row">
        <div className="employee-summary">
          <span className="employee-summary-icon"><UsersRound size={17} aria-hidden="true" /></span>
          <span><strong>{employees.length}</strong> {employees.length === 1 ? 'employee' : 'employees'} in the directory</span>
        </div>
        <div className="employee-header-actions">
          <button className="button-secondary employee-export-button" type="button" onClick={() => exportEmployeesCsv(filteredEmployees)} disabled={filteredEmployees.length === 0}>
            <Download size={15} aria-hidden="true" /> Export CSV
          </button>
          {canCreate && (
            <>
              <button className="button-secondary" type="button" onClick={downloadEmployeeTemplate}>
                <FileDown size={15} aria-hidden="true" /> Download template
              </button>
              <button className="button-secondary" type="button" onClick={() => fileInput.current?.click()} disabled={isImporting}>
                {isImporting ? <LoaderCircle className="loading-icon" size={15} /> : <Upload size={15} aria-hidden="true" />}
                {isImporting ? 'Importing…' : 'Upload CSV'}
              </button>
              <input ref={fileInput} className="sr-only" type="file" accept=".csv,text/csv" onChange={(event) => void importEmployees(event)} />
              <button className="button-primary" type="button" onClick={() => {
                setNotice('')
                setDialogEmployee(null)
              }}>
                <CirclePlus size={16} aria-hidden="true" />
                Add employee
              </button>
            </>
          )}
        </div>
      </div>

      {canCreate && <p className="employee-import-help">Use the CSV format download; dates use YYYY-MM-DD and optional department, position, and manager fields expect their record IDs. Upload up to 50 employees at a time.</p>}

      {notice && (
        <div className="employee-notice" role="status">
          <Check size={15} aria-hidden="true" />
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} aria-label="Dismiss message"><X size={15} /></button>
        </div>
      )}

      {importFailures.length > 0 && (
        <div className="employee-import-failures" role="status">
          <strong>Rows to correct and re-upload</strong>
          <ul>{importFailures.map((failure) => <li key={`${failure.row}-${failure.employeeNumber}`}><b>Row {failure.row}</b>{failure.employeeNumber && ` · ${failure.employeeNumber}`}: {failure.message}</li>)}</ul>
        </div>
      )}

      {lookupWarning && <p className="employee-inline-warning" role="status"><AlertCircle size={15} />{lookupWarning}</p>}

      <div className="employee-toolbar">
        <label className="employee-search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Search employees</span>
          <input
            type="search"
            value={search}
            onChange={(event) => { setSearch(event.target.value); setCurrentPage(1) }}
            placeholder="Search name, number, department…"
          />
        </label>
        <label className="employee-status-filter">
          <span>Status</span>
          <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as EmploymentStatus | 'ALL'); setCurrentPage(1) }}>
            <option value="ALL">All statuses</option>
            {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="employee-date-filter">
          <CalendarDays size={14} aria-hidden="true" />
          <span>Joined from</span>
          <input aria-label="Joined from date" type="date" value={joinedFrom} max={joinedTo || undefined} onChange={(event) => { setJoinedFrom(event.target.value); setCurrentPage(1) }} />
        </label>
        <label className="employee-date-filter">
          <CalendarDays size={14} aria-hidden="true" />
          <span>Joined to</span>
          <input aria-label="Joined to date" type="date" value={joinedTo} min={joinedFrom || undefined} onChange={(event) => { setJoinedTo(event.target.value); setCurrentPage(1) }} />
        </label>
        <button
          className="icon-button employee-refresh"
          type="button"
          onClick={() => { setIsLoading(true); setReloadKey((key) => key + 1) }}
          aria-label="Refresh employee directory"
          disabled={isLoading}
        >
          {isLoading ? <LoaderCircle className="loading-icon" size={17} /> : <RotateCw size={16} />}
        </button>
      </div>

      {error ? (
        <div className="employees-state employees-error" role="alert">
          <AlertCircle size={20} aria-hidden="true" />
          <div>
            <h2>Employee directory unavailable</h2>
            <p>{error}</p>
            <button className="text-button" type="button" onClick={() => { setIsLoading(true); setReloadKey((key) => key + 1) }}>
              <RotateCw size={14} aria-hidden="true" /> Try again
            </button>
          </div>
        </div>
      ) : isLoading ? (
        <div className="employees-state" role="status">
          <LoaderCircle className="loading-icon" size={19} aria-hidden="true" />
          <span>Loading employee directory…</span>
        </div>
      ) : employees.length === 0 ? (
        <div className="employees-state empty-directory">
          <UsersRound size={22} aria-hidden="true" />
          <h2>No employees yet</h2>
          <p>Employees added to the HRM will appear here.</p>
          {canCreate && <button className="button-primary" type="button" onClick={() => setDialogEmployee(null)}><CirclePlus size={16} />Add employee</button>}
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div className="employees-state empty-directory">
          <Search size={21} aria-hidden="true" />
          <h2>No matching employees</h2>
          <p>Adjust your search, status, or start-date filters to see more results.</p>
          <button className="text-button" type="button" onClick={() => { setSearch(''); setStatusFilter('ALL'); setJoinedFrom(''); setJoinedTo(''); setCurrentPage(1) }}>
            Clear filters
          </button>
        </div>
      ) : (
        <div className="employee-table-wrap">
          <table className="employee-table">
            <thead>
              <tr>
                <th scope="col">Employee <ArrowDownUp size={12} aria-hidden="true" /></th>
                <th scope="col">Department / position</th>
                <th scope="col">Manager</th>
                <th scope="col">Status</th>
                <th scope="col">Start date</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {paginatedEmployees.map((employee) => (
                <tr key={employee.id}>
                  <td>
                    <button className="employee-name-button" type="button" onClick={() => void showDetails(employee)}>
                      <span className="employee-avatar" aria-hidden="true">
                        {employee.firstName.charAt(0)}{employee.lastName.charAt(0)}
                      </span>
                      <span className="employee-primary">
                        <strong>{employeeName(employee)}</strong>
                        <span>{employee.employeeNumber} <i aria-hidden="true">·</i> {employee.email}</span>
                      </span>
                    </button>
                  </td>
                  <td>
                    <span className="employee-primary">
                      <strong>{employee.department?.name || 'Not assigned'}</strong>
                      <span>{employee.position?.title || 'No position'}</span>
                    </span>
                  </td>
                  <td>{employee.manager ? employeeName(employee.manager) : <span className="muted-value">—</span>}</td>
                  <td><StatusLabel status={employee.employmentStatus} /></td>
                  <td>{formatDate(employee.dateJoined)}</td>
                  <td className="employee-action-cell">
                    {canUpdate && (
                      <button
                        className="icon-button"
                        type="button"
                        onClick={() => { setNotice(''); setDialogEmployee(employee) }}
                        aria-label={`Edit ${employeeName(employee)}`}
                      >
                        <Pencil size={15} aria-hidden="true" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="employee-table-footer">
            <span>Showing {filteredEmployees.length === 0 ? 0 : (visiblePage - 1) * employeePageSize + 1}–{Math.min(visiblePage * employeePageSize, filteredEmployees.length)} of {filteredEmployees.length} filtered ({employees.length} total)</span>
            {totalPages > 1 && <div className="employee-pagination">
              <button className="button-secondary" type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={visiblePage <= 1} aria-label="Previous page"><ChevronLeft size={14} /> Previous</button>
              <span>Page {visiblePage} of {totalPages}</span>
              <button className="button-secondary" type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={visiblePage >= totalPages} aria-label="Next page">Next <ChevronRight size={14} /></button>
            </div>}
            <span className="employee-directory-label"><BriefcaseBusiness size={13} aria-hidden="true" /> Directory</span>
          </div>
        </div>
      )}

      {dialogEmployee !== undefined && (
        <EmployeeFormDialog
          initialEmployee={dialogEmployee}
          departments={departments}
          positions={positions}
          employees={employees}
          canEdit={dialogEmployee ? canUpdate : canCreate}
          onClose={() => setDialogEmployee(undefined)}
          onSave={saveEmployee}
        />
      )}

      {detailEmployee && (
        <EmployeeDetailsDialog employee={detailEmployee} onClose={() => setDetailEmployee(null)} />
      )}
    </section>
  )
}
