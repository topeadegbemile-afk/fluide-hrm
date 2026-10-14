import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
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
  Trash2,
  UsersRound,
  Upload,
  X,
} from 'lucide-react'
import { ApiError, api } from '../lib/api'
import { useAuth } from '../auth/useAuth'
import { EmployeeAvatar } from '../components/EmployeeAvatar'

type EmploymentStatus = 'ACTIVE' | 'PROBATION' | 'ON_LEAVE' | 'SUSPENDED' | 'RESIGNED' | 'TERMINATED'
type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN' | 'TEMPORARY' | 'HYBRID'

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
type Office = { id: string; name: string; code: string; isActive: boolean }

type PersonalInformationRow = Record<string, string>

type EmployeePersonalInformationData = {
  taxId: string
  personalEmail: string
  bankName: string
  accountName: string
  accountNumber: string
  pensionProvider?: string
  pensionNumber?: string
  nhfNumber?: string
  spouse: PersonalInformationRow
  beneficiaries: PersonalInformationRow[]
  dependants: PersonalInformationRow[]
  interests: string[]
  qualifications: PersonalInformationRow[]
  guarantors: PersonalInformationRow[]
}

type EmployeePersonalInformationRecord = {
  data: EmployeePersonalInformationData
  proposedData?: EmployeePersonalInformationData | null
  updatedAt: string
  reviewStatus?: 'PENDING' | 'APPROVED' | 'REJECTED'
  reviewComment?: string | null
  reviewedAt?: string | null
  submittedAt?: string
} | null

type EmployeeInformationReview = NonNullable<EmployeePersonalInformationRecord> & {
  employeeId: string
  employee: { id: string; employeeNumber: string; firstName: string; lastName: string; email: string | null; department: { name: string } | null }
}

type Employee = {
  id: string
  employeeNumber: string
  firstName: string
  lastName: string
  middleName: string | null
  email: string | null
  phone: string | null
  dateOfBirth: string | null
  gender: string | null
  address: string | null
  profilePhoto: string | null
  user?: { id: string; email: string; status: string } | null
  employmentType: EmploymentType
  employmentStatus: EmploymentStatus
  dateJoined: string
  employmentMonthYear?: string | null
  confirmationDate: string | null
  grossSalary: string | null
  lastSalary: string | null
  reviewDate: string | null
  departmentId: string | null
  positionId: string | null
  managerId: string | null
  department: Department | null
  position: Position | null
  manager: Pick<Employee, 'id' | 'employeeNumber' | 'firstName' | 'lastName' | 'email'> | null
  officeId: string | null
  office: Pick<Office, 'id' | 'name' | 'code'> | null
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
  grossSalary: string
  lastSalary: string
  reviewDate: string
  departmentId: string
  positionId: string
  managerId: string
  officeId: string
  taxId: string
  personalEmail: string
  bankName: string
  accountName: string
  accountNumber: string
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
  grossSalary: '',
  lastSalary: '',
  reviewDate: '',
  departmentId: '',
  positionId: '',
  managerId: '',
  officeId: '',
  taxId: '',
  personalEmail: '',
  bankName: '',
  accountName: '',
  accountNumber: '',
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
  HYBRID: 'Hybrid',
}

const statusOptions = Object.entries(statusLabels) as [EmploymentStatus, string][]
const typeOptions = Object.entries(typeLabels) as [EmploymentType, string][]
const employeePageSize = 10

