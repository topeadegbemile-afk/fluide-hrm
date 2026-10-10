import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  Check,
  CirclePlus,
  LoaderCircle,
  Pencil,
  RotateCw,
  Search,
  Shield,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { ApiError, api } from '../lib/api'

type Permission = { id: string; name: string; description: string | null }
type RolePermission = { id: string; permission: Permission }
type Role = {
  id: string
  name: string
  description: string | null
  rolePermissions: RolePermission[]
  userRoles: { id: string }[]
}
type RoleForm = { name: string; description: string; permissionIds: string[] }

function permissionGroup(name: string) {
  const [resource] = name.split(':')
  return resource ? resource.charAt(0).toUpperCase() + resource.slice(1) : 'Other'
}

function RoleDialog({
  role,
  permissions,
  canManagePermissions,
  onClose,
  onSave,
}: {
  role: Role | null
  permissions: Permission[]
  canManagePermissions: boolean
  onClose: () => void
  onSave: (form: RoleForm) => Promise<void>
}) {
  const [form, setForm] = useState<RoleForm>({
    name: role?.name ?? '',
    description: role?.description ?? '',
    permissionIds: role?.rolePermissions.map((item) => item.permission.id) ?? [],
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const groupedPermissions = useMemo(() => permissions.reduce<Record<string, Permission[]>>((groups, permission) => {
    const group = permissionGroup(permission.name)
    groups[group] = [...(groups[group] ?? []), permission]
    return groups
  }, {}), [permissions])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onSave(form)
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to save this role.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="employee-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="employee-dialog role-dialog" role="dialog" aria-modal="true" aria-labelledby="role-form-title">
        <header className="employee-dialog-header"><div><p className="eyebrow">ACCESS CONTROL</p><h2 id="role-form-title">{role ? 'Edit role' : 'Create role'}</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close role form"><X size={19} /></button></header>
        <form className="employee-form" onSubmit={(event) => void submit(event)}>
          <div className="employee-form-grid">
            <label className="employee-form-full">Role name
              <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required minLength={2} maxLength={100} autoFocus />
            </label>
            <label className="employee-form-full">Description <span className="field-optional">Optional</span>
              <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} maxLength={500} rows={2} />
            </label>
            {canManagePermissions && <fieldset className="permission-selector employee-form-full">
              <legend>Permissions <span>{form.permissionIds.length} selected</span></legend>
              {Object.entries(groupedPermissions).map(([group, items]) => (
                <section className="permission-group" key={group}>
                  <h3>{group}</h3>
                  <div>{items.map((permission) => (
                    <label key={permission.id}>
                      <input type="checkbox" checked={form.permissionIds.includes(permission.id)} onChange={(event) => setForm((current) => ({
                        ...current,
                        permissionIds: event.target.checked
                          ? [...current.permissionIds, permission.id]
                          : current.permissionIds.filter((id) => id !== permission.id),
                      }))} />
                      <span><strong>{permission.name}</strong>{permission.description && <small>{permission.description}</small>}</span>
                    </label>
                  ))}</div>
                </section>
              ))}
              {!permissions.length && <p className="admin-muted">No permissions are available.</p>}
            </fieldset>}
            {!canManagePermissions && <p className="employee-form-hint employee-form-full">Your account can edit role details, but cannot view or change its permissions.</p>}
          </div>
          {error && <p className="employee-form-error" role="alert"><AlertCircle size={15} />{error}</p>}
          <footer className="employee-dialog-actions"><button className="button-secondary" type="button" onClick={onClose}>Cancel</button><button className="button-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : role ? 'Save role' : 'Create role'}</button></footer>
        </form>
      </section>
    </div>
  )
}

