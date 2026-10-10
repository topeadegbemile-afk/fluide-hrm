import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  Building2,
  Check,
  CirclePlus,
  LoaderCircle,
  Pencil,
  RotateCw,
  Search,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { ApiError, api } from '../lib/api'

type Department = {
  id: string
  name: string
  description: string | null
  isActive: boolean
  headEmployeeId?: string | null
  headEmployee?: { id: string; firstName: string; lastName: string } | null
  _count: { employees: number }
}

type DepartmentEmployee = {
  id: string
  employeeNumber: string
  firstName: string
  lastName: string
  email: string
  employmentStatus: string
}

type DepartmentDetails = Department & { employees: DepartmentEmployee[] }
type DepartmentForm = { name: string; description: string; isActive: boolean; headEmployeeId: string }
type DepartmentFilter = 'ALL' | 'ACTIVE' | 'INACTIVE'

const emptyDepartment: DepartmentForm = { name: '', description: '', isActive: true, headEmployeeId: '' }

async function requestDepartments() {
  return api.get<Department[]>('/departments')
}

function DepartmentDialog({
  department,
  onClose,
  onSave,
}: {
  department: Department | null
  onClose: () => void
  onSave: (form: DepartmentForm) => Promise<void>
}) {
  const [form, setForm] = useState<DepartmentForm>(department
    ? { name: department.name, description: department.description ?? '', isActive: department.isActive, headEmployeeId: department.headEmployeeId ?? '' }
    : emptyDepartment)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [employees, setEmployees] = useState<Array<{ id: string; firstName: string; lastName: string; department: { id: string } | null }>>([])

  useEffect(() => {
    if (!department) return
    void api.get<typeof employees>('/employees').then(setEmployees).catch(() => setEmployees([]))
  }, [department])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onSave(form)
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to save this department.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="employee-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="employee-dialog department-dialog" role="dialog" aria-modal="true" aria-labelledby="department-form-title">
        <header className="employee-dialog-header">
          <div>
            <p className="eyebrow">ORGANISATION</p>
            <h2 id="department-form-title">{department ? 'Edit department' : 'Add department'}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close form">
            <X size={19} aria-hidden="true" />
          </button>
        </header>
        <form className="employee-form" onSubmit={(event) => void submit(event)}>
          <div className="employee-form-grid">
            {department && <label className="employee-form-full">
              Department head <span className="field-optional">Optional</span>
              <select value={form.headEmployeeId} onChange={(event) => setForm((current) => ({ ...current, headEmployeeId: event.target.value }))}>
                <option value="">No department head selected</option>
                {employees.filter((employee) => employee.department?.id === department.id).map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName}</option>)}
              </select>
              <span className="field-optional">Only employees assigned to this department can be selected.</span>
            </label>}
            <label className="employee-form-full">
              Department name
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                required
                minLength={2}
                maxLength={100}
                autoFocus
              />
            </label>
            <label className="employee-form-full">
              Description <span className="field-optional">Optional</span>
              <textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                maxLength={500}
                rows={4}
              />
            </label>
            <label className="department-active-toggle">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
              />
              Active department
            </label>
          </div>
          {error && <p className="employee-form-error" role="alert"><AlertCircle size={15} />{error}</p>}
          <footer className="employee-dialog-actions">
            <button className="button-secondary" type="button" onClick={onClose}>Cancel</button>
            <button className="button-primary" type="submit" disabled={saving}>
              {saving ? 'Saving…' : department ? 'Save changes' : 'Add department'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}

