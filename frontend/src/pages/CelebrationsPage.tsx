import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  CalendarDays,
  Check,
  CirclePlus,
  Gift,
  LoaderCircle,
  MapPin,
  Pencil,
  RotateCw,
  Search,
  Sparkles,
  X,
} from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { ApiError, api } from '../lib/api'

type CelebrationType =
  | 'BIRTHDAY'
  | 'WORK_ANNIVERSARY'
  | 'TEAM_ACHIEVEMENT'
  | 'COMPANY_EVENT'
  | 'HOLIDAY'
  | 'RECOGNITION'
  | 'OTHER'

type Celebration = {
  id: string
  title: string
  type: CelebrationType
  description: string | null
  eventDate: string | null
  location: string | null
  imageUrl: string | null
  isPublished: boolean
  createdBy: { id: string; firstName: string; lastName: string } | null
  createdAt: string
  updatedAt: string
}

type CelebrationFields = {
  title: string
  type: CelebrationType
  description: string
  eventDate: string
  location: string
  imageUrl: string
  isPublished: boolean
}

type CelebrationFilter = 'ALL' | 'UPCOMING' | 'PAST' | 'UNSCHEDULED'

const typeLabels: Record<CelebrationType, string> = {
  BIRTHDAY: 'Birthday',
  WORK_ANNIVERSARY: 'Work anniversary',
  TEAM_ACHIEVEMENT: 'Team achievement',
  COMPANY_EVENT: 'Company event',
  HOLIDAY: 'Holiday',
  RECOGNITION: 'Recognition',
  OTHER: 'Other',
}

const types = Object.keys(typeLabels) as CelebrationType[]
const emptyFields: CelebrationFields = {
  title: '',
  type: 'OTHER',
  description: '',
  eventDate: '',
  location: '',
  imageUrl: '',
  isPublished: true,
}

function toLocalDateTime(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function formatEventDate(value: string | null) {
  if (!value) return 'Date to be announced'
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value))
}

function isUpcoming(value: string | null, now: Date) {
  if (!value) return false
  const event = new Date(value)
  return new Date(Date.UTC(event.getUTCFullYear(), event.getUTCMonth(), event.getUTCDate()))
    >= new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
}

function CelebrationDialog({
  celebration,
  onClose,
  onSave,
}: {
  celebration: Celebration | null
  onClose: () => void
  onSave: (fields: CelebrationFields) => Promise<void>
}) {
  const [fields, setFields] = useState<CelebrationFields>(() => celebration
    ? {
        title: celebration.title,
        type: celebration.type,
        description: celebration.description ?? '',
        eventDate: toLocalDateTime(celebration.eventDate),
        location: celebration.location ?? '',
        imageUrl: celebration.imageUrl ?? '',
        isPublished: celebration.isPublished,
      }
    : emptyFields)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onSave(fields)
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to save this celebration.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="employee-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="employee-dialog celebration-dialog" role="dialog" aria-modal="true" aria-labelledby="celebration-form-title">
        <header className="employee-dialog-header">
          <div><p className="eyebrow">PEOPLE & CULTURE</p><h2 id="celebration-form-title">{celebration ? 'Edit celebration' : 'Add celebration'}</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close celebration form"><X size={19} /></button>
        </header>
        <form className="employee-form" onSubmit={(event) => void submit(event)}>
          <div className="employee-form-grid">
            <label className="employee-form-full">Title
              <input value={fields.title} onChange={(event) => setFields((current) => ({ ...current, title: event.target.value }))} minLength={2} maxLength={150} required autoFocus />
            </label>
            <label>Type
              <select value={fields.type} onChange={(event) => setFields((current) => ({ ...current, type: event.target.value as CelebrationType }))}>
                {types.map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}
              </select>
            </label>
            <label>Event date <span className="field-optional">Optional</span>
              <input type="datetime-local" value={fields.eventDate} onChange={(event) => setFields((current) => ({ ...current, eventDate: event.target.value }))} />
            </label>
            <label className="employee-form-full">Description <span className="field-optional">Optional</span>
              <textarea value={fields.description} onChange={(event) => setFields((current) => ({ ...current, description: event.target.value }))} maxLength={2000} rows={4} />
            </label>
            <label>Location <span className="field-optional">Optional</span>
              <input value={fields.location} onChange={(event) => setFields((current) => ({ ...current, location: event.target.value }))} maxLength={200} />
            </label>
            <label>Image URL <span className="field-optional">Optional</span>
              <input type="url" value={fields.imageUrl} onChange={(event) => setFields((current) => ({ ...current, imageUrl: event.target.value }))} maxLength={500} placeholder="https://…" />
            </label>
            <label className="department-active-toggle">
              <input type="checkbox" checked={fields.isPublished} onChange={(event) => setFields((current) => ({ ...current, isPublished: event.target.checked }))} />
              Published and visible
            </label>
            {celebration && (
              <p className="celebration-optional-help">
                The current API does not support clearing a saved event date or image. Leaving either field blank keeps its existing value.
              </p>
            )}
          </div>
          {error && <p className="employee-form-error" role="alert"><AlertCircle size={15} />{error}</p>}
          <footer className="employee-dialog-actions">
            <button className="button-secondary" type="button" onClick={onClose}>Cancel</button>
            <button className="button-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : celebration ? 'Save changes' : 'Add celebration'}</button>
          </footer>
        </form>
      </section>
    </div>
  )
}