const employeeImportHeaders = [
  'Staff ID', 'Surname', 'First Name', 'Other Name', 'Gender', 'D.O.B', 'Contact',
  'Unit', 'Job Title', 'Home Address', 'Personal Email', 'Official Email', 'Job Type',
  'Tax ID', 'Date of Employment', 'M/Y of Employ', 'Bank Name', 'Account Name',
  'Account Number', 'Gross Salary', 'Last Salary Review', 'Branch',
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

function salaryReviewCsvValue(lastSalary: string | null | undefined, reviewDate: string | null | undefined) {
  const salary = lastSalary ?? ''
  const review = dateInputValue(reviewDate)
  return [salary, review ? `Review: ${review}` : ''].filter(Boolean).join(' | ')
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

function spreadsheetDate(value: string) {
  const normalized = value.trim()
  if (!normalized) return ''
  const iso = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  const local = normalized.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/)
  const monthYear = normalized.match(/^(\d{1,2})[/.\-](\d{4})$/)
  if (!iso && !local && !monthYear) throw new Error(`Invalid date "${normalized}". Use DD/MM/YYYY, MM/DD/YYYY, or YYYY-MM-DD.`)
  let year: string
  let month: string
  let day: string
  if (iso) {
    [, year, month, day] = iso
  } else if (local) {
    const first = Number(local[1])
    const second = Number(local[2])
    year = local[3]
    if (first > 12) {
      day = local[1]
      month = local[2]
    } else if (second > 12) {
      month = local[1]
      day = local[2]
    } else {
      day = local[1]
      month = local[2]
    }
  } else {
    year = monthYear![2]
    month = monthYear![1]
    day = '01'
  }
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) {
    throw new Error(`Invalid calendar date "${normalized}". Use DD/MM/YYYY, MM/DD/YYYY, or YYYY-MM-DD.`)
  }
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00.000Z`
}

function optionalSalary(value: string) {
  const normalized = value.trim()
  if (!normalized || /^(?:[-–—]|n\/?a)$/i.test(normalized)) return undefined
  const amount = normalized.replace(/[₦,\s]/g, '').replace(/^NGN/i, '')
  if (!/^\d+(\.\d{1,2})?$/.test(amount)) throw new Error(`Invalid salary "${normalized}". Leave it blank if unknown.`)
  return amount
}

async function exportEmployeesCsv(employees: Employee[]) {
  const personalRecords = await Promise.all(employees.map(async (employee) => {
    try {
      return await api.get<EmployeePersonalInformationRecord>(`/employees/${employee.id}/personal-information`)
    } catch {
      return null
    }
  }))
  const columns = employeeImportHeaders
  const rows = employees.map((employee, index) => {
    const personal = personalRecords[index]?.data
    const dateJoined = dateInputValue(employee.dateJoined)
    const monthYear = dateJoined ? `${dateJoined.slice(5, 7)}/${dateJoined.slice(0, 4)}` : ''
    return [
      employee.employeeNumber, employee.lastName, employee.firstName, employee.middleName,
      employee.gender, dateInputValue(employee.dateOfBirth), employee.phone,
      employee.department?.name, employee.position?.title, employee.address,
      personal?.personalEmail, employee.email, typeLabels[employee.employmentType],
      personal?.taxId, dateJoined, employee.employmentMonthYear ?? monthYear, personal?.bankName, personal?.accountName,
      personal?.accountNumber, employee.grossSalary, salaryReviewCsvValue(employee.lastSalary, employee.reviewDate),
      employee.office?.name,
    ]
  })
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

function htmlCell(value: string | null | undefined) {
  return (value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character)
}

async function exportEmployeesPdf(employees: Employee[]) {
  const printWindow = window.open('', '_blank')
  if (!printWindow) throw new Error('Allow pop-ups to create the employee PDF.')
  try {
    const personalRecords = await Promise.all(employees.map(async (employee) => {
      try { return await api.get<EmployeePersonalInformationRecord>(`/employees/${employee.id}/personal-information`) }
      catch { return null }
    }))
    const columns = employeeImportHeaders
    const rows = employees.map((employee, index) => {
      const personal = personalRecords[index]?.data
      const dateJoined = dateInputValue(employee.dateJoined)
      return [employee.employeeNumber, employee.lastName, employee.firstName, employee.middleName, employee.gender,
        dateInputValue(employee.dateOfBirth), employee.phone, employee.department?.name, employee.position?.title,
        employee.address, personal?.personalEmail, employee.email, typeLabels[employee.employmentType], personal?.taxId,
        dateJoined, employee.employmentMonthYear ?? (dateJoined ? `${dateJoined.slice(5, 7)}/${dateJoined.slice(0, 4)}` : ''), personal?.bankName,
        personal?.accountName, personal?.accountNumber, employee.grossSalary, salaryReviewCsvValue(employee.lastSalary, employee.reviewDate), employee.office?.name]
    })
    const table = `<table><thead><tr>${columns.map((column) => `<th>${htmlCell(column)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((value) => `<td>${htmlCell(value) || '<span class="empty">—</span>'}</td>`).join('')}</tr>`).join('')}</tbody></table>`
    const generatedAt = new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date())
    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fluidé Homes · Employee Directory</title><style>
      @page{size:A3 landscape;margin:11mm}*{box-sizing:border-box}body{margin:0;color:#1d2939;font:9px Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}.sheet{max-width:1600px;margin:0 auto}.letterhead{display:flex;align-items:center;justify-content:space-between;gap:28px;padding:0 0 14px;border-bottom:3px solid #262626}.brand img{display:block;width:190px;height:auto;max-height:72px;object-fit:contain;object-position:left center}.offices{display:flex;gap:30px}.office{max-width:250px;padding-left:12px;border-left:2px solid #d6a84f}.office strong{display:block;margin-bottom:4px;color:#262626;font-size:9px;text-transform:uppercase;letter-spacing:.08em}.office span{display:block;color:#475467;font-size:9px;line-height:1.45}.report-heading{display:flex;align-items:flex-end;justify-content:space-between;margin:16px 0 12px}.report-heading h1{margin:0 0 4px;color:#262626;font-size:21px;letter-spacing:.01em}.report-heading p{margin:0;color:#667085;font-size:10px}.report-meta{text-align:right;color:#475467;font-size:9px;line-height:1.6}.report-meta strong{color:#1d2939}.table-frame{border:1px solid #d0d5dd;border-radius:5px;overflow:hidden}table{width:100%;border-collapse:collapse;table-layout:fixed}thead{display:table-header-group}th,td{border-right:1px solid #e4e7ec;border-bottom:1px solid #e4e7ec;padding:6px 5px;text-align:left;vertical-align:top;overflow-wrap:anywhere;line-height:1.3}th:last-child,td:last-child{border-right:0}th{background:#262626;color:#fff;font-size:7px;font-weight:700;letter-spacing:.035em;text-transform:uppercase}td{font-size:7.2px}tbody tr:nth-child(even){background:#f7f8fa}tbody tr{break-inside:avoid;page-break-inside:avoid}.empty{color:#98a2b3}.report-footer{display:flex;justify-content:space-between;gap:20px;margin-top:9px;padding-top:7px;border-top:1px solid #d0d5dd;color:#667085;font-size:8px}.screen-hint{margin:12px 0;color:#475467;font-size:12px}@media screen{body{padding:28px;background:#f2f4f7}.sheet{padding:24px;background:#fff;box-shadow:0 4px 18px #10182820}.screen-hint{display:block}}@media print{.screen-hint{display:none}.sheet{max-width:none}}
      </style></head><body><main class="sheet"><header class="letterhead"><div class="brand"><img src="/fluide-logo.png" alt="Fluidé Homes"></div><div class="offices"><div class="office"><strong>Lagos Office</strong><span>27A Admiralty Way, Lekki Phase I,<br>Lagos, Nigeria</span></div><div class="office"><strong>Abuja Office</strong><span>8 Tarkwa Cres, Wuse,<br>Abuja 904101, Federal Capital Territory, Nigeria</span></div></div></header><section class="report-heading"><div><h1>Employee Directory</h1><p>Confidential workforce records</p></div><div class="report-meta"><div><strong>${employees.length}</strong> ${employees.length === 1 ? 'employee' : 'employees'}</div><div>Generated ${htmlCell(generatedAt)}</div></div></section><p class="screen-hint">Use your browser’s print dialog to save or print this directory as a PDF.</p><div class="table-frame">${table}</div><footer class="report-footer"><span>Fluidé Homes · Human Resources</span><span>Confidential · For authorised internal use</span></footer></main><script>window.onload=()=>{const logo=document.querySelector('img');if(!logo||logo.complete)window.print();else logo.onload=()=>window.print()}</script></body></html>`)
    printWindow.document.close()
  } catch (error) {
    printWindow.close()
    throw error
  }
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
    ...(form.grossSalary && { grossSalary: form.grossSalary }),
    ...(form.lastSalary && { lastSalary: form.lastSalary }),
    ...(form.reviewDate && { reviewDate: new Date(`${form.reviewDate}T00:00:00.000Z`).toISOString() }),
    ...(form.departmentId && { departmentId: form.departmentId }),
    ...(form.positionId && { positionId: form.positionId }),
    ...(form.managerId && { managerId: form.managerId }),
    officeId: form.officeId,
  }
}

