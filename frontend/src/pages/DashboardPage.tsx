import { useEffect, useMemo, useState } from 'react'
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  ChartNoAxesCombined,
  BookOpen,
  CircleAlert,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  Download,
  Grid2X2,
  LoaderCircle,
  List,
  Search,
  RotateCw,
  ShieldCheck,
  UsersRound,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { ApiError, api } from '../lib/api'
import { useAuth } from '../auth/useAuth'
import type { LucideIcon } from 'lucide-react'

type DashboardStatistics = {
  employees: number
  departments: number
  leaveRequests: number
  pendingLeaveRequests: number
  attendanceRecords: number
  appraisals: number
  celebrations: number
  generatedAt: string
}

type PolicyAttachment = { id: string; fileName: string; mimeType: string; size: number }
type DashboardPolicy = { id: string; title: string; category: string; summary: string | null; attachments: PolicyAttachment[] }
type DashboardPolicyResult = { items: DashboardPolicy[]; pagination: { totalPages: number; total: number } }

function DashboardPolicies() {
  const { hasPermission } = useAuth()
  const canReadPolicies = hasPermission('handbook:read')
  const [policies, setPolicies] = useState<DashboardPolicy[]>([])
  const [loading, setLoading] = useState(canReadPolicies)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    if (!canReadPolicies) return
    let active = true
    setLoading(true)
    void api.get<DashboardPolicyResult>(`/handbook?page=${page}&pageSize=2`).then((result) => {
      if (!active) return
      setPolicies(result.items)
      setTotalPages(Math.max(1, result.pagination.totalPages))
      setError('')
    }).catch((cause: unknown) => {
      if (!active) return
      setError(cause instanceof ApiError ? cause.message : 'Unable to load company policies.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [canReadPolicies, page])

  async function downloadAttachment(attachment: PolicyAttachment) {
    try {
      const blob = await api.download(`/handbook/attachments/${attachment.id}`)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = attachment.fileName
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (cause) {
      window.alert(cause instanceof ApiError ? cause.message : 'Could not download this policy attachment.')
    }
  }

  if (!canReadPolicies) return null

  return <section className="dashboard-section dashboard-policy-section" aria-labelledby="dashboard-policies-title">
    <div className="section-heading">
      <div><p className="eyebrow">EMPLOYEE RESOURCES</p><h3 id="dashboard-policies-title">Company policies</h3></div>
      <BookOpen size={18} aria-hidden="true" />
    </div>
    {loading ? <p className="dashboard-policy-status" role="status"><LoaderCircle className="loading-icon" size={16} /> Loading policies…</p>
      : error ? <p className="dashboard-policy-status" role="alert">{error}</p>
        : policies.length === 0 ? <p className="dashboard-policy-status">No published policies yet.</p>
          : <div className="dashboard-policy-list">{policies.map((policy) => <article className="dashboard-policy-item" key={policy.id}>
            <div className="dashboard-policy-heading"><span>{policy.category}</span><Link to={`/policy?article=${encodeURIComponent(policy.id)}`}>{policy.title}</Link>{policy.summary && <p>{policy.summary}</p>}</div>
            {policy.attachments.length > 0 && <ul aria-label={`Attachments for ${policy.title}`}>{policy.attachments.map((attachment) => <li key={attachment.id}>
              <FileText size={14} aria-hidden="true" /><span>{attachment.fileName}</span><button type="button" onClick={() => void downloadAttachment(attachment)} aria-label={`Download ${attachment.fileName}`} title={`Download ${attachment.fileName}`}><Download size={15} aria-hidden="true" /></button>
            </li>)}</ul>}
          </article>)}</div>}
    {!loading && !error && totalPages > 1 && <nav className="dashboard-policy-pagination" aria-label="Company policy pages"><button type="button" className="button-secondary" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}><ChevronLeft size={14} /> Previous</button><span>Page {page} of {totalPages}</span><button type="button" className="button-secondary" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages}>Next <ChevronRight size={14} /></button></nav>}
    <Link className="dashboard-policy-all" to="/policy">All policies <ArrowUpRight size={14} aria-hidden="true" /></Link>
  </section>
}

const metricDefinitions = [
  {
    key: 'employees',
    label: 'Employees',
    icon: UsersRound,
    href: '/employees',
    permission: 'employee:read',
  },
  {
    key: 'departments',
    label: 'Departments',
    icon: BriefcaseBusiness,
    href: '/departments',
    permission: 'department:read',
  },
  {
    key: 'celebrations',
    label: 'Celebrations',
    icon: CalendarDays,
    href: '/celebrations',
    permission: 'celebration:read',
  },
  {
    key: 'leaveRequests',
    label: 'Leave requests',
    icon: CalendarDays,
    href: '/leaves',
    permission: 'leave:read',
  },
] as const

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value)
}

