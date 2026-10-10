import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  CalendarDays,
  Check,
  CirclePlus,
  ClipboardList,
  LoaderCircle,
  Pencil,
  RotateCw,
  Search,
  Star,
  X,
} from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { ApiError, api } from '../lib/api'

type CycleStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED'
type ReviewStatus = 'DRAFT' | 'SUBMITTED' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED'
type Cycle = {
  id: string
  name: string
  year: number
  startDate: string
  endDate: string
  description: string | null
  status: CycleStatus
}
type Review = {
  id: string
  cycleId: string
  employeeId: string
  reviewerId: string | null
  title: string | null
  selfAssessment: string | null
  managerAssessment: string | null
  strengths: string | null
  improvementAreas: string | null
  goals: string | null
  overallRating: number | null
  status: ReviewStatus
  submittedAt: string | null
  reviewedAt: string | null
  employee: { id: string; employeeNumber: string; firstName: string; lastName: string; email: string }
  reviewer: { id: string; employeeNumber: string; firstName: string; lastName: string; email: string } | null
  cycle: Cycle
}
type EmployeeOption = { id: string; employeeNumber: string; firstName: string; lastName: string; email: string }
type ReviewFilter = 'ALL' | ReviewStatus
type ReviewFields = {
  title: string
  selfAssessment: string
  managerAssessment: string
  strengths: string
  improvementAreas: string
  goals: string
  overallRating: string
}
type CycleFields = {
  name: string
  year: string
  startDate: string
  endDate: string
  description: string
  status: CycleStatus
}

const reviewStatusLabels: Record<ReviewStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  IN_REVIEW: 'In review',
  APPROVED: 'Approved',
  REJECTED: 'Needs revision',
}
const cycleStatusLabels: Record<CycleStatus, string> = { DRAFT: 'Draft', ACTIVE: 'Active', CLOSED: 'Closed' }
const emptyReviewFields: ReviewFields = {
  title: '',
  selfAssessment: '',
  managerAssessment: '',
  strengths: '',
  improvementAreas: '',
  goals: '',
  overallRating: '',
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(value))
}

function reviewFields(review: Review | null): ReviewFields {
  if (!review) return emptyReviewFields
  return {
    title: review.title ?? '',
    selfAssessment: review.selfAssessment ?? '',
    managerAssessment: review.managerAssessment ?? '',
    strengths: review.strengths ?? '',
    improvementAreas: review.improvementAreas ?? '',
    goals: review.goals ?? '',
    overallRating: review.overallRating === null ? '' : String(review.overallRating),
  }
}

