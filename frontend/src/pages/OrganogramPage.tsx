import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  LoaderCircle,
  Mail,
  Network,
  RotateCw,
  Search,
  UsersRound,
} from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { ApiError, api } from '../lib/api'

type OrgNode = {
  id: string
  employeeNumber: string
  firstName: string
  lastName: string
  email: string
  position: { id: string; title: string } | null
  department: { id: string; name: string } | null
  employmentStatus: string
  managerId: string | null
  directReports: OrgNode[]
}

type OrgTree = { totalEmployees: number; roots: OrgNode[] }
type OrgSummary = {
  totalEmployees: number
  managers: number
  topLevel: number
  byDepartment: Record<string, number>
}

function employeeName(employee: OrgNode) {
  return `${employee.firstName} ${employee.lastName}`
}

function normalizeStatus(status: string) {
  return status.toLowerCase().replaceAll('_', ' ')
}

function visibleMatches(employee: OrgNode, query: string): OrgNode[] {
  if (!query) return [employee]
  const ownMatch = [
    employee.firstName,
    employee.lastName,
    employee.employeeNumber,
    employee.email,
    employee.position?.title,
    employee.department?.name,
  ].filter(Boolean).join(' ').toLowerCase().includes(query)
  const reports = employee.directReports.flatMap((report) => visibleMatches(report, query))
  return ownMatch || reports.length ? [{ ...employee, directReports: reports }] : []
}