function greetingForHour(hour: number) {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function MetricCard({
  label,
  value,
  icon: Icon,
  href,
}: {
  label: string
  value: number
  icon: LucideIcon
  href: string
}) {
  return (
    <Link className="metric-card" to={href}>
      <div className="metric-card-top">
        <span>{label}</span>
        <Icon
          size={17}
          strokeWidth={1.7}
          aria-hidden="true"
        />
      </div>

      <div className="metric-card-bottom">
        <strong>{formatNumber(value)}</strong>

        <ArrowUpRight
          size={16}
          strokeWidth={1.7}
          aria-hidden="true"
        />
      </div>
    </Link>
  )
}

const serviceGroups = [
  {
    label: 'Records & profile',
    description: 'Explore your people directory and company structure.',
    services: [
      { label: 'My information', description: 'Manage your personal and family information.', href: '/my-information', icon: UsersRound },
      { label: 'Employee directory', description: 'Find people and view employee records.', href: '/employees', permission: 'employee:read', icon: UsersRound },
      { label: 'Departments', description: 'Browse teams and department details.', href: '/departments', permission: 'department:read', icon: BriefcaseBusiness },
      { label: 'Positions', description: 'View roles and position details.', href: '/positions', permission: 'position:read', icon: BriefcaseBusiness },
      { label: 'Organogram', description: 'Explore reporting lines and team structure.', href: '/organogram', permission: 'employee:read', icon: UsersRound },
      { label: 'Policy', description: 'Read company policies and guidance.', href: '/policy', permission: 'handbook:read', icon: FileText },
    ],
  },
  {
    label: 'Time & leave',
    description: 'Manage attendance and time away from work.',
    services: [
      { label: 'Attendance', description: 'Review your attendance records.', href: '/attendance', permission: 'attendance:read', icon: Clock3 },
      { label: 'Leave requests', description: 'Request and track time off.', href: '/leaves', permission: 'leave:read', icon: CalendarDays },
    ],
  },
  {
    label: 'Appraisals & growth',
    description: 'Keep up with reviews and company moments.',
    services: [
      { label: 'Appraisals', description: 'View appraisals and development reviews.', href: '/appraisals', permission: 'appraisal:read', icon: ChartNoAxesCombined },
      { label: 'Celebrations', description: 'See team celebrations and milestones.', href: '/celebrations', permission: 'celebration:read', icon: CalendarDays },
    ],
  },
  {
    label: 'Administration',
    description: 'Tools for workforce operations and account access.',
    services: [
      { label: 'Reports', description: 'Review workforce and attendance reports.', href: '/reports', permission: 'report:read', icon: ChartNoAxesCombined },
      { label: 'Notifications', description: 'Open your notifications workspace.', href: '/notifications', permission: 'notification:read', icon: FileText },
      { label: 'Users', description: 'Manage application user accounts.', href: '/users', permission: 'user:read', icon: UsersRound },
      { label: 'Roles & permissions', description: 'Manage roles and access permissions.', href: '/roles', permission: 'role:read', icon: ShieldCheck },
      { label: 'Audit logs', description: 'Review recorded system activity.', href: '/audit-logs', permission: 'audit:read', icon: FileText },
      { label: 'Settings', description: 'Manage your account preferences.', href: '/settings', icon: BriefcaseBusiness },
    ],
  },
] as const

function MostUsedServices() {
  const { hasPermission } = useAuth()
  const mostUsed = [
    { label: 'Attendance', href: '/attendance', permission: 'attendance:read', icon: Clock3 },
    { label: 'Leave requests', href: '/leaves', permission: 'leave:read', icon: CalendarDays },
    { label: 'Appraisals', href: '/appraisals', permission: 'appraisal:read', icon: ChartNoAxesCombined },
  ].filter((item) => hasPermission(item.permission))

  return (
    <section className="dashboard-most-used" aria-label="Most used services">
      <span>MOST USED</span>
      {mostUsed.map(({ label, href, icon: Icon }) => (
        <Link key={href} to={href}>
          <Icon size={14} aria-hidden="true" />
          {label}
        </Link>
      ))}
    </section>
  )
}

function ServiceCatalog() {
  const { hasPermission } = useAuth()
  const [query, setQuery] = useState('')
  const [activeGroup, setActiveGroup] = useState('All services')
  const [view, setView] = useState<'cards' | 'list'>('cards')

  const availableGroups = serviceGroups
    .map((group) => ({
      ...group,
      services: group.services.filter((service) =>
        !('permission' in service) || hasPermission(service.permission),
      ),
    }))
    .filter((group) => group.services.length > 0)

  const filteredGroups = availableGroups
    .filter((group) => activeGroup === 'All services' || group.label === activeGroup)
    .map((group) => ({
      ...group,
      services: group.services.filter((service) =>
        `${service.label} ${service.description} ${group.label}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      ),
    }))
    .filter((group) => group.services.length > 0)

  return (
      <section className="service-catalog" aria-label="All available services">
        <header className="service-catalog-header">
          <div>
            <h3>All services available to you</h3>
            <p>Explore your HR workspace by service area.</p>
          </div>
          <div className="service-catalog-tools">
            <label className="service-search">
              <Search size={17} aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search services..."
                aria-label="Search services"
              />
            </label>
            <div className="service-view-toggle" aria-label="Catalog view">
              <button type="button" className={view === 'cards' ? 'is-active' : ''} onClick={() => setView('cards')} aria-pressed={view === 'cards'}>
                <Grid2X2 size={15} /> Cards
              </button>
              <button type="button" className={view === 'list' ? 'is-active' : ''} onClick={() => setView('list')} aria-pressed={view === 'list'}>
                <List size={15} /> List
              </button>
            </div>
          </div>
        </header>

        <nav className="service-category-tabs" aria-label="Service categories">
          {['All services', ...availableGroups.map((group) => group.label)].map((label) => (
            <button
              key={label}
              type="button"
              className={activeGroup === label ? 'is-active' : ''}
              onClick={() => setActiveGroup(label)}
            >
              {label}
            </button>
          ))}
        </nav>

        {filteredGroups.length > 0 ? (
          <div className={`service-group-grid${view === 'list' ? ' is-list' : ''}`}>
            {filteredGroups.map((group) => (
              <section className="service-group-card" key={group.label}>
                <header>
                  <div className="service-group-icon"><BriefcaseBusiness size={19} aria-hidden="true" /></div>
                  <div><h4>{group.label}</h4><p>{group.description}</p></div>
                  <span>{group.services.length}</span>
                </header>
                <div className="service-group-links">
                  {group.services.map(({ label, description, href, icon: Icon }) => (
                    <Link key={href} to={href}>
                      <Icon size={16} aria-hidden="true" />
                      <span><strong>{label}</strong><small>{description}</small></span>
                      <ArrowUpRight size={15} aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <p className="service-empty-state">No services match your search.</p>
        )}
      </section>
  )
}

export function DashboardPage() {
  const { hasPermission, user } = useAuth()

  const [statistics, setStatistics] =
    useState<DashboardStatistics | null>(null)

  const [error, setError] = useState('')

  /*
   * Workforce statistics are management information.
   *
   * The dashboard endpoint is protected by dashboard:read.
   *
   * The personal employee dashboard does NOT depend on
   * this permission.
   */
  const canReadWorkforce =
    hasPermission('dashboard:read')

  const [isLoading, setIsLoading] =
    useState(canReadWorkforce)

  const employeeName = user?.employee
    ? `${user.employee.firstName} ${user.employee.lastName}`
    : user?.email?.split('@')[0] ?? 'there'

  const greeting = useMemo(
    () => greetingForHour(new Date().getHours()),
    [],
  )

  useEffect(() => {
    if (!canReadWorkforce) {
      setIsLoading(false)
      return
    }

    let active = true

    setIsLoading(true)

    api
      .get<DashboardStatistics>('/reports/dashboard')
      .then((result) => {
        if (!active) return

        setStatistics(result)
        setError('')
      })
      .catch((cause: unknown) => {
        if (!active) return

        setError(
          cause instanceof ApiError
            ? cause.message
            : 'Unable to load dashboard statistics.',
        )
      })
      .finally(() => {
        if (!active) return

        setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [canReadWorkforce])

  async function retryStatistics() {
    setIsLoading(true)
    setError('')

    try {
      const result =
        await api.get<DashboardStatistics>(
          '/reports/dashboard',
        )

      setStatistics(result)
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Unable to load dashboard statistics.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="dashboard-content">
      {/* =====================================================
          WELCOME
      ====================================================== */}

      <section className="dashboard-intro">
        <div>
          <p className="eyebrow">
            PEOPLE. PERFORMANCE. PROGRESS.
          </p>

          <h2>
            {greeting}, {employeeName}.
          </h2>

          <p>
            Your Fluidé Homes workspace and employee
            details, together in one place.
          </p>
        </div>

        {statistics && canReadWorkforce && (
          <p className="last-updated">
            Updated{' '}
            {new Intl.DateTimeFormat(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            }).format(
              new Date(statistics.generatedAt),
            )}
          </p>
        )}
      </section>

      <MostUsedServices />
      <DashboardPolicies />

      {/* =====================================================
          WORKFORCE OVERVIEW
          Only visible to users with dashboard:read
      ====================================================== */}

      {canReadWorkforce && (
        <>
          <section className="dashboard-section dashboard-overview-heading">
            <div>
              <p className="eyebrow">
                AT A GLANCE
              </p>

              <h3>
                Workforce overview
              </h3>
            </div>

            <ChartNoAxesCombined
              size={18}
              strokeWidth={1.7}
              aria-hidden="true"
            />
          </section>

          {isLoading ? (
            <div
              className="dashboard-status"
              role="status"
            >
              <LoaderCircle
                className="loading-icon"
                size={19}
                aria-hidden="true"
              />

              <span>
                Loading workforce statistics…
              </span>
            </div>
          ) : error ? (
            <div
              className="dashboard-error"
              role="alert"
            >
              <CircleAlert
                size={19}
                aria-hidden="true"
              />

              <div>
                <strong>
                  Statistics unavailable
                </strong>

                <p>{error}</p>

                <button
                  className="text-button"
                  type="button"
                  onClick={() =>
                    void retryStatistics()
                  }
                >
                  <RotateCw
                    size={14}
                    aria-hidden="true"
                  />

                  Try again
                </button>
              </div>
            </div>
          ) : statistics ? (
            <>
              {/* =================================================
                  KPI CARDS
              ================================================== */}

              <section
                className="metric-grid"
                aria-label="Workforce statistics"
              >
                {metricDefinitions.map((metric) => (
                    <MetricCard
                      key={metric.key}
                      label={metric.label}
                      value={
                        statistics[
                          metric.key
                        ]
                      }
                      icon={metric.icon}
                      href={metric.href}
                    />
                  ))}
              </section>

              {/* =================================================
                  WORKFORCE ACTIVITY
              ================================================== */}

              <section className="dashboard-lower">
                <div className="dashboard-section">
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">
                        AT A GLANCE
                      </p>

                      <h3>
                        Workforce activity
                      </h3>
                    </div>

                    <ChartNoAxesCombined
                      size={18}
                      strokeWidth={1.7}
                      aria-hidden="true"
                    />
                  </div>

                  <dl className="activity-list">
                    <div>
                      <dt>
                        Leave requests
                      </dt>

                      <dd>
                        {formatNumber(
                          statistics.leaveRequests,
                        )}
                      </dd>
                    </div>

                    <div>
                      <dt>
                        Pending leave requests
                      </dt>

                      <dd>
                        {formatNumber(
                          statistics.pendingLeaveRequests,
                        )}
                      </dd>
                    </div>

                    <div>
                      <dt>
                        Appraisals
                      </dt>

                      <dd>
                        {formatNumber(
                          statistics.appraisals,
                        )}
                      </dd>
                    </div>

                    <div>
                      <dt>
                        Celebrations
                      </dt>

                      <dd>
                        {formatNumber(
                          statistics.celebrations,
                        )}
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* =================================================
                    WORKFORCE NOTE
                ================================================== */}

                <div className="dashboard-section dashboard-summary-note">
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">
                        WORKFORCE SNAPSHOT
                      </p>

                      <h3>
                        People &amp; operations
                      </h3>
                    </div>
                  </div>

                  <p>
                    The overview reflects records
                    currently available in Fluidé Homes
                    HRM. Open a section above to review
                    individual records and workflows.
                  </p>
                </div>
              </section>
            </>
          ) : (
            <div
              className="dashboard-status"
              role="status"
            >
              <span>
                No workforce statistics are
                available yet.
              </span>
            </div>
          )}
        </>
      )}

      <ServiceCatalog />
    </div>
  )
}
