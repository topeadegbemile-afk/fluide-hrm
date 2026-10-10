import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  BriefcaseBusiness,
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

type Position = {
  id: string
  title: string
  description: string | null
  isActive: boolean
  _count: { employees: number }
}

type PositionEmployee = {
  id: string
  employeeNumber: string
  firstName: string
  lastName: string
  email: string
  employmentStatus: string
}

type PositionDetails = Position & { employees: PositionEmployee[] }
type PositionForm = { title: string; description: string; isActive: boolean }
type PositionFilter = 'ALL' | 'ACTIVE' | 'INACTIVE'

const emptyPosition: PositionForm = { title: '', description: '', isActive: true }

async function requestPositions() {
  return api.get<Position[]>('/positions')
}

function PositionDialog({
  position,
  onClose,
  onSave,
}: {
  position: Position | null
  onClose: () => void
  onSave: (form: PositionForm) => Promise<void>
}) {
  const [form, setForm] = useState<PositionForm>(position
    ? { title: position.title, description: position.description ?? '', isActive: position.isActive }
    : emptyPosition)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onSave(form)
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to save this position.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="employee-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="employee-dialog department-dialog" role="dialog" aria-modal="true" aria-labelledby="position-form-title">
        <header className="employee-dialog-header">
          <div>
            <p className="eyebrow">ROLE DIRECTORY</p>
            <h2 id="position-form-title">{position ? 'Edit position' : 'Add position'}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close form">
            <X size={19} aria-hidden="true" />
          </button>
        </header>
        <form className="employee-form" onSubmit={(event) => void submit(event)}>
          <div className="employee-form-grid">
            <label className="employee-form-full">
              Position title
              <input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
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
              Active position
            </label>
          </div>
          {error && <p className="employee-form-error" role="alert"><AlertCircle size={15} />{error}</p>}
          <footer className="employee-dialog-actions">
            <button className="button-secondary" type="button" onClick={onClose}>Cancel</button>
            <button className="button-primary" type="submit" disabled={saving}>
              {saving ? 'Saving…' : position ? 'Save changes' : 'Add position'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}

function PositionDetailsDialog({
  position,
  onClose,
}: {
  position: PositionDetails
  onClose: () => void
}) {
  return (
    <div className="employee-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="employee-dialog department-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="position-details-title">
        <header className="employee-dialog-header">
          <div>
            <p className="eyebrow">POSITION PROFILE</p>
            <h2 id="position-details-title">{position.title}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close position profile">
            <X size={19} aria-hidden="true" />
          </button>
        </header>
        <div className="department-detail-summary">
          <span className={`employee-status${position.isActive ? ' employee-status-active' : ''}`}>
            {position.isActive ? 'Active' : 'Inactive'}
          </span>
          <span><UsersRound size={14} aria-hidden="true" /> {position._count.employees} {position._count.employees === 1 ? 'employee' : 'employees'}</span>
        </div>
        <div className="department-description">
          <h3>About</h3>
          <p>{position.description || 'No position description has been added.'}</p>
        </div>
        <div className="department-people">
          <h3>Employees in this position <span>{position.employees.length}</span></h3>
          {position.employees.length ? (
            <ul>
              {position.employees.map((employee) => (
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
            <p className="department-no-people">No employees are assigned to this position yet.</p>
          )}
        </div>
      </section>
    </div>
  )
}

export function PositionsPage() {
  const { hasPermission } = useAuth()
  const [positions, setPositions] = useState<Position[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<PositionFilter>('ALL')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [editingPosition, setEditingPosition] = useState<Position | null | undefined>(undefined)
  const [detailsPosition, setDetailsPosition] = useState<PositionDetails | null>(null)
  const [notice, setNotice] = useState('')
  const [deletingPositionId, setDeletingPositionId] = useState<string | null>(null)
  const canRead = hasPermission('position:read')
  const canCreate = hasPermission('position:create')
  const canUpdate = hasPermission('position:update')
  const canDelete = hasPermission('position:delete')

  useEffect(() => {
    if (!canRead) return
    let cancelled = false
    void requestPositions().then((result) => {
      if (cancelled) return
      setPositions(result)
      setError('')
      setIsLoading(false)
    }).catch((cause: unknown) => {
      if (cancelled) return
      setPositions([])
      setError(cause instanceof ApiError ? cause.message : 'Unable to load positions.')
      setIsLoading(false)
    })
    return () => { cancelled = true }
  }, [canRead, reloadKey])

  const filteredPositions = useMemo(() => {
    const query = search.trim().toLowerCase()
    return positions.filter((position) => {
      const matchesFilter = filter === 'ALL'
        || (filter === 'ACTIVE' ? position.isActive : !position.isActive)
      return matchesFilter && (!query || `${position.title} ${position.description ?? ''}`.toLowerCase().includes(query))
    })
  }, [filter, positions, search])

  async function savePosition(form: PositionForm) {
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      isActive: form.isActive,
    }
    if (editingPosition) {
      const updated = await api.patch<Position>(`/positions/${editingPosition.id}`, payload)
      setPositions((current) => current.map((item) => item.id === updated.id ? updated : item))
      setNotice(`${updated.title} was updated.`)
    } else {
      const created = await api.post<Position>('/positions', payload)
      setPositions((current) => [...current, created].sort((a, b) => a.title.localeCompare(b.title)))
      setNotice(`${created.title} was added.`)
    }
    setEditingPosition(undefined)
  }

  async function deletePosition(position: Position) {
    if (position._count.employees > 0 || deletingPositionId) return
    if (!window.confirm(`Delete the "${position.title}" position? This cannot be undone.`)) return
    setDeletingPositionId(position.id)
    setNotice('')
    try {
      await api.delete<{ id: string; deleted: boolean }>(`/positions/${position.id}`)
      setPositions((current) => current.filter((item) => item.id !== position.id))
      setDetailsPosition((current) => current?.id === position.id ? null : current)
      setNotice(`${position.title} was deleted.`)
    } catch (cause) {
      setNotice(cause instanceof ApiError ? cause.message : `Unable to delete ${position.title}.`)
    } finally {
      setDeletingPositionId(null)
    }
  }

  async function showDetails(position: Position) {
    try {
      setDetailsPosition(await api.get<PositionDetails>(`/positions/${position.id}`))
    } catch (cause) {
      setNotice(cause instanceof ApiError ? cause.message : 'Could not load position details.')
    }
  }

  if (!canRead) {
    return (
      <section className="module-placeholder access-denied" role="alert">
        <div className="placeholder-icon"><AlertCircle size={21} aria-hidden="true" /></div>
        <div><h2>Access restricted</h2><p>Your account does not have permission to view positions.</p></div>
      </section>
    )
  }

  const activeCount = positions.filter((position) => position.isActive).length
  const employeeCount = positions.reduce((total, position) => total + position._count.employees, 0)

  return (
    <section className="departments-page" aria-label="Position directory">
      <div className="department-summary-row">
        <div className="department-summary">
          <span className="employee-summary-icon"><BriefcaseBusiness size={17} aria-hidden="true" /></span>
          <span><strong>{positions.length}</strong> positions <i>·</i> <strong>{activeCount}</strong> active <i>·</i> <strong>{employeeCount}</strong> employees assigned</span>
        </div>
        {canCreate && (
          <button className="button-primary" type="button" onClick={() => { setNotice(''); setEditingPosition(null) }}>
            <CirclePlus size={16} aria-hidden="true" /> Add position
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
          <span className="sr-only">Search positions</span>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search positions…" />
        </label>
        <label className="employee-status-filter">
          <span>Status</span>
          <select value={filter} onChange={(event) => setFilter(event.target.value as PositionFilter)}>
            <option value="ALL">All positions</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </label>
        <button
          className="icon-button employee-refresh"
          type="button"
          onClick={() => { setIsLoading(true); setReloadKey((key) => key + 1) }}
          disabled={isLoading}
          aria-label="Refresh positions"
        >
          {isLoading ? <LoaderCircle className="loading-icon" size={17} /> : <RotateCw size={16} />}
        </button>
      </div>

      {error ? (
        <div className="employees-state employees-error" role="alert">
          <AlertCircle size={20} aria-hidden="true" />
          <div>
            <h2>Position directory unavailable</h2>
            <p>{error}</p>
            <button className="text-button" type="button" onClick={() => { setIsLoading(true); setReloadKey((key) => key + 1) }}>
              <RotateCw size={14} aria-hidden="true" /> Try again
            </button>
          </div>
        </div>
      ) : isLoading ? (
        <div className="employees-state" role="status"><LoaderCircle className="loading-icon" size={19} />Loading positions…</div>
      ) : filteredPositions.length === 0 ? (
        <div className="employees-state empty-directory">
          <BriefcaseBusiness size={22} aria-hidden="true" />
          <h2>{positions.length ? 'No matching positions' : 'No positions yet'}</h2>
          <p>{positions.length ? 'Try a different search or status filter.' : 'Positions added to the HRM will appear here.'}</p>
          {!positions.length && canCreate && (
            <button className="button-primary" type="button" onClick={() => setEditingPosition(null)}>
              <CirclePlus size={16} aria-hidden="true" /> Add position
            </button>
          )}
          {positions.length > 0 && (
            <button className="text-button" type="button" onClick={() => { setSearch(''); setFilter('ALL') }}>Clear filters</button>
          )}
        </div>
      ) : (
        <div className="department-table-wrap">
          <table className="department-table position-table">
            <thead><tr><th scope="col">Position</th><th scope="col">Description</th><th scope="col">Employees</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {filteredPositions.map((position) => (
                <tr key={position.id}>
                  <td>
                    <button className="department-name-button" type="button" onClick={() => void showDetails(position)}>
                      <span className="department-row-icon"><BriefcaseBusiness size={16} aria-hidden="true" /></span>
                      <strong>{position.title}</strong>
                    </button>
                  </td>
                  <td className="department-description-cell">{position.description || <span className="muted-value">No description</span>}</td>
                  <td><span className="department-count"><UsersRound size={14} aria-hidden="true" />{position._count.employees}</span></td>
                  <td><span className={`employee-status${position.isActive ? ' employee-status-active' : ''}`}>{position.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td className="employee-action-cell">
                    {canUpdate && (
                      <button className="icon-button" type="button" onClick={() => { setNotice(''); setEditingPosition(position) }} aria-label={`Edit ${position.title}`}>
                        <Pencil size={15} aria-hidden="true" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        className="icon-button danger-icon-button"
                        type="button"
                        onClick={() => void deletePosition(position)}
                        disabled={Boolean(deletingPositionId) || position._count.employees > 0}
                        aria-label={`Delete ${position.title}`}
                        title={position._count.employees > 0
                          ? 'Reassign employees before deleting this position'
                          : `Delete ${position.title}`}
                      >
                        {deletingPositionId === position.id
                          ? <LoaderCircle className="loading-icon" size={15} aria-hidden="true" />
                          : <Trash2 size={15} aria-hidden="true" />}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="employee-table-footer"><span>Showing {filteredPositions.length} of {positions.length} positions</span><span><BriefcaseBusiness size={13} aria-hidden="true" /> Role directory</span></div>
        </div>
      )}

      {editingPosition !== undefined && (
        <PositionDialog position={editingPosition} onClose={() => setEditingPosition(undefined)} onSave={savePosition} />
      )}
      {detailsPosition && <PositionDetailsDialog position={detailsPosition} onClose={() => setDetailsPosition(null)} />}
    </section>
  )
}