function OrgChartNode({
  employee,
  expanded,
  onToggle,
  revealChildren,
}: {
  employee: OrgNode
  expanded: boolean
  onToggle: (id: string) => void
  revealChildren: boolean
}) {
  const hasReports = employee.directReports.length > 0
  const childrenVisible = revealChildren || expanded
  return (
    <li className="org-node">
      <article className="org-card">
        <div className="org-card-heading">
          <span className="employee-avatar" aria-hidden="true">
            {employee.firstName.charAt(0)}{employee.lastName.charAt(0)}
          </span>
          <span className="employee-primary">
            <strong>{employeeName(employee)}</strong>
            <span>{employee.employeeNumber}</span>
          </span>
          <span className={`employee-status org-status-${employee.employmentStatus.toLowerCase()}`}>
            {normalizeStatus(employee.employmentStatus)}
          </span>
        </div>
        <div className="org-card-role">
          <strong>{employee.position?.title || 'Position not assigned'}</strong>
          <span>{employee.department?.name || 'Department not assigned'}</span>
        </div>
        <a className="org-card-email" href={`mailto:${employee.email}`}>
          <Mail size={12} aria-hidden="true" />
          <span>{employee.email}</span>
        </a>
        {hasReports && (
          <button
            className="org-card-reports"
            type="button"
            onClick={() => onToggle(employee.id)}
            aria-expanded={childrenVisible}
            aria-label={`${childrenVisible ? 'Hide' : 'Show'} ${employee.directReports.length} direct reports for ${employeeName(employee)}`}
          >
            <UsersRound size={13} aria-hidden="true" />
            {employee.directReports.length} direct {employee.directReports.length === 1 ? 'report' : 'reports'}
            {childrenVisible ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
          </button>
        )}
      </article>
      {hasReports && childrenVisible && (
        <ul className="org-children">
          {employee.directReports.map((report) => (
            <OrgChartNode
              key={report.id}
              employee={report}
              expanded={expanded}
              onToggle={onToggle}
              revealChildren={revealChildren}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

export function OrganogramPage() {
  const { hasPermission } = useAuth()
  const [tree, setTree] = useState<OrgTree | null>(null)
  const [summary, setSummary] = useState<OrgSummary | null>(null)
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [summaryWarning, setSummaryWarning] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const canRead = hasPermission('employee:read')

  useEffect(() => {
    if (!canRead) return
    let cancelled = false
    void Promise.allSettled([
      api.get<OrgTree>('/organogram/tree'),
      api.get<OrgSummary>('/organogram/summary'),
    ]).then(([treeResult, summaryResult]) => {
      if (cancelled) return
      if (treeResult.status === 'fulfilled') {
        setTree(treeResult.value)
        setError('')
      } else {
        const cause: unknown = treeResult.reason
        setTree(null)
        setError(cause instanceof ApiError ? cause.message : 'Unable to load the organisation chart.')
      }
      if (summaryResult.status === 'fulfilled') {
        setSummary(summaryResult.value)
        setSummaryWarning('')
      } else {
        setSummary(null)
        setSummaryWarning('Organisation summary is temporarily unavailable.')
      }
      setExpandedIds(new Set())
      setIsLoading(false)
    })
    return () => { cancelled = true }
  }, [canRead, reloadKey])

  const normalizedSearch = search.trim().toLowerCase()
  const visibleRoots = useMemo(() => {
    if (!tree) return []
    if (!normalizedSearch) return tree.roots
    return tree.roots.flatMap((root) => visibleMatches(root, normalizedSearch))
  }, [normalizedSearch, tree])

  function toggleNode(id: string) {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function setAllExpanded(expanded: boolean) {
    if (!expanded || !tree) {
      setExpandedIds(new Set())
      return
    }
    const ids = new Set<string>()
    function collect(employee: OrgNode) {
      if (employee.directReports.length) ids.add(employee.id)
      employee.directReports.forEach(collect)
    }
    tree.roots.forEach(collect)
    setExpandedIds(ids)
  }

  function isExpanded(employee: OrgNode) {
    return expandedIds.has(employee.id)
  }

  if (!canRead) {
    return (
      <section className="module-placeholder access-denied" role="alert">
        <div className="placeholder-icon"><AlertCircle size={21} aria-hidden="true" /></div>
        <div><h2>Access restricted</h2><p>Your account does not have permission to view the organisation chart.</p></div>
      </section>
    )
  }

  return (
    <section className="organogram-page" aria-label="Organisation chart">
      <div className="org-summary-row">
        <div className="org-summary-item">
          <span className="employee-summary-icon"><Network size={17} aria-hidden="true" /></span>
          <span><strong>{summary?.totalEmployees ?? tree?.totalEmployees ?? 0}</strong> people in the organisation</span>
        </div>
        <div className="org-summary-metrics">
          <span><strong>{summary?.managers ?? '—'}</strong> reporting to a manager</span>
          <span><strong>{summary?.topLevel ?? '—'}</strong> top-level</span>
        </div>
      </div>

      {summaryWarning && <p className="employee-inline-warning" role="status"><AlertCircle size={15} />{summaryWarning}</p>}

      <div className="org-toolbar">
        <label className="employee-search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Search organisation</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search people, roles, departments…"
          />
        </label>
        <div className="org-toolbar-actions">
          <button className="button-secondary" type="button" onClick={() => setAllExpanded(true)} disabled={isLoading || !tree?.roots.length}>
            Expand all
          </button>
          <button className="button-secondary" type="button" onClick={() => setAllExpanded(false)} disabled={isLoading || !tree?.roots.length}>
            Collapse all
          </button>
          <button
            className="icon-button employee-refresh"
            type="button"
            onClick={() => { setIsLoading(true); setReloadKey((key) => key + 1) }}
            disabled={isLoading}
            aria-label="Refresh organisation chart"
          >
            {isLoading ? <LoaderCircle className="loading-icon" size={16} /> : <RotateCw size={16} />}
          </button>
        </div>
      </div>

      {error ? (
        <div className="employees-state employees-error" role="alert">
          <AlertCircle size={20} aria-hidden="true" />
          <div>
            <h2>Organisation chart unavailable</h2>
            <p>{error}</p>
            <button className="text-button" type="button" onClick={() => { setIsLoading(true); setReloadKey((key) => key + 1) }}>
              <RotateCw size={14} aria-hidden="true" /> Try again
            </button>
          </div>
        </div>
      ) : isLoading ? (
        <div className="employees-state" role="status"><LoaderCircle className="loading-icon" size={19} />Loading organisation chart…</div>
      ) : !tree?.totalEmployees ? (
        <div className="employees-state empty-directory">
          <Network size={22} aria-hidden="true" />
          <h2>No employees to display</h2>
          <p>Add employee records and assign managers to build the organisation chart.</p>
        </div>
      ) : visibleRoots.length === 0 ? (
        <div className="employees-state empty-directory">
          <Search size={22} aria-hidden="true" />
          <h2>No matching people</h2>
          <p>Try searching by a different name, role, or department.</p>
          <button className="text-button" type="button" onClick={() => setSearch('')}>Clear search</button>
        </div>
      ) : (
        <>
          <div className="org-chart-meta">
            <span>{normalizedSearch ? `Matching branches for “${search.trim()}”` : 'Reporting structure'}</span>
            {summary?.byDepartment && (
              <div className="org-department-chips" aria-label="Employees by department">
                {Object.entries(summary.byDepartment).sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) => (
                  <span key={name}>{name}<strong>{count}</strong></span>
                ))}
              </div>
            )}
          </div>
          <div className="org-chart-viewport">
            <ul className="org-tree">
              {visibleRoots.map((root) => (
                <OrgChartNode
                  key={root.id}
                  employee={root}
                  expanded={isExpanded(root)}
                  onToggle={toggleNode}
                  revealChildren={Boolean(normalizedSearch)}
                />
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  )
}