export function RolesPage() {
  const { hasPermission } = useAuth()
  const [roles, setRoles] = useState<Role[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [permissionWarning, setPermissionWarning] = useState('')
  const [notice, setNotice] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [editingRole, setEditingRole] = useState<Role | null | undefined>(undefined)
  const [busyRoleId, setBusyRoleId] = useState<string | null>(null)
  const canRead = hasPermission('role:read')
  const canCreate = hasPermission('role:create')
  const canUpdate = hasPermission('role:update')
  const canDelete = hasPermission('role:delete')
  const canReadPermissions = hasPermission('permission:read')
  const visibleRoles = useMemo(() => {
    const query = search.trim().toLowerCase()
    return roles.filter((role) => `${role.name} ${role.description ?? ''} ${role.rolePermissions.map((item) => item.permission.name).join(' ')}`.toLowerCase().includes(query))
  }, [roles, search])

  useEffect(() => {
    if (!canRead) return
    let cancelled = false
    const requests = [
      api.get<Role[]>('/roles').then((result) => { if (!cancelled) { setRoles(result); setError('') } }).catch((cause: unknown) => {
        if (!cancelled) { setRoles([]); setError(cause instanceof ApiError ? cause.message : 'Unable to load roles.') }
      }),
      canReadPermissions
        ? api.get<Permission[]>('/roles/permissions').then((result) => { if (!cancelled) { setPermissions(result); setPermissionWarning('') } }).catch((cause: unknown) => {
            if (!cancelled) setPermissionWarning(cause instanceof ApiError ? `Permission list unavailable: ${cause.message}` : 'Permission list unavailable.')
          })
        : Promise.resolve(),
    ]
    void Promise.all(requests).finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [canRead, canReadPermissions, reloadKey])

  function reload() {
    setIsLoading(true)
    setError('')
    setReloadKey((key) => key + 1)
  }

  async function saveRole(form: RoleForm) {
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      ...(canReadPermissions && { permissionIds: form.permissionIds }),
    }
    if (editingRole) {
      await api.put<Role>(`/roles/${editingRole.id}`, payload)
      setNotice(`${form.name.trim()} was updated.`)
    } else {
      await api.post<Role>('/roles', { ...payload, permissionIds: canReadPermissions ? form.permissionIds : [] })
      setNotice(`${form.name.trim()} was created.`)
    }
    setEditingRole(undefined)
    reload()
  }

  async function deleteRole(role: Role) {
    if (busyRoleId) return
    const assignmentWarning = role.userRoles.length
      ? ` ${role.userRoles.length} user account(s) currently have this role and will lose its access.`
      : ''
    if (!window.confirm(`Delete the "${role.name}" role?${assignmentWarning} This cannot be undone.`)) return
    setBusyRoleId(role.id)
    setNotice('')
    try {
      await api.delete(`/roles/${role.id}`)
      setRoles((items) => items.filter((item) => item.id !== role.id))
      setNotice(`${role.name} was deleted.`)
    } catch (cause) {
      setNotice(cause instanceof ApiError ? cause.message : `Unable to delete ${role.name}.`)
    } finally {
      setBusyRoleId(null)
    }
  }

  if (!canRead) return <section className="module-placeholder access-denied" role="alert"><div className="placeholder-icon"><AlertCircle size={21} /></div><div><h2>Access restricted</h2><p>Your account does not have permission to view roles.</p></div></section>

  return (
    <section className="admin-page" aria-label="Roles and permissions">
      <div className="admin-intro"><span className="employee-summary-icon"><Shield size={18} /></span><div><p className="eyebrow">ACCESS CONTROL</p><h2>Roles &amp; permissions</h2><p>Define permission sets and see how many accounts use each role.</p></div></div>
      <div className="admin-summary-row"><span><strong>{roles.length}</strong> roles <i>·</i> <strong>{permissions.length}</strong> permissions available</span><div className="admin-summary-actions"><button className="icon-button employee-refresh" type="button" onClick={reload} disabled={isLoading} aria-label="Refresh roles">{isLoading ? <LoaderCircle className="loading-icon" size={17} /> : <RotateCw size={16} />}</button>{canCreate && <button className="button-primary" type="button" onClick={() => { setNotice(''); setEditingRole(null) }}><CirclePlus size={16} /> Create role</button>}</div></div>
      {notice && <div className="employee-notice" role="status"><Check size={15} /><span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Dismiss message"><X size={15} /></button></div>}
      {permissionWarning && <p className="employee-inline-warning" role="status"><AlertCircle size={15} />{permissionWarning}</p>}
      <div className="admin-toolbar"><label className="employee-search"><Search size={16} /><span className="sr-only">Search roles</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search roles or permissions…" /></label></div>
      {error ? <div className="employees-state employees-error" role="alert"><AlertCircle size={20} /><div><h2>Roles unavailable</h2><p>{error}</p><button className="text-button" type="button" onClick={reload}><RotateCw size={14} /> Try again</button></div></div>
        : isLoading ? <div className="employees-state" role="status"><LoaderCircle className="loading-icon" size={19} />Loading roles…</div>
        : visibleRoles.length === 0 ? <div className="employees-state empty-directory"><Shield size={22} /><h2>{roles.length ? 'No matching roles' : 'No roles configured'}</h2><p>{roles.length ? 'Try another search.' : 'Create a role to define account permissions.'}</p>{canCreate && !roles.length && <button className="button-primary" type="button" onClick={() => setEditingRole(null)}><CirclePlus size={16} /> Create role</button>}</div>
        : <div className="admin-table-wrap"><table className="admin-table role-table"><thead><tr><th>Role</th><th>Permissions</th><th>Assigned users</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{visibleRoles.map((role) => (
          <tr key={role.id}><td><strong>{role.name}</strong><span>{role.description || 'No description'}</span></td><td><div className="admin-role-pills">{role.rolePermissions.length ? role.rolePermissions.slice(0, 5).map((item) => <span key={item.id}>{item.permission.name}</span>) : <span className="admin-muted">No permissions</span>}{role.rolePermissions.length > 5 && <span>+{role.rolePermissions.length - 5} more</span>}</div><small className="admin-cell-subtext">{role.rolePermissions.length} assigned</small></td><td><span className="department-count"><UsersRound size={14} /> {role.userRoles.length}</span></td><td className="admin-action-cell">{canUpdate && <button className="icon-button" type="button" onClick={() => { setNotice(''); setEditingRole(role) }} aria-label={`Edit ${role.name}`} title="Edit role"><Pencil size={15} /></button>}{canDelete && <button className="icon-button danger-icon-button" type="button" onClick={() => void deleteRole(role)} disabled={Boolean(busyRoleId)} aria-label={`Delete ${role.name}`} title="Delete role">{busyRoleId === role.id ? <LoaderCircle className="loading-icon" size={15} /> : <Trash2 size={15} />}</button>}</td></tr>
        ))}</tbody></table><div className="employee-table-footer"><span>Showing {visibleRoles.length} of {roles.length} roles</span><span><Shield size={13} /> Access control</span></div></div>}
      {editingRole !== undefined && <RoleDialog role={editingRole} permissions={permissions} canManagePermissions={canReadPermissions && canUpdate} onClose={() => setEditingRole(undefined)} onSave={saveRole} />}
    </section>
  )
}