export function CelebrationsPage() {
  const { hasPermission, user } = useAuth()
  const [celebrations, setCelebrations] = useState<Celebration[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<CelebrationFilter>('ALL')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [dialogCelebration, setDialogCelebration] = useState<Celebration | null | undefined>(undefined)
  const [notice, setNotice] = useState('')
  const canRead = hasPermission('celebration:read')
  const canManage = hasPermission('celebration:create')
    && (user?.roles.some((role) => ['SUPER_ADMIN', 'HR', 'MANAGER'].includes(role)) ?? false)
  const [today] = useState(() => new Date())

  useEffect(() => {
    if (!canRead) return
    let cancelled = false
    void api.get<Celebration[]>('/celebrations').then((result) => {
      if (cancelled) return
      setCelebrations(result)
      setError('')
      setIsLoading(false)
    }).catch((cause: unknown) => {
      if (cancelled) return
      setCelebrations([])
      setError(cause instanceof ApiError ? cause.message : 'Unable to load celebrations.')
      setIsLoading(false)
    })
    return () => { cancelled = true }
  }, [canRead, reloadKey])

  const filteredCelebrations = useMemo(() => {
    const query = search.trim().toLowerCase()
    return celebrations.filter((item) => {
      const matchesSearch = !query || `${item.title} ${item.description ?? ''} ${typeLabels[item.type]} ${item.location ?? ''}`.toLowerCase().includes(query)
      const upcoming = isUpcoming(item.eventDate, today)
      const matchesFilter = filter === 'ALL'
        || (filter === 'UPCOMING' && upcoming)
        || (filter === 'PAST' && item.eventDate !== null && !upcoming)
        || (filter === 'UNSCHEDULED' && item.eventDate === null)
      return matchesSearch && matchesFilter
    }).sort((a, b) => {
      if (!a.eventDate) return 1
      if (!b.eventDate) return -1
      return new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
    })
  }, [celebrations, filter, search, today])

  async function saveCelebration(fields: CelebrationFields) {
    const payload = {
      title: fields.title.trim(),
      type: fields.type,
      description: fields.description.trim(),
      eventDate: fields.eventDate ? new Date(fields.eventDate).toISOString() : undefined,
      location: fields.location.trim(),
      imageUrl: fields.imageUrl.trim() || undefined,
      isPublished: fields.isPublished,
    }
    if (dialogCelebration) {
      const updated = await api.patch<Celebration>(`/celebrations/${dialogCelebration.id}`, payload)
      setCelebrations((current) => current.map((item) => item.id === updated.id ? updated : item))
      setNotice(`${updated.title} was updated.`)
    } else {
      const created = await api.post<Celebration>('/celebrations', payload)
      setCelebrations((current) => [...current, created])
      setNotice(`${created.title} was added.`)
    }
    setDialogCelebration(undefined)
  }

  if (!canRead) {
    return (
      <section className="module-placeholder access-denied" role="alert">
        <div className="placeholder-icon"><AlertCircle size={21} /></div>
        <div><h2>Access restricted</h2><p>Your account does not have permission to view celebrations.</p></div>
      </section>
    )
  }

  const upcomingCount = celebrations.filter((item) => item.isPublished && isUpcoming(item.eventDate, today)).length
  const publishedCount = celebrations.filter((item) => item.isPublished).length

  return (
    <section className="celebrations-page" aria-label="Celebrations">
      <div className="celebrations-overview">
        <div className="celebrations-intro-card">
          <span className="employee-summary-icon"><Sparkles size={17} /></span>
          <div><p className="eyebrow">MOMENTS WORTH CELEBRATING</p><h2>Make every milestone count.</h2><p>Birthdays, anniversaries, and team achievements, all in one place.</p></div>
        </div>
        <div className="celebrations-stat-card">
          <span><CalendarDays size={15} /> Coming up</span><strong>{upcomingCount}</strong><small>published events</small>
        </div>
        <div className="celebrations-stat-card">
          <span><Gift size={15} /> Published</span><strong>{publishedCount}</strong><small>celebrations</small>
        </div>
      </div>

      {notice && <div className="employee-notice" role="status"><Check size={15} /><span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Dismiss message"><X size={15} /></button></div>}

      <div className="celebration-heading-row">
        <div><h2>Celebration calendar</h2><p>Recognise the people and moments that bring us together.</p></div>
        {canManage && <button className="button-primary" type="button" onClick={() => setDialogCelebration(null)}><CirclePlus size={16} /> Add celebration</button>}
      </div>

      <div className="employee-toolbar">
        <label className="employee-search"><Search size={16} /><span className="sr-only">Search celebrations</span>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search celebrations…" />
        </label>
        <label className="employee-status-filter"><span>Show</span>
          <select value={filter} onChange={(event) => setFilter(event.target.value as CelebrationFilter)}>
            <option value="ALL">All dates</option><option value="UPCOMING">Upcoming</option><option value="PAST">Past</option><option value="UNSCHEDULED">Unscheduled</option>
          </select>
        </label>
        <button className="icon-button employee-refresh" type="button" onClick={() => { setIsLoading(true); setReloadKey((key) => key + 1) }} disabled={isLoading} aria-label="Refresh celebrations">
          {isLoading ? <LoaderCircle className="loading-icon" size={17} /> : <RotateCw size={16} />}
        </button>
      </div>

      {error ? (
        <div className="employees-state employees-error" role="alert"><AlertCircle size={20} /><div><h2>Celebrations unavailable</h2><p>{error}</p><button className="text-button" type="button" onClick={() => { setIsLoading(true); setReloadKey((key) => key + 1) }}><RotateCw size={14} /> Try again</button></div></div>
      ) : isLoading ? (
        <div className="employees-state" role="status"><LoaderCircle className="loading-icon" size={19} />Loading celebrations…</div>
      ) : filteredCelebrations.length === 0 ? (
        <div className="employees-state empty-directory"><Gift size={22} /><h2>{celebrations.length ? 'No matching celebrations' : 'No celebrations yet'}</h2><p>{celebrations.length ? 'Try a different search or date filter.' : 'Celebrations added to the calendar will appear here.'}</p>{canManage && celebrations.length === 0 && <button className="button-primary" type="button" onClick={() => setDialogCelebration(null)}><CirclePlus size={16} /> Add celebration</button>}{celebrations.length > 0 && <button className="text-button" type="button" onClick={() => { setSearch(''); setFilter('ALL') }}>Clear filters</button>}</div>
      ) : (
        <div className="celebration-grid">
          {filteredCelebrations.map((item) => (
            <article className={`celebration-card${!item.isPublished ? ' is-unpublished' : ''}`} key={item.id}>
              {item.imageUrl ? (
                <img className="celebration-image" src={item.imageUrl} alt="" loading="lazy" />
              ) : (
                <div className="celebration-image-placeholder" aria-hidden="true"><Gift size={25} strokeWidth={1.4} /></div>
              )}
              <div className="celebration-card-body">
                <div className="celebration-card-meta">
                  <span className="celebration-type-label">{typeLabels[item.type]}</span>
                  {!item.isPublished && <span className="employee-status">Unpublished</span>}
                </div>
                <h3>{item.title}</h3>
                {item.description && <p className="celebration-description">{item.description}</p>}
                <div className="celebration-event-meta">
                  <span><CalendarDays size={14} />{formatEventDate(item.eventDate)}</span>
                  {item.location && <span><MapPin size={14} />{item.location}</span>}
                </div>
                {canManage && <button className="button-secondary celebration-edit" type="button" onClick={() => setDialogCelebration(item)}><Pencil size={13} /> Edit event</button>}
              </div>
            </article>
          ))}
        </div>
      )}
      {dialogCelebration !== undefined && <CelebrationDialog celebration={dialogCelebration} onClose={() => setDialogCelebration(undefined)} onSave={saveCelebration} />}
    </section>
  )
}
