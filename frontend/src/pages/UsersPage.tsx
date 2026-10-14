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
  UserRound,
  UserRoundCheck,
  UserRoundX,
  X,
} from 'lucide-react'

import { useAuth } from '../auth/useAuth'
import { ApiError, api } from '../lib/api'

type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'

type UserRole = {
  id: string
  role: {
    id: string
    name: string
    description: string | null
  }
}

type ManagedUser = {
  id: string
  email: string
  status: UserStatus
  createdAt: string

  employee: {
    id: string
    firstName: string
    lastName: string
    employeeNumber: string
  } | null

  userRoles: UserRole[]
}

type ManagedRole = {
  id: string
  name: string
  description: string | null
}

type AvailableEmployee = {
  id: string
  employeeNumber: string
  firstName: string
  middleName: string | null
  lastName: string
  email: string
  phone: string | null
  employmentStatus: string
  employmentType: string

  department: {
    id: string
    name: string
  } | null

  position: {
    id: string
    title: string
  } | null
}

type UserForm = {
  email: string
  password: string
  status: UserStatus
  employeeId: string
  roleIds: string[]
}

const userStatuses: UserStatus[] = [
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED',
]

function statusLabel(status: UserStatus) {
  return status.charAt(0) + status.slice(1).toLowerCase()
}

/* =========================================================
   USER FORM DIALOG
========================================================= */

function UserFormDialog({
  user,
  isCurrentUser,
  roles,
  availableEmployees,
  canAssignRoles,
  onClose,
  onSave,
}: {
  user: ManagedUser | null
  isCurrentUser: boolean
  roles: ManagedRole[]
  availableEmployees: AvailableEmployee[]
  canAssignRoles: boolean
  onClose: () => void
  onSave: (form: UserForm) => Promise<void>
}) {
  const [form, setForm] = useState<UserForm>({
    email: user?.email ?? '',
    password: '',
    status: user?.status ?? 'ACTIVE',
    employeeId: user?.employee?.id ?? '',
    roleIds: user?.userRoles.map((assignment) => assignment.role.id) ?? [],
  })

  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setSaving(true)
    setError('')

    try {
      await onSave(form)
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Unable to save this user.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="employee-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <section
        className="employee-dialog admin-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-form-title"
      >
        <header className="employee-dialog-header">
          <div>
            <p className="eyebrow">ACCOUNT MANAGEMENT</p>

            <h2 id="user-form-title">
              {user ? 'Edit user' : 'Create user'}
            </h2>
          </div>

          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="Close user form"
          >
            <X size={19} />
          </button>
        </header>

        <form
          className="employee-form"
          onSubmit={(event) => void submit(event)}
        >
          <div className="employee-form-grid">

            {/* =====================================================
                EMPLOYEE SELECTOR
                Only shown when creating a new account.
            ====================================================== */}

            {!user && (
              <label className="employee-form-full">
                Employee / Staff ID

                <span className="field-optional">
                  Optional for accounts without an employee profile
                </span>

                <select
                  value={form.employeeId}
                  onChange={(event) => {
                    const employeeId = event.target.value

                    const employee =
                      availableEmployees.find(
                        (item) => item.id === employeeId,
                      )

                    setForm((current) => ({
                      ...current,
                      employeeId,
                      email:
                        employee?.email ??
                        current.email,
                    }))
                  }}
                >
                  <option value="">
                    No employee linked
                  </option>

                  {availableEmployees.map((employee) => (
                    <option
                      key={employee.id}
                      value={employee.id}
                    >
                      {employee.employeeNumber} —{' '}
                      {employee.firstName}{' '}
                      {employee.lastName}
                    </option>
                  ))}
                </select>

                {availableEmployees.length === 0 && (
                  <small className="admin-muted">
                    There are currently no employees
                    available for account linking.
                  </small>
                )}
              </label>
            )}

            {/* =====================================================
                SELECTED EMPLOYEE INFORMATION
            ====================================================== */}

            {!user && form.employeeId && (
              <div className="employee-form-full">
                {(() => {
                  const employee =
                    availableEmployees.find(
                      (item) =>
                        item.id === form.employeeId,
                    )

                  if (!employee) {
                    return null
                  }

                  return (
                    <div className="admin-muted">
                      <strong>
                        {employee.firstName}{' '}
                        {employee.middleName
                          ? `${employee.middleName} `
                          : ''}
                        {employee.lastName}
                      </strong>

                      <br />

                      {employee.position?.title ??
                        'Position not assigned'}

                      {employee.department?.name && (
                        <>
                          {' '}
                          · {employee.department.name}
                        </>
                      )}
                    </div>
                  )
                })()}
              </div>
            )}

            {/* =====================================================
                EMAIL
            ====================================================== */}

            <label className="employee-form-full">
              Email address

              <input
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                required
              />
            </label>

            {/* =====================================================
                PASSWORD
            ====================================================== */}

            {user ? (
              <label className="employee-form-full">
                New password
                <span className="field-optional">Leave blank to keep unchanged</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                  minLength={8}
                />
              </label>
            ) : (
              <p className="employee-form-full field-optional">The user will receive an email with a secure link to set their password.</p>
            )}

            {/* =====================================================
                ACCOUNT STATUS
            ====================================================== */}

            <label className="employee-form-full">
              Account status

              <select
                value={form.status}
                disabled={isCurrentUser}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    status:
                      event.target.value as UserStatus,
                  }))
                }
              >
                {userStatuses.map((status) => (
                  <option
                    key={status}
                    value={status}
                  >
                    {statusLabel(status)}
                  </option>
                ))}
              </select>
            </label>

            {/* =====================================================
                ROLES
            ====================================================== */}

            {canAssignRoles && (
              <fieldset className="user-role-choices employee-form-full">
                <legend>
                  Assign roles{' '}
                  <span className="field-optional">
                    Optional
                  </span>
                </legend>

                {roles.length ? (
                  roles.map((role) => (
                    <label key={role.id}>
                      <input
                        type="checkbox"
                        checked={form.roleIds.includes(
                          role.id,
                        )}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            roleIds:
                              event.target.checked
                                ? [
                                    ...current.roleIds,
                                    role.id,
                                  ]
                                : current.roleIds.filter(
                                    (id) =>
                                      id !== role.id,
                                  ),
                          }))
                        }
                      />

                      <span>
                        <strong>
                          {role.name}
                        </strong>

                        {role.description && (
                          <small>
                            {role.description}
                          </small>
                        )}
                      </span>
                    </label>
                  ))
                ) : (
                  <p className="admin-muted">
                    No roles are available to assign.
                  </p>
                )}
              </fieldset>
            )}
          </div>

          {/* =====================================================
              ERROR
          ====================================================== */}

          {error && (
            <p
              className="employee-form-error"
              role="alert"
            >
              <AlertCircle size={15} />
              {error}
            </p>
          )}

          {/* =====================================================
              ACTIONS
          ====================================================== */}

          <footer className="employee-dialog-actions">
            <button
              className="button-secondary"
              type="button"
              onClick={onClose}
            >
              Cancel
            </button>

            <button
              className="button-primary"
              type="submit"
              disabled={saving}
            >
              {saving
                ? 'Saving…'
                : user
                  ? 'Save changes'
                  : 'Create user'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}