function Rating({ value }: { value: number | null }) {
  return (
    <span className="appraisal-rating" aria-label={value === null ? 'Not rated' : `Rating ${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((star) => <Star key={star} size={13} fill={value !== null && star <= value ? 'currentColor' : 'none'} />)}
      <span>{value === null ? '—' : value.toFixed(1)}</span>
    </span>
  )
}

function ReviewDetailsDialog({ review, onClose }: { review: Review; onClose: () => void }) {
  const details: Array<[string, string]> = [
    ['Self-assessment', review.selfAssessment || '—'],
    ['Manager assessment', review.managerAssessment || '—'],
    ['Strengths', review.strengths || '—'],
    ['Areas for improvement', review.improvementAreas || '—'],
    ['Goals', review.goals || '—'],
    ['Reviewer', review.reviewer ? `${review.reviewer.firstName} ${review.reviewer.lastName}` : '—'],
  ]
  return (
    <div className="employee-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="employee-dialog appraisal-details-dialog" role="dialog" aria-modal="true" aria-labelledby="review-details-title">
        <header className="employee-dialog-header">
          <div>
            <p className="eyebrow">{review.cycle.name} · {review.cycle.year}</p>
            <h2 id="review-details-title">{review.employee.firstName} {review.employee.lastName}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close review details"><X size={19} /></button>
        </header>
        <div className="appraisal-detail-meta">
          <span className={`employee-status appraisal-status-${review.status.toLowerCase()}`}>{reviewStatusLabels[review.status]}</span>
          <Rating value={review.overallRating} />
          {review.title && <span>{review.title}</span>}
        </div>
        <dl className="appraisal-detail-list">
          {details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>
      </section>
    </div>
  )
}

function CycleDialog({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave: (fields: CycleFields) => Promise<void>
}) {
  const [form, setForm] = useState<CycleFields>(() => ({
    name: '',
    year: String(new Date().getFullYear()),
    startDate: '',
    endDate: '',
    description: '',
    status: 'DRAFT',
  }))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onSave(form)
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to create the appraisal cycle.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="employee-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="employee-dialog appraisal-dialog" role="dialog" aria-modal="true" aria-labelledby="cycle-form-title">
        <header className="employee-dialog-header">
          <div><p className="eyebrow">PERFORMANCE PERIOD</p><h2 id="cycle-form-title">Create appraisal cycle</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close cycle form"><X size={19} /></button>
        </header>
        <form className="employee-form" onSubmit={(event) => void submit(event)}>
          <div className="employee-form-grid">
            <label className="employee-form-full">Cycle name
              <input value={form.name} minLength={2} maxLength={150} required onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} autoFocus />
            </label>
            <label>Year
              <input type="number" value={form.year} min={2020} max={2100} required onChange={(event) => setForm((current) => ({ ...current, year: event.target.value }))} />
            </label>
            <label>Status
              <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as CycleStatus }))}>
                {Object.entries(cycleStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>Start date
              <input type="date" value={form.startDate} required onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))} />
            </label>
            <label>End date
              <input type="date" value={form.endDate} min={form.startDate || undefined} required onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))} />
            </label>
            <label className="employee-form-full">Description <span className="field-optional">Optional</span>
              <textarea value={form.description} maxLength={2000} rows={3} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
            </label>
          </div>
          {error && <p className="employee-form-error" role="alert"><AlertCircle size={15} />{error}</p>}
          <footer className="employee-dialog-actions">
            <button className="button-secondary" type="button" onClick={onClose}>Cancel</button>
            <button className="button-primary" type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create cycle'}</button>
          </footer>
        </form>
      </section>
    </div>
  )
}

function ReviewDialog({
  review,
  cycles,
  employees,
  currentEmployeeId,
  canReview,
  onClose,
  onSave,
}: {
  review: Review | null
  cycles: Cycle[]
  employees: EmployeeOption[]
  currentEmployeeId: string | null
  canReview: boolean
  onClose: () => void
  onSave: (data: {
    cycleId: string
    employeeId?: string
    fields: ReviewFields
    status: ReviewStatus
    isManagerReview: boolean
  }) => Promise<void>
}) {
  const [cycleId, setCycleId] = useState(review?.cycleId ?? cycles.find((cycle) => cycle.status === 'ACTIVE')?.id ?? '')
  const [employeeId, setEmployeeId] = useState(review?.employeeId ?? currentEmployeeId ?? '')
  const [fields, setFields] = useState<ReviewFields>(reviewFields(review))
  const [managerStatus, setManagerStatus] = useState<ReviewStatus>('IN_REVIEW')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const managerMode = Boolean(review && canReview)
  async function save(status: ReviewStatus) {
    setSaving(true)
    setError('')
    try {
      await onSave({ cycleId, employeeId, fields, status, isManagerReview: managerMode })
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to save this performance review.')
    } finally {
      setSaving(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void save(managerMode ? managerStatus : 'DRAFT')
  }

  return (
    <div className="employee-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="employee-dialog appraisal-dialog" role="dialog" aria-modal="true" aria-labelledby="review-form-title">
        <header className="employee-dialog-header">
          <div><p className="eyebrow">{managerMode ? 'MANAGER REVIEW' : 'PERFORMANCE REVIEW'}</p><h2 id="review-form-title">{review ? (managerMode ? 'Review performance' : 'Edit self-assessment') : 'Start a review'}</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close review form"><X size={19} /></button>
        </header>
        <form className="employee-form" onSubmit={(event) => submit(event)}>
          <div className="employee-form-grid">
            {!review && (
              <>
                <label className="employee-form-full">Appraisal cycle
                  <select value={cycleId} required onChange={(event) => setCycleId(event.target.value)}>
                    <option value="">Select a cycle</option>
                    {cycles.filter((cycle) => cycle.status !== 'CLOSED').map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.name} · {cycle.year}</option>)}
                  </select>
                </label>
                {canReview && employees.length > 0 && (
                  <label className="employee-form-full">Employee
                    <select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} required>
                      <option value="">Select an employee</option>
                      {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName} · {employee.employeeNumber}</option>)}
                    </select>
                  </label>
                )}
              </>
            )}
            {!managerMode && (
              <label className="employee-form-full">Review title <span className="field-optional">Optional</span>
                <input value={fields.title} maxLength={150} onChange={(event) => setFields((current) => ({ ...current, title: event.target.value }))} />
              </label>
            )}
            {!managerMode && (
              <>
                <label className="employee-form-full">Self-assessment
                  <textarea value={fields.selfAssessment} maxLength={4000} rows={4} onChange={(event) => setFields((current) => ({ ...current, selfAssessment: event.target.value }))} />
                </label>
                <label className="employee-form-full">Strengths <span className="field-optional">Optional</span>
                  <textarea value={fields.strengths} maxLength={2000} rows={3} onChange={(event) => setFields((current) => ({ ...current, strengths: event.target.value }))} />
                </label>
                <label className="employee-form-full">Areas for improvement <span className="field-optional">Optional</span>
                  <textarea value={fields.improvementAreas} maxLength={2000} rows={3} onChange={(event) => setFields((current) => ({ ...current, improvementAreas: event.target.value }))} />
                </label>
              </>
            )}
            {managerMode && (
              <>
                <label className="employee-form-full">Employee self-assessment
                  <textarea value={fields.selfAssessment || 'No self-assessment has been submitted.'} readOnly rows={4} />
                </label>
                <label className="employee-form-full">Manager assessment
                  <textarea value={fields.managerAssessment} maxLength={4000} rows={4} onChange={(event) => setFields((current) => ({ ...current, managerAssessment: event.target.value }))} />
                </label>
                <label>Overall rating <span className="field-optional">Optional · 1–5</span>
                  <select value={fields.overallRating} onChange={(event) => setFields((current) => ({ ...current, overallRating: event.target.value }))}>
                    <option value="">Not rated</option>
                    {[1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>{rating} / 5</option>)}
                  </select>
                </label>
                <label>Review status
                  <select value={managerStatus} onChange={(event) => setManagerStatus(event.target.value as ReviewStatus)}>
                    <option value="IN_REVIEW">In review</option>
                    <option value="APPROVED">Approve</option>
                    <option value="REJECTED">Request revision</option>
                  </select>
                </label>
                <label className="employee-form-full">Strengths
                  <textarea value={fields.strengths} maxLength={2000} rows={3} onChange={(event) => setFields((current) => ({ ...current, strengths: event.target.value }))} />
                </label>
                <label className="employee-form-full">Areas for improvement
                  <textarea value={fields.improvementAreas} maxLength={2000} rows={3} onChange={(event) => setFields((current) => ({ ...current, improvementAreas: event.target.value }))} />
                </label>
              </>
            )}
            <label className="employee-form-full">Goals
              <textarea value={fields.goals} maxLength={2000} rows={3} onChange={(event) => setFields((current) => ({ ...current, goals: event.target.value }))} />
            </label>
          </div>
          {error && <p className="employee-form-error" role="alert"><AlertCircle size={15} />{error}</p>}
          <footer className="employee-dialog-actions">
            <button className="button-secondary" type="button" onClick={onClose}>Cancel</button>
            {!managerMode && (
              <button className="button-secondary" type="button" disabled={saving || !cycleId || !employeeId} onClick={() => void save('SUBMITTED')}>
                Submit self-assessment
              </button>
            )}
            <button className="button-primary" type="submit" disabled={saving || (!review && (!cycleId || !employeeId))}>
              {saving ? 'Saving…' : managerMode ? 'Save review' : review ? 'Save draft' : 'Create draft'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}

export function AppraisalsPage() {
  const { user, hasPermission } = useAuth()
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [selectedCycle, setSelectedCycle] = useState('ALL')
  const [filter, setFilter] = useState<ReviewFilter>('ALL')
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [showCycleDialog, setShowCycleDialog] = useState(false)
  const [reviewDialog, setReviewDialog] = useState<Review | null | undefined>(undefined)
  const [detailsReview, setDetailsReview] = useState<Review | null>(null)
  const [notice, setNotice] = useState('')
  const [loadWarning, setLoadWarning] = useState('')
  const canRead = hasPermission('appraisal:read')
  const canUpdate = hasPermission('appraisal:update')
  const canReview = hasPermission('appraisal:review')
  const isCycleManager = user?.roles.some((role) => ['SUPER_ADMIN', 'HR', 'MANAGER'].includes(role)) ?? false

  useEffect(() => {
    if (!canRead) return
    let cancelled = false
    void Promise.allSettled([
      api.get<Cycle[]>('/appraisals/cycles'),
      api.get<Review[]>('/appraisals/reviews'),
      api.get<EmployeeOption[]>('/employees'),
    ]).then(([cycleResult, reviewResult, employeeResult]) => {
      if (cancelled) return
      const warnings: string[] = []
      if (cycleResult.status === 'fulfilled') setCycles(cycleResult.value)
      else {
        setCycles([])
        warnings.push('Appraisal cycles are unavailable.')
      }
      if (reviewResult.status === 'fulfilled') {
        setReviews(reviewResult.value)
        setError('')
      } else {
        const cause: unknown = reviewResult.reason
        setReviews([])
        setError(cause instanceof ApiError ? cause.message : 'Unable to load performance reviews.')
      }
      if (employeeResult.status === 'fulfilled') {
        setEmployees(employeeResult.value.map(({ id, employeeNumber, firstName, lastName, email }) => ({ id, employeeNumber, firstName, lastName, email })))
      } else {
        setEmployees([])
        warnings.push('Employee selection is unavailable; new reviews will use your own employee profile.')
      }
      setLoadWarning(warnings.join(' '))
      setIsLoading(false)
    })
    return () => { cancelled = true }
  }, [canRead, reloadKey])

  const filteredReviews = useMemo(() => reviews.filter((review) => {
    const query = search.trim().toLowerCase()
    const matchesCycle = selectedCycle === 'ALL' || review.cycleId === selectedCycle
    const matchesStatus = filter === 'ALL' || review.status === filter
    const searchText = `${review.employee.firstName} ${review.employee.lastName} ${review.employee.employeeNumber} ${review.cycle.name} ${review.title ?? ''}`.toLowerCase()
    return matchesCycle && matchesStatus && (!query || searchText.includes(query))
  }), [filter, reviews, search, selectedCycle])

  async function saveCycle(form: CycleFields) {
    const cycle = await api.post<Cycle>('/appraisals/cycles', {
      name: form.name.trim(),
      year: Number(form.year),
      startDate: new Date(`${form.startDate}T00:00:00.000Z`).toISOString(),
      endDate: new Date(`${form.endDate}T00:00:00.000Z`).toISOString(),
      description: form.description.trim() || undefined,
      status: form.status,
    })
    setCycles((current) => [cycle, ...current].sort((a, b) => b.startDate.localeCompare(a.startDate)))
    setShowCycleDialog(false)
    setNotice('Appraisal cycle created.')
  }

  async function saveReview(data: {
    cycleId: string
    employeeId?: string
    fields: ReviewFields
    status: ReviewStatus
    isManagerReview: boolean
  }) {
    const { fields } = data
    const payload = {
      title: fields.title.trim() || undefined,
      selfAssessment: fields.selfAssessment.trim() || undefined,
      managerAssessment: fields.managerAssessment.trim() || undefined,
      strengths: fields.strengths.trim() || undefined,
      improvementAreas: fields.improvementAreas.trim() || undefined,
      goals: fields.goals.trim() || undefined,
      overallRating: fields.overallRating ? Number(fields.overallRating) : undefined,
    }
    let saved: Review
    if (!reviewDialog) {
      saved = await api.post<Review>('/appraisals/reviews', {
        cycleId: data.cycleId,
        ...(data.employeeId && data.employeeId !== user?.employee?.id && { employeeId: data.employeeId }),
        ...payload,
        status: data.status,
      })
    } else if (data.isManagerReview) {
      saved = await api.patch<Review>(`/appraisals/reviews/${reviewDialog.id}/status`, {
        status: data.status,
        managerAssessment: payload.managerAssessment,
        strengths: payload.strengths,
        improvementAreas: payload.improvementAreas,
        goals: payload.goals,
        overallRating: payload.overallRating,
      })
    } else if (data.status === 'SUBMITTED') {
      saved = await api.patch<Review>(`/appraisals/reviews/${reviewDialog.id}`, {
        title: payload.title,
        selfAssessment: payload.selfAssessment,
        strengths: payload.strengths,
        improvementAreas: payload.improvementAreas,
        goals: payload.goals,
        status: 'SUBMITTED',
      })
    } else {
      saved = await api.patch<Review>(`/appraisals/reviews/${reviewDialog.id}`, payload)
    }
    setReviews((current) => {
      const existing = current.some((review) => review.id === saved.id)
      return existing ? current.map((review) => review.id === saved.id ? saved : review) : [saved, ...current]
    })
    setReviewDialog(undefined)
    setNotice(`Performance review ${data.status === 'SUBMITTED' ? 'submitted' : 'saved'}.`)
  }

  if (!canRead) {
    return (
      <section className="module-placeholder access-denied" role="alert">
        <div className="placeholder-icon"><AlertCircle size={21} aria-hidden="true" /></div>
        <div><h2>Access restricted</h2><p>Your account does not have permission to view performance reviews.</p></div>
      </section>
    )
  }

  const pendingCount = reviews.filter((review) => ['SUBMITTED', 'IN_REVIEW'].includes(review.status)).length

  return (
    <section className="appraisals-page" aria-label="Performance reviews">
      <div className="appraisal-overview">
        <div className="appraisal-cycle-card">
          <span className="employee-summary-icon"><ClipboardList size={17} /></span>
          <div><p className="eyebrow">CURRENT CYCLE</p><h2>{cycles.find((cycle) => cycle.status === 'ACTIVE')?.name ?? 'No active cycle'}</h2></div>
          {cycles.find((cycle) => cycle.status === 'ACTIVE') && <span className="employee-status employee-status-active">{cycles.find((cycle) => cycle.status === 'ACTIVE')?.year}</span>}
        </div>
        <div className="appraisal-count-card"><span>Reviews awaiting attention</span><strong>{pendingCount}</strong><small>submitted or in review</small></div>
      </div>
      {loadWarning && <p className="employee-inline-warning" role="status"><AlertCircle size={15} />{loadWarning}</p>}
      {notice && <div className="employee-notice" role="status"><Check size={15} /><span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Dismiss message"><X size={15} /></button></div>}

      <div className="appraisal-heading-row">
        <div><h2>Performance reviews</h2><p>Self-assessments, manager feedback, and development goals.</p></div>
        <div className="appraisal-heading-actions">
          {isCycleManager && <button className="button-secondary" type="button" onClick={() => setShowCycleDialog(true)}><CalendarDays size={15} /> New cycle</button>}
          {(canUpdate || canReview) && <button className="button-primary" type="button" onClick={() => setReviewDialog(null)}><CirclePlus size={16} /> Start review</button>}
        </div>
      </div>

      <div className="employee-toolbar appraisal-toolbar">
        <label className="employee-search"><Search size={16} /><span className="sr-only">Search reviews</span>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search employee or cycle…" />
        </label>
        <label className="employee-status-filter"><span>Cycle</span>
          <select value={selectedCycle} onChange={(event) => setSelectedCycle(event.target.value)}>
            <option value="ALL">All cycles</option>
            {cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.name} · {cycle.year}</option>)}
          </select>
        </label>
        <label className="employee-status-filter"><span>Status</span>
          <select value={filter} onChange={(event) => setFilter(event.target.value as ReviewFilter)}>
            <option value="ALL">All statuses</option>
            {Object.entries(reviewStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <button className="icon-button employee-refresh" type="button" onClick={() => { setIsLoading(true); setReloadKey((key) => key + 1) }} disabled={isLoading} aria-label="Refresh performance reviews">
          {isLoading ? <LoaderCircle className="loading-icon" size={17} /> : <RotateCw size={16} />}
        </button>
      </div>

      {error ? (
        <div className="employees-state employees-error" role="alert"><AlertCircle size={20} /><div><h2>Performance reviews unavailable</h2><p>{error}</p><button className="text-button" type="button" onClick={() => { setIsLoading(true); setReloadKey((key) => key + 1) }}><RotateCw size={14} /> Try again</button></div></div>
      ) : isLoading ? (
        <div className="employees-state" role="status"><LoaderCircle className="loading-icon" size={19} />Loading performance reviews…</div>
      ) : filteredReviews.length === 0 ? (
        <div className="employees-state empty-directory"><ClipboardList size={22} /><h2>{reviews.length ? 'No matching reviews' : 'No reviews yet'}</h2><p>{reviews.length ? 'Adjust your search or filters.' : 'Reviews created for an appraisal cycle will appear here.'}</p>{reviews.length > 0 && <button className="text-button" type="button" onClick={() => { setSearch(''); setFilter('ALL'); setSelectedCycle('ALL') }}>Clear filters</button>}</div>
      ) : (
        <div className="appraisal-table-wrap">
          <table className="appraisal-table">
            <thead><tr><th scope="col">Employee</th><th scope="col">Cycle</th><th scope="col">Status</th><th scope="col">Rating</th><th scope="col">Updated</th><th scope="col"><span className="sr-only">Action</span></th></tr></thead>
            <tbody>
              {filteredReviews.map((review) => {
                const isOwn = Boolean(user?.employee && review.employeeId === user.employee.id)
                const canEdit = (canUpdate && isOwn && review.status === 'DRAFT') || (canReview && ['SUBMITTED', 'IN_REVIEW'].includes(review.status))
                return (
                  <tr key={review.id}>
                    <td><button className="appraisal-employee-link" type="button" onClick={() => setDetailsReview(review)}><span className="employee-primary"><strong>{review.employee.firstName} {review.employee.lastName}</strong><span>{review.employee.employeeNumber}{review.title ? ` · ${review.title}` : ''}</span></span></button></td>
                    <td><span className="appraisal-cycle-cell">{review.cycle.name}<small>{review.cycle.year}</small></span></td>
                    <td><span className={`employee-status appraisal-status-${review.status.toLowerCase()}`}>{reviewStatusLabels[review.status]}</span></td>
                    <td><Rating value={review.overallRating} /></td>
                    <td>{formatDate(review.reviewedAt ?? review.submittedAt ?? review.cycle.startDate)}</td>
                    <td className="appraisal-action-cell">
                      {canEdit && <button className="icon-button" type="button" onClick={() => setReviewDialog(review)} aria-label={`${canReview ? 'Review' : 'Edit'} ${review.employee.firstName} ${review.employee.lastName}`}><Pencil size={15} /></button>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="employee-table-footer"><span>Showing {filteredReviews.length} of {reviews.length} reviews</span><span><ClipboardList size={13} /> Performance</span></div>
        </div>
      )}
      {showCycleDialog && <CycleDialog onClose={() => setShowCycleDialog(false)} onSave={saveCycle} />}
      {reviewDialog !== undefined && <ReviewDialog review={reviewDialog} cycles={cycles} employees={employees} currentEmployeeId={user?.employee?.id ?? null} canReview={canReview} onClose={() => setReviewDialog(undefined)} onSave={saveReview} />}
      {detailsReview && <ReviewDetailsDialog review={detailsReview} onClose={() => setDetailsReview(null)} />}
    </section>
  )
}