function DepartmentDetailsDialog({
  department,
  onClose,
}: {
  department: DepartmentDetails
  onClose: () => void
}) {
  return (
    <div className="employee-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="employee-dialog department-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="department-details-title">
        <header className="employee-dialog-header">
          <div>
            <p className="eyebrow">DEPARTMENT PROFILE</p>
            <h2 id="department-details-title">{department.name}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close department profile">
            <X size={19} aria-hidden="true" />
          </button>
        </header>
        <div className="department-detail-summary">
          <span className={`employee-status${department.isActive ? ' employee-status-active' : ''}`}>
            {department.isActive ? 'Active' : 'Inactive'}
          </span>
          <span><UsersRound size={14} aria-hidden="true" /> {department._count.employees} {department._count.employees === 1 ? 'employee' : 'employees'}</span>
        </div>
        <div className="department-description">
          <h3>About</h3>
          <p>{department.description || 'No department description has been added.'}</p>
        </div>
        <div className="department-people">
          <h3>Department employees <span>{department.employees.length}</span></h3>
          {department.employees.length ? (
            <ul>
              {department.employees.map((employee) => (
                <li key={employee.id}>
                  <span className="employee-avatar" aria-hidden="true">
                    {employee.firstName.charAt(0)}{employee.lastName.charAt(0)}
                  </span>
                  <span className="employee-primary">
                    <strong>{employee.firstName} {employee.lastName}</strong>
                    <span>{employee.employeeNumber} · {employee.email}</span>
                  </span>
                  <span className="employee-status">{employee.employmentStatus.replaceAll('_', ' ')}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="department-no-people">No employees are assigned to this department yet.</p>
          )}
        </div>
      </section>
    </div>
  )
}

export function DepartmentsPage() {
  const { hasPermission } = useAuth()
  const [departments, setDepartments] = useState<Department[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<DepartmentFilter>('ALL')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [editingDepartment, setEditingDepartment] = useState<Department | null | undefined>(undefined)
  const [detailsDepartment, setDetailsDepartment] = useState<DepartmentDetails | null>(null)
  const [notice, setNotice] = useState('')
  const [deletingDepartmentId, setDeletingDepartmentId] = useState<string | null>(null)
  const canRead = hasPermission('department:read')
  const canCreate = hasPermission('department:create')
  const canUpdate = hasPermission('department:update')
  const canDelete = hasPermission('department:delete')

  useEffect(() => {
    if (!canRead) return
    let cancelled = false
    void requestDepartments().then((result) => {
      if (cancelled) return
      setDepartments(result)
      setError('')
      setIsLoading(false)
    }).catch((cause: unknown) => {
      if (cancelled) return
      setDepartments([])
      setError(cause instanceof ApiError ? cause.message : 'Unable to load departments.')
      setIsLoading(false)
    })
    return () => { cancelled = true }
  }, [canRead, reloadKey])

  const filteredDepartments = useMemo(() => {
    const query = search.trim().toLowerCase()
    return departments.filter((department) => {
      const matchesFilter = filter === 'ALL'
        || (filter === 'ACTIVE' ? department.isActive : !department.isActive)
      return matchesFilter && (!query || `${department.name} ${department.description ?? ''}`.toLowerCase().includes(query))
    })
  }, [departments, filter, search])

  async function saveDepartment(form: DepartmentForm) {
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      isActive: form.isActive,
      headEmployeeId: form.headEmployeeId || null,
    }
    if (editingDepartment) {
      const updated = await api.patch<Department>(`/departments/${editingDepartment.id}`, payload)
      setDepartments((current) => current.map((item) => item.id === updated.id ? updated : item))
      setNotice(`${updated.name} was updated.`)
    } else {
      const created = await api.post<Department>('/departments', payload)
      setDepartments((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)))
      setNotice(`${created.name} was added.`)
    }
    setEditingDepartment(undefined)
  }

  async function deleteDepartment(department: Department) {
    if (department._count.employees > 0 || deletingDepartmentId) return
    if (!window.confirm(`Delete the "${department.name}" department? This cannot be undone.`)) return
    setDeletingDepartmentId(department.id)
    setNotice('')
    try {
      await api.delete<{ id: string; deleted: boolean }>(`/departments/${department.id}`)
      setDepartments((current) => current.filter((item) => item.id !== department.id))
      setDetailsDepartment((current) => current?.id === department.id ? null : current)
      setNotice(`${department.name} was deleted.`)
    } catch (cause) {
      setNotice(cause instanceof ApiError ? cause.message : `Unable to delete ${department.name}.`)
    } finally {
      setDeletingDepartmentId(null)
    }
  }

  async function showDetails(department: Department) {
    try {
      const detail = await api.get<DepartmentDetails>(`/departments/${department.id}`)
      setDetailsDepartment(detail)
    } catch (cause) {
      setNotice(cause instanceof ApiError ? cause.message : 'Could not load department details.')
    }
  }

  if (!canRead) {
    return (
      <section className="module-placeholder access-denied" role="alert">
        <div className="placeholder-icon"><AlertCircle size={21} aria-hidden="true" /></div>
        <div><h2>Access restricted</h2><p>Your account does not have permission to view departments.</p></div>
      </section>
    )
  }

  const activeCount = departments.filter((department) => department.isActive).length
  const employeeCount = departments.reduce((total, department) => total + department._count.employees, 0)

  return (
    <section className="departments-page" aria-label="Department directory">
      <div className="department-summary-row">
        <div className="department-summary">
          <span className="employee-summary-icon"><Building2 size={17} aria-hidden="true" /></span>
          <span><strong>{departments.length}</strong> departments <i>·</i> <strong>{activeCount}</strong> active <i>·</i> <strong>{employeeCount}</strong> employees assigned</span>
        </div>
        {canCreate && (
          <button className="button-primary" type="button" onClick={() => { setNotice(''); setEditingDepartment(null) }}>
            <CirclePlus size={16} aria-hidden="true" /> Add department
          </button>
        )}
      </div>

      {notice && (
        <div className="employee-notice" role="status">
          <Check size={15} aria-hidden="true" /><span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} aria-label="Dismiss message"><X size={15} /></button>
        </div>
      )}

      <div className="employee-toolbar">
        <label className="employee-search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Search departments</span>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search departments…" />
        </label>
        <label className="employee-status-filter">
          <span>Status</span>
          <select value={filter} onChange={(event) => setFilter(event.target.value as DepartmentFilter)}>
            <option value="ALL">All departments</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </label>
        <button
          className="icon-button employee-refresh"
          type="button"
          onClick={() => { setIsLoading(true); setReloadKey((key) => key + 1) }}
          disabled={isLoading}
          aria-label="Refresh departments"
        >
          {isLoading ? <LoaderCircle className="loading-icon" size={17} /> : <RotateCw size={16} />}
        </button>
      </div>

      {error ? (
        <div className="employees-state employees-error" role="alert">
          <AlertCircle size={20} aria-hidden="true" />
          <div>
            <h2>Department directory unavailable</h2>
            <p>{error}</p>
            <button className="text-button" type="button" onClick={() => { setIsLoading(true); setReloadKey((key) => key + 1) }}>
              <RotateCw size={14} aria-hidden="true" /> Try again
            </button>
          </div>
        </div>
      ) : isLoading ? (
        <div className="employees-state" role="status"><LoaderCircle className="loading-icon" size={19} />Loading departments…</div>
      ) : filteredDepartments.length === 0 ? (
        <div className="employees-state empty-directory">
          <Building2 size={22} aria-hidden="true" />
          <h2>{departments.length ? 'No matching departments' : 'No departments yet'}</h2>
          <p>{departments.length ? 'Try a different search or status filter.' : 'Departments added to the HRM will appear here.'}</p>
          {!departments.length && canCreate && (
            <button className="button-primary" type="button" onClick={() => setEditingDepartment(null)}>
              <CirclePlus size={16} aria-hidden="true" /> Add department
            </button>
          )}
          {departments.length > 0 && (
            <button className="text-button" type="button" onClick={() => { setSearch(''); setFilter('ALL') }}>Clear filters</button>
          )}
        </div>
      ) : (
        <div className="department-table-wrap">
          <table className="department-table">
            <thead><tr><th scope="col">Department</th><th scope="col">Description</th><th scope="col">Employees</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {filteredDepartments.map((department) => (
                <tr key={department.id}>
                  <td>
                    <button className="department-name-button" type="button" onClick={() => void showDetails(department)}>
                      <span className="department-row-icon"><Building2 size={16} aria-hidden="true" /></span>
                      <strong>{department.name}</strong>
                    </button>
                  </td>
                  <td className="department-description-cell">{department.description || <span className="muted-value">No description</span>}</td>
                  <td><span className="department-count"><UsersRound size={14} aria-hidden="true" />{department._count.employees}</span></td>
                  <td><span className={`employee-status${department.isActive ? ' employee-status-active' : ''}`}>{department.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td className="employee-action-cell">
                    {canUpdate && (
                      <button className="icon-button" type="button" onClick={() => { setNotice(''); setEditingDepartment(department) }} aria-label={`Edit ${department.name}`}>
                        <Pencil size={15} aria-hidden="true" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        className="icon-button danger-icon-button"
                        type="button"
                        onClick={() => void deleteDepartment(department)}
                        disabled={Boolean(deletingDepartmentId) || department._count.employees > 0}
                        aria-label={`Delete ${department.name}`}
                        title={department._count.employees > 0
                          ? 'Reassign employees before deleting this department'
                          : `Delete ${department.name}`}
                      >
                        {deletingDepartmentId === department.id
                          ? <LoaderCircle className="loading-icon" size={15} aria-hidden="true" />
                          : <Trash2 size={15} aria-hidden="true" />}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="employee-table-footer"><span>Showing {filteredDepartments.length} of {departments.length} departments</span><span><Building2 size={13} aria-hidden="true" /> Organisation</span></div>
        </div>
      )}

      {editingDepartment !== undefined && (
        <DepartmentDialog department={editingDepartment} onClose={() => setEditingDepartment(undefined)} onSave={saveDepartment} />
      )}
      {detailsDepartment && <DepartmentDetailsDialog department={detailsDepartment} onClose={() => setDetailsDepartment(null)} />}
    </section>
  )
}