async function requestEmployeeData() {
  return Promise.allSettled([
    api.get<Employee[]>('/employees'),
    api.get<Department[]>('/departments'),
    api.get<Position[]>('/positions'),
    api.get<Office[]>('/security/office-options'),
  ])
}

function formFromEmployee(employee: Employee): EmployeeForm {
  return {
    employeeNumber: employee.employeeNumber,
    firstName: employee.firstName,
    lastName: employee.lastName,
    middleName: employee.middleName ?? '',
    email: employee.email ?? '',
    phone: employee.phone ?? '',
    dateOfBirth: dateInputValue(employee.dateOfBirth),
    gender: employee.gender ?? '',
    address: employee.address ?? '',
    employmentType: employee.employmentType,
    employmentStatus: employee.employmentStatus,
    dateJoined: dateInputValue(employee.dateJoined),
    confirmationDate: dateInputValue(employee.confirmationDate),
    grossSalary: employee.grossSalary ?? '',
    lastSalary: employee.lastSalary ?? '',
    reviewDate: dateInputValue(employee.reviewDate),
    departmentId: employee.departmentId ?? '',
    positionId: employee.positionId ?? '',
    managerId: employee.managerId ?? '',
    officeId: employee.officeId ?? '',
    taxId: employee.personalInformation?.data.taxId ?? '',
    personalEmail: employee.personalInformation?.data.personalEmail ?? '',
    bankName: employee.personalInformation?.data.bankName ?? '',
    accountName: employee.personalInformation?.data.accountName ?? '',
    accountNumber: employee.personalInformation?.data.accountNumber ?? '',
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
  offices,
  canEdit,
  onClose,
  onSave,
}: {
  initialEmployee: Employee | null
  departments: Department[]
  positions: Position[]
  employees: Employee[]
  offices: Office[]
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
              <div><strong>Profile photo</strong><span>PNG, JPG, or WebP · up to 500 KB</span><label className="button-secondary employee-photo-select"><Upload size={14} />{photoFile ? 'Change photo' : 'Upload photo'}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; if (file.size > 500 * 1024) { setError('Profile photos must be 500 KB or smaller.'); return } setError(''); setPhotoFile(file) }} /></label></div>
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
              Office
              <select value={form.officeId} required onChange={(event) => setField('officeId', event.target.value)}>
                <option value="">Select an office</option>
                {offices.filter((office) => office.isActive).map((office) => <option key={office.id} value={office.id}>{office.name} ({office.code})</option>)}
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
              Gross salary (NGN) <span className="field-optional">Optional</span>
              <input type="number" min="0" step="0.01" value={form.grossSalary} onChange={(event) => setField('grossSalary', event.target.value)} />
            </label>
            <label>
              Last salary (NGN) <span className="field-optional">Optional</span>
              <input type="number" min="0" step="0.01" value={form.lastSalary} onChange={(event) => setField('lastSalary', event.target.value)} />
            </label>
            <label>
              Review date <span className="field-optional">Optional</span>
              <input type="date" value={form.reviewDate} onChange={(event) => setField('reviewDate', event.target.value)} />
            </label>
            <label>
              Tax ID <span className="field-optional">Optional</span>
              <input value={form.taxId} onChange={(event) => setField('taxId', event.target.value)} maxLength={80} />
            </label>
            <label>
              Personal email <span className="field-optional">Optional</span>
              <input type="email" value={form.personalEmail} onChange={(event) => setField('personalEmail', event.target.value)} maxLength={160} />
            </label>
            <label>
              Bank name <span className="field-optional">Optional</span>
              <input value={form.bankName} onChange={(event) => setField('bankName', event.target.value)} maxLength={120} />
            </label>
            <label>
              Account name <span className="field-optional">Optional</span>
              <input value={form.accountName} onChange={(event) => setField('accountName', event.target.value)} maxLength={160} />
            </label>
            <label>
              Account number <span className="field-optional">Optional</span>
              <input value={form.accountNumber} onChange={(event) => setField('accountNumber', event.target.value)} maxLength={80} />
            </label>
            <label>
              Gender <span className="field-optional">Optional</span>
              <select
                value={form.gender}
                onChange={(event) => setField('gender', event.target.value)}
              >
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
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
  canViewCompensation,
}: {
  employee: Employee
  onClose: () => void
  canViewCompensation: boolean
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
          <div><dt>Email</dt><dd>{employee.email || '—'}</dd></div>
          <div><dt>Phone</dt><dd>{employee.phone || '—'}</dd></div>
          <div><dt>Date of birth</dt><dd>{formatDate(employee.dateOfBirth)}</dd></div>
          <div><dt>Gender</dt><dd>{employee.gender || '—'}</dd></div>
          <div><dt>Department</dt><dd>{employee.department?.name || 'Not assigned'}</dd></div>
          <div><dt>Office</dt><dd>{employee.office?.name || 'Not assigned'}</dd></div>
          <div><dt>Position</dt><dd>{employee.position?.title || 'Not assigned'}</dd></div>
          <div><dt>Manager</dt><dd>{employee.manager ? employeeName(employee.manager) : '—'}</dd></div>
          <div><dt>Employment type</dt><dd>{typeLabels[employee.employmentType]}</dd></div>
          <div><dt>Employment status</dt><dd>{statusLabels[employee.employmentStatus]}</dd></div>
          <div><dt>Start date</dt><dd>{formatDate(employee.dateJoined)}</dd></div>
          {canViewCompensation && <><div><dt>Gross salary (NGN)</dt><dd>{employee.grossSalary ? Number(employee.grossSalary).toLocaleString('en-NG') : '—'}</dd></div>
          <div><dt>Last salary (NGN)</dt><dd>{employee.lastSalary ? Number(employee.lastSalary).toLocaleString('en-NG') : '—'}</dd></div>
          <div><dt>Review date</dt><dd>{formatDate(employee.reviewDate)}</dd></div></>}
          <div><dt>Confirmation date</dt><dd>{formatDate(employee.confirmationDate)}</dd></div>
          <div><dt>Linked account</dt><dd>{employee.user ? `${employee.user.email} (${employee.user.status.toLowerCase()})` : 'No user account linked'}</dd></div>
          <div className="employee-detail-full"><dt>Address</dt><dd>{employee.address || '—'}</dd></div>
        </dl>
        {employee.personalInformation !== undefined && (
          <section className="employee-personal-details">
            <div className="employee-personal-details-heading">
              <div><p className="eyebrow">STAFF SUBMITTED</p><h3>Personal information</h3></div>
              <span>{employee.personalInformation?.reviewStatus === 'PENDING' ? 'Pending HR review' : employee.personalInformation?.reviewStatus === 'REJECTED' ? 'Returned for updates' : employee.personalInformation?.reviewStatus === 'APPROVED' ? 'Approved' : ''}{employee.personalInformation?.submittedAt ? ` · Submitted ${formatDate(employee.personalInformation.submittedAt)}` : employee.personalInformation?.updatedAt ? ` · Updated ${formatDate(employee.personalInformation.updatedAt)}` : ''}</span>
            </div>
            {employee.personalInformation?.reviewComment && <p className="employee-inline-warning">HR comment: {employee.personalInformation.reviewComment}</p>}
            {!personalInformation ? <p className="employee-personal-empty">This employee has not added personal information yet.</p> : (
              <>
                <div className="employee-personal-block">
                  <h4>Tax and bank details</h4>
                  <dl className="employee-detail-list">
                    <div><dt>Tax ID</dt><dd>{personalInformation.taxId || '—'}</dd></div>
                    <div><dt>Personal email</dt><dd>{personalInformation.personalEmail || '—'}</dd></div>
                    <div><dt>Bank name</dt><dd>{personalInformation.bankName || '—'}</dd></div>
                    <div><dt>Account name</dt><dd>{personalInformation.accountName || '—'}</dd></div>
                    <div><dt>Account number</dt><dd>{personalInformation.accountNumber || '—'}</dd></div>
                    <div><dt>Pension provider</dt><dd>{personalInformation.pensionProvider || '—'}</dd></div>
                    <div><dt>Pension number</dt><dd>{personalInformation.pensionNumber || '—'}</dd></div>
                    <div><dt>NHF number</dt><dd>{personalInformation.nhfNumber || '—'}</dd></div>
                  </dl>
                </div>
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

function EmployeeInformationReviewsSection({ initialFocusEmployeeId, onReviewed }: { initialFocusEmployeeId?: string | null; onReviewed: (record: EmployeeInformationReview, emailSent: boolean, bellNotificationSent: boolean) => void }) {
  const [records, setRecords] = useState<EmployeeInformationReview[]>([])
  const [comments, setComments] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let active = true
    setIsLoading(true)
    api.get<EmployeeInformationReview[]>('/employees/personal-information/reviews')
      .then((result) => { if (active) setRecords(result) })
      .catch((cause: unknown) => {
        if (!active) return
        setRecords([])
        setError(cause instanceof ApiError && cause.status === 401 ? 'Your session expired. Sign in again to review employee submissions.' : cause instanceof ApiError ? cause.message : 'Could not load employee records for review.')
      })
      .finally(() => { if (active) setIsLoading(false) })
    return () => { active = false }
  }, [refreshKey])

  useEffect(() => {
    if (!initialFocusEmployeeId || isLoading) return
    document.getElementById(`pending-review-${initialFocusEmployeeId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [initialFocusEmployeeId, isLoading, records])

  async function decide(record: EmployeeInformationReview, status: 'APPROVED' | 'REJECTED') {
    const comment = comments[record.employeeId]?.trim() ?? ''
    if (status === 'REJECTED' && !comment) { setError('Add a comment before returning a record for updates.'); return }
    const approved = status === 'APPROVED'
    if (!window.confirm(approved ? `Approve ${record.employee.firstName} ${record.employee.lastName}'s proposed personal information changes?` : `Reject ${record.employee.firstName} ${record.employee.lastName}'s proposed personal information changes?`)) return
    setBusyId(record.employeeId)
    setError('')
    try {
      const result = await api.patch<EmployeeInformationReview & { emailSent: boolean; bellNotificationSent: boolean }>(`/employees/${record.employeeId}/personal-information/review`, { status, comment: comment || undefined })
      onReviewed(result, result.emailSent, result.bellNotificationSent)
      setComments((current) => { const next = { ...current }; delete next[record.employeeId]; return next })
      setRefreshKey((current) => current + 1)
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) setRefreshKey((current) => current + 1)
      setError(cause instanceof ApiError && cause.status === 401 ? 'Your session expired. Sign in again to review employee submissions.' : cause instanceof ApiError ? cause.message : 'Could not review this employee record.')
    } finally {
      setBusyId(null)
    }
  }

  function sectionLabel(key: string) { return key.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase()) }
  function valueLabel(key: string) { return sectionLabel(key) }
  function formatReviewValue(value: unknown) {
    if (value === null || value === undefined || value === '') return '—'
    if (Array.isArray(value)) return value.length ? value.map((entry, index) => {
      if (typeof entry !== 'object' || entry === null) return `${index + 1}. ${String(entry)}`
      const fields = Object.entries(entry as Record<string, unknown>).filter(([, field]) => field !== '' && field !== null && field !== undefined).map(([field, fieldValue]) => `${valueLabel(field)}: ${String(fieldValue)}`)
      return `${index + 1}. ${fields.join(' · ') || '—'}`
    }).join('\n') : 'None provided'
    if (typeof value === 'object') return Object.entries(value as Record<string, unknown>).map(([field, fieldValue]) => `${valueLabel(field)}: ${String(fieldValue || '—')}`).join('\n') || '—'
    return String(value)
  }

  return <section className="employee-pending-review-section" aria-labelledby="employee-review-title">
      <header className="employee-pending-review-heading"><div><p className="eyebrow">PEOPLE. PERFORMANCE. PROGRESS.</p><h2 id="employee-review-title">Pending Personal Information Reviews</h2><p>Compare submitted details with the currently approved record before deciding.</p></div><button className="button-secondary" type="button" onClick={() => { setError(''); setRefreshKey((current) => current + 1) }} disabled={isLoading}>{isLoading ? <LoaderCircle className="loading-icon" size={15} /> : <RotateCw size={15} />} Refresh</button></header>
      {error && <p className="employee-form-error" role="alert"><AlertCircle size={15} />{error}</p>}
      {isLoading ? <div className="employees-state"><LoaderCircle className="loading-icon" size={18} />Loading submitted records…</div> : error ? null : records.length === 0 ? <div className="employees-state empty-directory"><Check size={22} /><h2>No pending personal information reviews</h2><p>New employee submissions will appear here.</p></div> : <div className="employee-record-review-list">{records.map((record) => {
        const approvedData = record.data as unknown as Record<string, unknown>
        const proposal = (record.proposedData ?? record.data) as unknown as Record<string, unknown>
        const changes = Object.entries(proposal).filter(([key, value]) => JSON.stringify(approvedData[key] ?? null) !== JSON.stringify(value ?? null))
        return <article className="employee-record-review-card" id={`pending-review-${record.employeeId}`} key={record.employeeId}>
        <header><div><h3>{record.employee.firstName} {record.employee.lastName}</h3><p>{record.employee.employeeNumber}{record.employee.email ? ` · ${record.employee.email}` : ''}{record.employee.department ? ` · ${record.employee.department.name}` : ''}</p></div><span>Submitted {formatDate(record.submittedAt)}</span></header>
        <div className="employee-record-review-sections">{changes.length ? changes.map(([section, proposedValue]) => <section key={section}><h4>{sectionLabel(section)}</h4><div className="employee-review-comparison"><div><strong>Current approved value</strong><p>{formatReviewValue(approvedData[section])}</p></div><div><strong>Proposed value</strong><p>{formatReviewValue(proposedValue)}</p></div></div></section>) : <p className="muted-value">No field differences found. Review the submitted record before deciding.</p>}</div>
        <label className="employee-review-comment">HR comment <span>(required to reject)</span><textarea rows={2} value={comments[record.employeeId] ?? ''} onChange={(event) => setComments((current) => ({ ...current, [record.employeeId]: event.target.value }))} maxLength={1000} placeholder="Add a reason or guidance for the employee" /></label>
        <footer><button className="button-secondary" type="button" onClick={() => void decide(record, 'REJECTED')} disabled={busyId !== null}>{busyId === record.employeeId ? 'Saving…' : 'Reject'}</button><button className="button-primary" type="button" onClick={() => void decide(record, 'APPROVED')} disabled={busyId !== null}>{busyId === record.employeeId ? 'Saving…' : 'Approve'}</button></footer>
      </article>})}</div>}
    </section>
}

export function EmployeesPage() {
  const { hasPermission, user } = useAuth()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [offices, setOffices] = useState<Office[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<EmploymentStatus | 'ALL'>('ALL')
  const [joinedFrom, setJoinedFrom] = useState('')
  const [joinedTo, setJoinedTo] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [staffIdSort, setStaffIdSort] = useState<'asc' | 'desc'>('asc')
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([])
  const [bulkStatus, setBulkStatus] = useState<EmploymentStatus | ''>('')
  const [bulkDepartmentId, setBulkDepartmentId] = useState('')
  const [bulkPositionId, setBulkPositionId] = useState('')
  const [bulkOfficeId, setBulkOfficeId] = useState('')
  const [isBulkSaving, setIsBulkSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [lookupWarning, setLookupWarning] = useState('')
  const [dialogEmployee, setDialogEmployee] = useState<Employee | null | undefined>(undefined)
  const [detailEmployee, setDetailEmployee] = useState<Employee | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [deletingEmployeeId, setDeletingEmployeeId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [isImporting, setIsImporting] = useState(false)
  const [importFailures, setImportFailures] = useState<EmployeeImportFailure[]>([])
  const fileInput = useRef<HTMLInputElement>(null)
  const selectPageCheckbox = useRef<HTMLInputElement>(null)

  const canCreate = hasPermission('employee:create')
  const canUpdate = hasPermission('employee:update')
  const canDelete = hasPermission('employee:delete')
  const canRead = hasPermission('employee:read')
  const canExport = user?.roles.some((role) => role === 'SUPER_ADMIN' || role === 'HR') ?? false
  const canReviewPersonalInformation = user?.roles.some((role) => role === 'SUPER_ADMIN' || role === 'HR') ?? false
  const reviewFocusEmployeeId = new URLSearchParams(window.location.search).get('employeeId')

  useEffect(() => {
    if (!canRead) return
    let cancelled = false

    void requestEmployeeData().then(([employeeResult, departmentResult, positionResult, officeResult]) => {
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
      if (officeResult.status === 'fulfilled') setOffices(officeResult.value)
      else warnings.push('office')
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
        employee.office?.name,
        employee.position?.title,
      ].filter(Boolean).join(' ').toLowerCase()
      return matchesStatus && matchesDate && (!normalizedSearch || searchableText.includes(normalizedSearch))
    }).sort((a, b) => {
      const order = a.employeeNumber.localeCompare(b.employeeNumber, undefined, { numeric: true, sensitivity: 'base' })
      return staffIdSort === 'asc' ? order : -order
    })
  }, [employees, joinedFrom, joinedTo, search, statusFilter, staffIdSort])

  const totalPages = Math.ceil(filteredEmployees.length / employeePageSize)
  const visiblePage = Math.min(currentPage, Math.max(totalPages, 1))
  const paginatedEmployees = filteredEmployees.slice(
    (visiblePage - 1) * employeePageSize,
    visiblePage * employeePageSize,
  )
  const pageEmployeeIds = paginatedEmployees.map((employee) => employee.id)
  const selectedPageCount = pageEmployeeIds.filter((id) => selectedEmployeeIds.includes(id)).length
  const allPageSelected = pageEmployeeIds.length > 0 && selectedPageCount === pageEmployeeIds.length

  useEffect(() => {
    if (selectPageCheckbox.current) selectPageCheckbox.current.indeterminate = selectedPageCount > 0 && !allPageSelected
  }, [selectedPageCount, allPageSelected])

  function togglePageSelection(checked: boolean) {
    setSelectedEmployeeIds((current) => {
      const pageIds = new Set(pageEmployeeIds)
      return checked ? [...new Set([...current, ...pageEmployeeIds])] : current.filter((id) => !pageIds.has(id))
    })
  }

  function clearBulkUpdateFields() {
    setBulkStatus('')
    setBulkDepartmentId('')
    setBulkPositionId('')
    setBulkOfficeId('')
  }

  async function applyBulkUpdate(overrides?: Partial<Pick<Employee, 'employmentStatus'>>) {
    const patch: Record<string, string> = { ...overrides }
    if (!overrides) {
      if (bulkStatus) patch.employmentStatus = bulkStatus
      if (bulkDepartmentId) patch.departmentId = bulkDepartmentId
      if (bulkPositionId) patch.positionId = bulkPositionId
      if (bulkOfficeId) patch.officeId = bulkOfficeId
    }
    if (!Object.keys(patch).length || isBulkSaving) return
    const selected = employees.filter((employee) => selectedEmployeeIds.includes(employee.id))
    setIsBulkSaving(true)
    setNotice('')
    const results = await Promise.allSettled(selected.map((employee) => api.patch<Employee>(`/employees/${employee.id}`, patch)))
    const updatedById = new Map<string, Employee>()
    results.forEach((result, index) => { if (result.status === 'fulfilled') updatedById.set(selected[index].id, result.value) })
    setEmployees((current) => current.map((employee) => updatedById.get(employee.id) ?? employee))
    const failures = results.filter((result) => result.status === 'rejected').length
    setNotice(failures ? `Updated ${results.length - failures} employee(s); ${failures} could not be updated.` : `Updated ${results.length} employee(s).`)
    setIsBulkSaving(false)
    setSelectedEmployeeIds([])
    clearBulkUpdateFields()
  }

  async function deleteSelectedEmployees() {
    const selected = employees.filter((employee) => selectedEmployeeIds.includes(employee.id))
    if (!selected.length || !window.confirm(`Delete ${selected.length} selected employee(s)? This cannot be undone.`)) return
    setIsBulkSaving(true)
    setNotice('')
    const results = await Promise.allSettled(selected.map((employee) => api.delete<{ id: string; deleted: boolean }>(`/employees/${employee.id}`)))
    const deletedIds = new Set(selected.filter((_, index) => results[index].status === 'fulfilled').map((employee) => employee.id))
    setEmployees((current) => current.filter((employee) => !deletedIds.has(employee.id)))
    setNotice(results.some((result) => result.status === 'rejected') ? `Deleted ${deletedIds.size} employee(s); some could not be deleted.` : `Deleted ${deletedIds.size} employee(s).`)
    setSelectedEmployeeIds([])
    setIsBulkSaving(false)
  }

  async function saveEmployee(form: EmployeeForm, photoFile: File | null) {
    if (isSaving) return
    setIsSaving(true)
    try {
      const payload = inputPayload(form)
      if (dialogEmployee) {
        let updated = await api.patch<Employee>(`/employees/${dialogEmployee.id}`, payload)
        if (photoFile) updated = await api.uploadFile<Employee>(`/employees/${updated.id}/profile-photo`, photoFile)
        const personalInformation = await api.put<EmployeePersonalInformationRecord>(`/employees/${updated.id}/personal-information`, {
          taxId: form.taxId.trim(),
          personalEmail: form.personalEmail.trim(),
          bankName: form.bankName.trim(),
          accountName: form.accountName.trim(),
          accountNumber: form.accountNumber.trim(),
        })
        updated = { ...updated, personalInformation }
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

  async function deleteEmployee(employee: Employee) {
    if (deletingEmployeeId) return
    if (!window.confirm(`Delete ${employeeName(employee)}? This cannot be undone.`)) return

    setDeletingEmployeeId(employee.id)
    setNotice('')
    try {
      await api.delete<{ id: string; deleted: boolean }>(`/employees/${employee.id}`)
      setEmployees((current) => current.filter((item) => item.id !== employee.id))
      setDetailEmployee((current) => current?.id === employee.id ? null : current)
      setNotice(`${employeeName(employee)} was deleted.`)
    } catch (cause) {
      setNotice(cause instanceof ApiError ? cause.message : `Unable to delete ${employeeName(employee)}.`)
    } finally {
      setDeletingEmployeeId(null)
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
      const requiredHeaders = ['staff id', 'surname', 'first name', 'official email']
      const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header.toLowerCase()))
      if (missingHeaders.length) throw new Error(`Missing template columns: ${missingHeaders.join(', ')}`)
      if (!headers.includes('date of employment')) throw new Error('Include the Date of Employment column. M/Y of Employ is optional free text.')
      if (!headers.includes('branch')) throw new Error('Include a Branch column that matches an office name or code.')

      const dataRows = rows.slice(1)
      if (dataRows.length > 50) throw new Error('Import up to 50 employees per CSV file.')

      const column = (values: string[], name: string) => (values[headers.indexOf(name.toLowerCase())] ?? '').trim()
      const employeesToImport = dataRows.map((values, index) => {
        const dateOfEmployment = column(values, 'Date of Employment')
        const dateJoined = dateOfEmployment ? spreadsheetDate(dateOfEmployment) : ''
        if (!dateJoined) throw new Error(`Row ${index + 2}: Date of Employment is required.`)
        const jobType = column(values, 'Job Type').toLowerCase().replace(/[ _-]/g, '')
        const matchedJobType = Object.entries(typeLabels).find(([, label]) => label.toLowerCase().replace(/[ _-]/g, '') === jobType)
        if (jobType && !matchedJobType) throw new Error(`Row ${index + 2}: unsupported Job Type "${column(values, 'Job Type')}".`)
        const employmentType = (matchedJobType?.[0] ?? 'FULL_TIME') as EmploymentType
        const unitName = column(values, 'Unit').toLowerCase()
        const positionName = column(values, 'Job Title').toLowerCase()
        const department = departments.find((item) => item.name.trim().toLowerCase() === unitName)
        const position = positions.find((item) => item.title.trim().toLowerCase() === positionName)
        const branchName = column(values, 'Branch').toLowerCase()
        const office = offices.find((item) => item.isActive && [item.name, item.code].some((value) => value.trim().toLowerCase() === branchName))
        const salaryReview = column(values, 'Last Salary Review')
        const salaryReviewParts = salaryReview.match(/^(.*?)(?:\s*\|\s*Review:\s*(.+))?$/i)
        const legacyLastSalary = column(values, 'Last Salary')
        const reviewDate = salaryReviewParts?.[2]
          ? spreadsheetDate(salaryReviewParts[2])
          : spreadsheetDate(column(values, 'Review Date')) || undefined
        if (unitName && !department) throw new Error(`Row ${index + 2}: Unit "${column(values, 'Unit')}" does not match an existing unit.`)
        if (positionName && !position) throw new Error(`Row ${index + 2}: Job Title "${column(values, 'Job Title')}" does not match an existing title.`)
        if (!office) throw new Error(`Row ${index + 2}: Branch "${column(values, 'Branch')}" does not match an active office name or code.`)
        return {
          employeeNumber: column(values, 'Staff ID'),
          lastName: column(values, 'Surname'),
          firstName: column(values, 'First Name'),
          middleName: column(values, 'Other Name'),
          gender: column(values, 'Gender'),
          dateOfBirth: spreadsheetDate(column(values, 'D.O.B')) || undefined,
          phone: column(values, 'Contact'),
          departmentId: department?.id,
          positionId: position?.id,
          address: column(values, 'Home Address'),
          personalEmail: column(values, 'Personal Email'),
          email: column(values, 'Official Email'),
          employmentType,
          taxId: column(values, 'Tax ID'),
          dateJoined,
          employmentMonthYear: column(values, 'M/Y of Employ'),
          officeId: office.id,
          bankName: column(values, 'Bank Name'),
          accountName: column(values, 'Account Name'),
          accountNumber: column(values, 'Account Number'),
          grossSalary: optionalSalary(column(values, 'Gross Salary')),
          lastSalary: optionalSalary(legacyLastSalary || salaryReviewParts?.[1] || ''),
          reviewDate,
        }
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
          {canExport && <button className="button-secondary employee-export-button" type="button" onClick={() => void exportEmployeesCsv(filteredEmployees)} disabled={filteredEmployees.length === 0}>
            <Download size={15} aria-hidden="true" /> Export CSV
          </button>}
          {canExport && <button className="button-secondary employee-export-button" type="button" onClick={() => void exportEmployeesPdf(filteredEmployees).catch((cause: unknown) => setNotice(cause instanceof Error ? cause.message : 'Unable to create employee PDF.'))} disabled={filteredEmployees.length === 0}>
            <FileDown size={15} aria-hidden="true" /> Export PDF
          </button>}
          {canCreate && (
            <>
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

      {canCreate && <p className="employee-import-help">Use the supplied HR column headings in a CSV saved from Excel. Date of Employment and D.O.B accept DD/MM/YYYY, MM/DD/YYYY, or YYYY-MM-DD. M/Y of Employ accepts any text. Unit and Job Title must match existing records, and Branch must match an active office name or code. Upload up to 50 employees at a time.</p>}

      {notice && (
        <div className="employee-notice" role="status">
          <Check size={15} aria-hidden="true" />
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} aria-label="Dismiss message"><X size={15} /></button>
        </div>
      )}

      {canReviewPersonalInformation && <EmployeeInformationReviewsSection initialFocusEmployeeId={reviewFocusEmployeeId} onReviewed={(record, emailSent, bellNotificationSent) => { setNotice(`${record.employee.firstName} ${record.employee.lastName}'s information was reviewed.${emailSent ? ' Email sent.' : ' Email delivery failed; check SMTP configuration.'}${bellNotificationSent ? ' Employee bell notification sent.' : ' Employee bell notification could not be created.'}`); setEmployees((current) => current.map((employee) => employee.id === record.employeeId ? { ...employee, personalInformation: { data: record.reviewStatus === 'APPROVED' ? record.proposedData ?? record.data : record.data, proposedData: record.reviewStatus === 'REJECTED' ? record.proposedData : null, updatedAt: record.updatedAt, reviewStatus: record.reviewStatus, reviewComment: record.reviewComment, reviewedAt: record.reviewedAt, submittedAt: record.submittedAt } } : employee)) }} />}

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
          <table className="employee-table employee-directory-table">
            <thead>
              <tr>
                {(canUpdate || canDelete) && <th scope="col" className="employee-select-column"><input ref={selectPageCheckbox} type="checkbox" aria-label="Select employees on this page" checked={allPageSelected} onChange={(event) => togglePageSelection(event.target.checked)} /></th>}
                <th scope="col" aria-sort={staffIdSort === 'asc' ? 'ascending' : 'descending'}><button className="employee-sort-button" type="button" onClick={() => setStaffIdSort((direction) => direction === 'asc' ? 'desc' : 'asc')} aria-label={`Sort Staff ID ${staffIdSort === 'asc' ? 'descending' : 'ascending'}`}>Staff ID {staffIdSort === 'asc' ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />}</button></th>
                <th scope="col">Surname</th><th scope="col">First Name</th><th scope="col">Other Name</th>
                <th scope="col">Gender</th><th scope="col">D.O.B</th><th scope="col">Contact</th>
                <th scope="col">Unit</th><th scope="col">Job Title</th><th scope="col">Home Address</th>
                <th scope="col">Personal Email</th><th scope="col">Official Email</th><th scope="col">Job Type</th>
                <th scope="col">Tax ID</th><th scope="col">Date of Employment</th><th scope="col">M/Y of Employ</th>
                <th scope="col">Bank Name</th><th scope="col">Account Name</th><th scope="col">Account Number</th>
                <th scope="col">Gross Salary</th><th scope="col">Last Salary</th><th scope="col">Review Date</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {paginatedEmployees.map((employee) => (
                <tr key={employee.id}>
                  {(canUpdate || canDelete) && <td className="employee-select-column"><input type="checkbox" aria-label={`Select ${employeeName(employee)}`} checked={selectedEmployeeIds.includes(employee.id)} onChange={(event) => setSelectedEmployeeIds((current) => event.target.checked ? [...new Set([...current, employee.id])] : current.filter((id) => id !== employee.id))} /></td>}
                  <td><button className="text-button" type="button" onClick={() => void showDetails(employee)}>{employee.employeeNumber}</button></td>
                  <td>{employee.lastName}</td><td>{employee.firstName}</td><td>{employee.middleName || '—'}</td>
                  <td>{employee.gender || '—'}</td><td>{formatDate(employee.dateOfBirth)}</td><td>{employee.phone || '—'}</td>
                  <td>{employee.department?.name || '—'}</td><td>{employee.position?.title || '—'}</td><td>{employee.address || '—'}</td>
                  <td>{employee.personalInformation?.data.personalEmail || '—'}</td><td>{employee.email || '—'}</td><td>{typeLabels[employee.employmentType]}</td>
                  <td>{employee.personalInformation?.data.taxId || '—'}</td><td>{formatDate(employee.dateJoined)}</td>
                  <td>{employee.employmentMonthYear || '—'}</td>
                  <td>{employee.personalInformation?.data.bankName || '—'}</td><td>{employee.personalInformation?.data.accountName || '—'}</td>
                  <td>{employee.personalInformation?.data.accountNumber || '—'}</td><td>{employee.grossSalary || '—'}</td>
                  <td>{employee.lastSalary || '—'}</td><td>{formatDate(employee.reviewDate)}</td>
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
                    {canDelete && (
                      <button
                        className="icon-button danger-icon-button"
                        type="button"
                        onClick={() => void deleteEmployee(employee)}
                        aria-label={`Delete ${employeeName(employee)}`}
                        disabled={deletingEmployeeId === employee.id}
                      >
                        {deletingEmployeeId === employee.id
                          ? <LoaderCircle className="loading-icon" size={15} aria-hidden="true" />
                          : <Trash2 size={15} aria-hidden="true" />}
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

      {selectedEmployeeIds.length > 0 && (canUpdate || canDelete) && <div className="employee-bulk-toolbar" aria-label="Selected employee actions">
        <strong>{selectedEmployeeIds.length} selected</strong>
        {canUpdate && <>
          <label><span className="sr-only">Set status for selected employees</span><select value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value as EmploymentStatus | '')}><option value="">Status…</option>{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label><span className="sr-only">Set unit for selected employees</span><select value={bulkDepartmentId} onChange={(event) => setBulkDepartmentId(event.target.value)}><option value="">Unit…</option>{departments.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label><span className="sr-only">Set job title for selected employees</span><select value={bulkPositionId} onChange={(event) => setBulkPositionId(event.target.value)}><option value="">Job title…</option>{positions.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
          <label><span className="sr-only">Set branch for selected employees</span><select value={bulkOfficeId} onChange={(event) => setBulkOfficeId(event.target.value)}><option value="">Branch…</option>{offices.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <button className="button-secondary" type="button" onClick={() => void applyBulkUpdate()} disabled={isBulkSaving || !(bulkStatus || bulkDepartmentId || bulkPositionId || bulkOfficeId)}>{isBulkSaving ? 'Updating…' : 'Update selected'}</button>
          <button className="button-secondary" type="button" onClick={() => void applyBulkUpdate({ employmentStatus: 'ACTIVE' })} disabled={isBulkSaving}>Make active</button>
          <button className="button-secondary" type="button" onClick={() => void applyBulkUpdate({ employmentStatus: 'SUSPENDED' })} disabled={isBulkSaving}>Make inactive</button>
        </>}
        {canDelete && <button className="button-secondary danger-icon-button" type="button" onClick={() => void deleteSelectedEmployees()} disabled={isBulkSaving}>{isBulkSaving ? 'Working…' : 'Delete selected'}</button>}
        <button className="text-button" type="button" onClick={() => setSelectedEmployeeIds([])} disabled={isBulkSaving}>Clear selection</button>
      </div>}

      {dialogEmployee !== undefined && (
        <EmployeeFormDialog
          initialEmployee={dialogEmployee}
          departments={departments}
          positions={positions}
          employees={employees}
          offices={offices}
          canEdit={dialogEmployee ? canUpdate : canCreate}
          onClose={() => setDialogEmployee(undefined)}
          onSave={saveEmployee}
        />
      )}

      {detailEmployee && (
        <EmployeeDetailsDialog employee={detailEmployee} onClose={() => setDetailEmployee(null)} canViewCompensation={canUpdate} />
      )}
    </section>
  )
}