/* =========================================================
   ASSIGN ROLE DIALOG
========================================================= */

function AssignRoleDialog({
  user,
  roles,
  onClose,
  onAssign,
}: {
  user: ManagedUser
  roles: ManagedRole[]
  onClose: () => void
  onAssign: (roleId: string) => Promise<void>
}) {
  const [roleId, setRoleId] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const availableRoles = roles.filter(
    (role) =>
      !user.userRoles.some(
        (assignment) =>
          assignment.role.id === role.id,
      ),
  )

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (!roleId) return

    setSaving(true)
    setError('')

    try {
      await onAssign(roleId)
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Unable to assign this role.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="employee-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <section
        className="employee-dialog admin-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="assign-role-title"
      >
        <header className="employee-dialog-header">
          <div>
            <p className="eyebrow">
              ACCESS MANAGEMENT
            </p>

            <h2 id="assign-role-title">
              Assign role
            </h2>
          </div>

          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="Close role assignment"
          >
            <X size={19} />
          </button>
        </header>

        <form
          className="employee-form"
          onSubmit={(event) => void submit(event)}
        >
          <p className="admin-muted">
            Add a role to {user.email}. Role
            assignments can be added here; this API
            does not provide a role-removal action.
          </p>

          <label className="admin-field">
            Role

            <select
              required
              value={roleId}
              onChange={(event) =>
                setRoleId(event.target.value)
              }
            >
              <option value="">
                Select a role
              </option>

              {availableRoles.map((role) => (
                <option
                  key={role.id}
                  value={role.id}
                >
                  {role.name}
                </option>
              ))}
            </select>
          </label>

          {error && (
            <p
              className="employee-form-error"
              role="alert"
            >
              <AlertCircle size={15} />
              {error}
            </p>
          )}

          <footer className="employee-dialog-actions">
            <button
              className="button-secondary"
              type="button"
              onClick={onClose}
            >
              Cancel
            </button>

            <button
              className="button-primary"
              type="submit"
              disabled={saving || !roleId}
            >
              {saving
                ? 'Assigning…'
                : 'Assign role'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}

/* =========================================================
   USERS PAGE
========================================================= */

export function UsersPage() {
  const {
    hasPermission,
    user: currentUser,
  } = useAuth()

  const [users, setUsers] =
    useState<ManagedUser[]>([])

  const [roles, setRoles] =
    useState<ManagedRole[]>([])

  const [availableEmployees, setAvailableEmployees] =
    useState<AvailableEmployee[]>([])

  const [search, setSearch] = useState('')

  const [statusFilter, setStatusFilter] =
    useState<'ALL' | UserStatus>('ALL')

  const [isLoading, setIsLoading] =
    useState(true)

  const [error, setError] = useState('')

  const [warning, setWarning] = useState('')

  const [notice, setNotice] = useState('')

  const [reloadKey, setReloadKey] =
    useState(0)

  const [editingUser, setEditingUser] =
    useState<
      ManagedUser | null | undefined
    >(undefined)

  const [assigningUser, setAssigningUser] =
    useState<ManagedUser | null>(null)

  const [busyUserId, setBusyUserId] =
    useState<string | null>(null)

  const canRead =
    hasPermission('user:read')

  const canCreate =
    hasPermission('user:create')

  const canUpdate =
    hasPermission('user:update')

  const canDelete =
    hasPermission('user:delete')

  const canReadRoles =
    hasPermission('role:read')

  /* =========================================================
     FILTER USERS
  ========================================================= */

  const filteredUsers = useMemo(() => {
    const query =
      search.trim().toLowerCase()

    return users.filter((item) => {
      const matchesStatus =
        statusFilter === 'ALL' ||
        item.status === statusFilter

      const searchable = [
        item.email,
        item.employee?.firstName,
        item.employee?.lastName,
        item.employee?.employeeNumber,
        ...item.userRoles.map(
          (entry) => entry.role.name,
        ),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return (
        matchesStatus &&
        (!query ||
          searchable.includes(query))
      )
    })
  }, [search, statusFilter, users])

  /* =========================================================
     LOAD USERS / ROLES / EMPLOYEES
  ========================================================= */

  useEffect(() => {
    if (!canRead) return

    let cancelled = false

    const requests = [
      /* -----------------------------------------
         USERS
      ----------------------------------------- */

      api
        .get<ManagedUser[]>('/users')
        .then((result) => {
          if (!cancelled) {
            setUsers(result)
            setError('')
          }
        })
        .catch((cause: unknown) => {
          if (!cancelled) {
            setUsers([])

            setError(
              cause instanceof ApiError
                ? cause.message
                : 'Unable to load users.',
            )
          }
        }),

      /* -----------------------------------------
         AVAILABLE EMPLOYEES
      ----------------------------------------- */

      canCreate
        ? api
            .get<AvailableEmployee[]>(
              '/users/available-employees',
            )
            .then((result) => {
              if (!cancelled) {
                setAvailableEmployees(
                  result,
                )
              }
            })
            .catch((cause: unknown) => {
              if (!cancelled) {
                setAvailableEmployees([])

                setWarning(
                  cause instanceof ApiError
                    ? `Employee choices unavailable: ${cause.message}`
                    : 'Employee choices are unavailable.',
                )
              }
            })
        : Promise.resolve(),

      /* -----------------------------------------
         ROLES
      ----------------------------------------- */

      canReadRoles
        ? api
            .get<ManagedRole[]>('/roles')
            .then((result) => {
              if (!cancelled) {
                setRoles(result)
                setWarning('')
              }
            })
            .catch((cause: unknown) => {
              if (!cancelled) {
                setWarning(
                  cause instanceof ApiError
                    ? `Role choices unavailable: ${cause.message}`
                    : 'Role choices are unavailable.',
                )
              }
            })
        : Promise.resolve(),
    ]

    void Promise.all(requests).finally(() => {
      if (!cancelled) {
        setIsLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [
    canRead,
    canCreate,
    canReadRoles,
    reloadKey,
  ])

  /* =========================================================
     RELOAD
  ========================================================= */

  function reload() {
    setIsLoading(true)
    setError('')
    setWarning('')
    setReloadKey((key) => key + 1)
  }

  /* =========================================================
     CREATE / UPDATE USER
  ========================================================= */

  async function saveUser(form: UserForm) {
    if (editingUser) {
      /* -----------------------------------------
         UPDATE EXISTING USER
      ----------------------------------------- */

      const payload = {
        email: form.email.trim(),
        status: form.status,
        ...(canReadRoles && {
          roleIds: form.roleIds,
        }),
        ...(form.password && {
          password: form.password,
        }),
      }

      await api.put<ManagedUser>(
        `/users/${editingUser.id}`,
        payload,
      )

      setNotice(
        `${form.email.trim()} was updated.`,
      )
    } else {
      /* -----------------------------------------
         CREATE NEW USER
      ----------------------------------------- */

      await api.post<ManagedUser>(
        '/users',
        {
          email: form.email.trim(),
          status: form.status,

          employeeId:
            form.employeeId || undefined,

          roleIds: canReadRoles
            ? form.roleIds
            : [],
        },
      )

      setNotice(
        `Invitation email sent to ${form.email.trim()}.`,
      )
    }

    setEditingUser(undefined)

    reload()
  }

  /* =========================================================
     ASSIGN ROLE
  ========================================================= */

  async function assignRole(
    roleId: string,
  ) {
    if (!assigningUser) return

    await api.patch(
      `/users/${assigningUser.id}/assign-role`,
      {
        roleId,
      },
    )

    setNotice(
      `Role assigned to ${assigningUser.email}.`,
    )

    setAssigningUser(null)

    reload()
  }

  /* =========================================================
     DEACTIVATE / REACTIVATE
  ========================================================= */

  async function changeStatus(
    account: ManagedUser,
  ) {
    const action =
      account.status === 'ACTIVE'
        ? 'deactivate'
        : 'reactivate'

    setBusyUserId(account.id)
    setNotice('')

    try {
      const updated =
        await api.patch<ManagedUser>(
          `/users/${account.id}/${action}`,
          {},
        )

      setUsers((items) =>
        items.map((item) =>
          item.id === updated.id
            ? updated
            : item,
        ),
      )

      setNotice(
        `${account.email} was ${
          action === 'deactivate'
            ? 'deactivated'
            : 'reactivated'
        }.`,
      )
    } catch (cause) {
      setNotice(
        cause instanceof ApiError
          ? cause.message
          : `Unable to ${action} this user.`,
      )
    } finally {
      setBusyUserId(null)
    }
  }

  /* =========================================================
     DELETE USER
  ========================================================= */

  async function deleteAccount(
    account: ManagedUser,
  ) {
    if (busyUserId) return

    if (
      !window.confirm(
        `Permanently delete the user account for ${account.email}? This cannot be undone.`,
      )
    ) {
      return
    }

    setBusyUserId(account.id)
    setNotice('')

    try {
      await api.delete(
        `/users/${account.id}`,
      )

      setUsers((items) =>
        items.filter(
          (item) =>
            item.id !== account.id,
        ),
      )

      setNotice(
        `${account.email} was deleted.`,
      )
    } catch (cause) {
      setNotice(
        cause instanceof ApiError
          ? cause.message
          : `Unable to delete ${account.email}.`,
      )
    } finally {
      setBusyUserId(null)
    }
  }

  /* =========================================================
     ACCESS CONTROL
  ========================================================= */

  if (!canRead) {
    return (
      <section
        className="module-placeholder access-denied"
        role="alert"
      >
        <div className="placeholder-icon">
          <AlertCircle size={21} />
        </div>

        <div>
          <h2>Access restricted</h2>

          <p>
            Your account does not have
            permission to view users.
          </p>
        </div>
      </section>
    )
  }

  /* =========================================================
     PAGE
  ========================================================= */

  return (
    <section
      className="admin-page"
      aria-label="User management"
    >
      {/* =====================================================
          HEADER
      ====================================================== */}

      <div className="admin-intro">
        <span className="employee-summary-icon">
          <UserRound size={18} />
        </span>

        <div>
          <p className="eyebrow">
            ACCESS MANAGEMENT
          </p>

          <h2>User accounts</h2>

          <p>
            Create accounts, link employees,
            maintain their status, and assign
            roles.
          </p>
        </div>
      </div>

      {/* =====================================================
          SUMMARY
      ====================================================== */}

      <div className="admin-summary-row">
        <span>
          <strong>{users.length}</strong>{' '}
          accounts
          <i> · </i>
          <strong>
            {
              users.filter(
                (item) =>
                  item.status === 'ACTIVE',
              ).length
            }
          </strong>{' '}
          active
        </span>

        <div className="admin-summary-actions">
          <button
            className="icon-button employee-refresh"
            type="button"
            onClick={reload}
            disabled={isLoading}
            aria-label="Refresh users"
          >
            {isLoading ? (
              <LoaderCircle
                className="loading-icon"
                size={17}
              />
            ) : (
              <RotateCw size={16} />
            )}
          </button>

          {canCreate && (
            <button
              className="button-primary"
              type="button"
              onClick={() => {
                setNotice('')
                setEditingUser(null)
              }}
            >
              <CirclePlus size={16} />
              Create user
            </button>
          )}
        </div>
      </div>

      {/* =====================================================
          NOTICE
      ====================================================== */}

      {notice && (
        <div
          className="employee-notice"
          role="status"
        >
          <Check size={15} />

          <span>{notice}</span>

          <button
            type="button"
            onClick={() =>
              setNotice('')
            }
            aria-label="Dismiss message"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* =====================================================
          WARNING
      ====================================================== */}

      {warning && (
        <p
          className="employee-inline-warning"
          role="status"
        >
          <AlertCircle size={15} />
          {warning}
        </p>
      )}

      {/* =====================================================
          FILTERS
      ====================================================== */}

      <div className="admin-toolbar">
        <label className="employee-search">
          <Search size={16} />

          <span className="sr-only">
            Search users
          </span>

          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search email, employee, or role…"
          />
        </label>

        <label className="employee-status-filter">
          <span>Status</span>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as
                  | 'ALL'
                  | UserStatus,
              )
            }
          >
            <option value="ALL">
              All statuses
            </option>

            {userStatuses.map(
              (status) => (
                <option
                  key={status}
                  value={status}
                >
                  {statusLabel(status)}
                </option>
              ),
            )}
          </select>
        </label>
      </div>

      {/* =====================================================
          CONTENT STATES
      ====================================================== */}

      {error ? (
        <div
          className="employees-state employees-error"
          role="alert"
        >
          <AlertCircle size={20} />

          <div>
            <h2>Users unavailable</h2>

            <p>{error}</p>

            <button
              className="text-button"
              type="button"
              onClick={reload}
            >
              <RotateCw size={14} />
              Try again
            </button>
          </div>
        </div>
      ) : isLoading ? (
        <div
          className="employees-state"
          role="status"
        >
          <LoaderCircle
            className="loading-icon"
            size={19}
          />

          Loading user accounts…
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="employees-state empty-directory">
          <UserRound size={22} />

          <h2>
            {users.length
              ? 'No matching users'
              : 'No user accounts yet'}
          </h2>

          <p>
            {users.length
              ? 'Try another search or status filter.'
              : 'Accounts created for the HRM appear here.'}
          </p>
        </div>
      ) : (
        /* =====================================================
           USERS TABLE
        ====================================================== */

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Employee</th>
                <th>Roles</th>
                <th>Status</th>
                <th>Created</th>
                <th>
                  <span className="sr-only">
                    Actions
                  </span>
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredUsers.map(
                (account) => (
                  <tr key={account.id}>
                    {/* USER */}

                    <td>
                      <strong>
                        {account.email}
                      </strong>

                      {account.id ===
                        currentUser?.id && (
                        <span className="admin-user-self">
                          You
                        </span>
                      )}
                    </td>

                    {/* EMPLOYEE */}

                    <td>
                      {account.employee ? (
                        <>
                          <strong>
                            {
                              account.employee
                                .firstName
                            }{' '}
                            {
                              account.employee
                                .lastName
                            }
                          </strong>

                          <span>
                            {
                              account.employee
                                .employeeNumber
                            }
                          </span>
                        </>
                      ) : (
                        <span className="admin-muted">
                          Not linked
                        </span>
                      )}
                    </td>

                    {/* ROLES */}

                    <td>
                      <div className="admin-role-pills">
                        {account.userRoles
                          .length ? (
                          account.userRoles.map(
                            (
                              assignment,
                            ) => (
                              <span
                                key={
                                  assignment.id
                                }
                              >
                                {
                                  assignment
                                    .role
                                    .name
                                }
                              </span>
                            ),
                          )
                        ) : (
                          <span className="admin-muted">
                            No roles
                          </span>
                        )}
                      </div>
                    </td>

                    {/* STATUS */}

                    <td>
                      <span
                        className={`employee-status admin-status-${account.status.toLowerCase()}`}
                      >
                        {statusLabel(
                          account.status,
                        )}
                      </span>
                    </td>

                    {/* CREATED */}

                    <td>
                      {new Intl.DateTimeFormat(
                        undefined,
                        {
                          dateStyle: 'medium',
                          timeZone: 'UTC',
                        },
                      ).format(
                        new Date(
                          account.createdAt,
                        ),
                      )}
                    </td>

                    {/* ACTIONS */}

                    <td className="admin-action-cell">
                      {canUpdate &&
                        canReadRoles && (
                          <button
                            className="icon-button"
                            type="button"
                            onClick={() =>
                              setAssigningUser(
                                account,
                              )
                            }
                            aria-label={`Assign role to ${account.email}`}
                            title="Assign role"
                          >
                            <Shield
                              size={15}
                            />
                          </button>
                        )}

                      {canUpdate && (
                        <button
                          className="icon-button"
                          type="button"
                          onClick={() => {
                            setNotice('')
                            setEditingUser(
                              account,
                            )
                          }}
                          aria-label={`Edit ${account.email}`}
                          title="Edit user"
                        >
                          <Pencil
                            size={15}
                          />
                        </button>
                      )}

                      {canUpdate &&
                        account.id !==
                          currentUser?.id && (
                          <button
                            className="icon-button"
                            type="button"
                            onClick={() =>
                              void changeStatus(
                                account,
                              )
                            }
                            disabled={Boolean(
                              busyUserId,
                            )}
                            aria-label={`${
                              account.status ===
                              'ACTIVE'
                                ? 'Deactivate'
                                : 'Reactivate'
                            } ${account.email}`}
                            title={
                              account.status ===
                              'ACTIVE'
                                ? 'Deactivate account'
                                : 'Reactivate account'
                            }
                          >
                            {busyUserId ===
                            account.id ? (
                              <LoaderCircle
                                className="loading-icon"
                                size={15}
                              />
                            ) : account.status ===
                              'ACTIVE' ? (
                              <UserRoundX
                                size={15}
                              />
                            ) : (
                              <UserRoundCheck
                                size={15}
                              />
                            )}
                          </button>
                        )}

                      {canDelete &&
                        account.id !==
                          currentUser?.id && (
                          <button
                            className="icon-button danger-icon-button"
                            type="button"
                            onClick={() =>
                              void deleteAccount(
                                account,
                              )
                            }
                            disabled={Boolean(
                              busyUserId,
                            )}
                            aria-label={`Delete ${account.email}`}
                            title="Delete account"
                          >
                            {busyUserId ===
                            account.id ? (
                              <LoaderCircle
                                className="loading-icon"
                                size={15}
                              />
                            ) : (
                              <Trash2
                                size={15}
                              />
                            )}
                          </button>
                        )}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>

          <div className="employee-table-footer">
            <span>
              Showing {filteredUsers.length}{' '}
              of {users.length} accounts
            </span>
          </div>
        </div>
      )}

      {/* =====================================================
          CREATE / EDIT USER DIALOG
      ====================================================== */}

      {editingUser !== undefined && (
        <UserFormDialog
          user={editingUser}
          isCurrentUser={
            editingUser?.id ===
            currentUser?.id
          }
          roles={roles}
          availableEmployees={
            availableEmployees
          }
          canAssignRoles={
            canReadRoles
          }
          onClose={() =>
            setEditingUser(
              undefined,
            )
          }
          onSave={saveUser}
        />
      )}

      {/* =====================================================
          ASSIGN ROLE DIALOG
      ====================================================== */}

      {assigningUser && (
        <AssignRoleDialog
          user={assigningUser}
          roles={roles}
          onClose={() =>
            setAssigningUser(null)
          }
          onAssign={assignRole}
        />
      )}
    </section>
  )
}
