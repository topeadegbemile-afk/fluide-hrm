import { useCallback, useEffect, useState } from 'react'
import { Bell, Check, CircleAlert, LoaderCircle, MailOpen, Search, Send } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ApiError, api } from '../lib/api'
import { useAuth } from '../auth/useAuth'

type NotificationRecord = {
  id: string
  title: string
  message: string
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'ANNOUNCEMENT'
  isRead: boolean
  metadata: { employeeId?: string; employeeName?: string; sections?: string[]; destination?: string; period?: string; payslipId?: string; requestType?: string; reviewStatus?: string } | null
  createdAt: string
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function NotificationsPage() {
  const { hasPermission } = useAuth()
  const canRead = hasPermission('notification:read')
  const canCreate = hasPermission('notification:create')
  const [notifications, setNotifications] = useState<NotificationRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  const loadNotifications = useCallback(async () => {
    try {
      setNotifications(await api.get<NotificationRecord[]>('/notifications'))
      setError('')
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to load notifications.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (canRead) void loadNotifications()
    else setIsLoading(false)
  }, [canRead, loadNotifications])

  async function markRead(notification: NotificationRecord) {
    if (notification.isRead) return
    try {
      const updated = await api.patch<NotificationRecord>(`/notifications/${notification.id}`, { isRead: true })
      setNotifications((items) => items.map((item) => item.id === updated.id ? updated : item))
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to update this notification.')
    }
  }

  async function sendAnnouncement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSending(true)
    setError('')
    try {
      await api.post('/notifications', { title, message, type: 'ANNOUNCEMENT', allEmployees: true })
      setTitle('')
      setMessage('')
      await loadNotifications()
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to send this announcement.')
    } finally {
      setSending(false)
    }
  }

  const filteredNotifications = notifications.filter((item) => `${item.title} ${item.message}`.toLowerCase().includes(search.toLowerCase()))

  if (!canRead) {
    return <section className="module-placeholder access-denied" role="alert"><div className="placeholder-icon"><CircleAlert size={20} /></div><div><h2>Access restricted</h2><p>Your account does not have permission to view notifications.</p></div></section>
  }

  return (
    <section className="notifications-page" aria-label="Notifications">
      <div className="notifications-intro">
        <div className="notification-icon"><Bell size={18} aria-hidden="true" /></div>
        <div><p className="eyebrow">UPDATES</p><h2>Notifications</h2><p>Stay up to date with changes across your HR workspace.</p></div>
        <span className="notification-count">{notifications.filter((item) => !item.isRead).length} unread</span>
      </div>

      {canCreate && <form className="notification-compose" onSubmit={(event) => void sendAnnouncement(event)}>
        <div><strong>Send an announcement</strong><span>Share information with every employee who has an account.</span></div>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Announcement title" maxLength={150} required aria-label="Announcement title" />
        <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write your message" maxLength={2000} required aria-label="Announcement message" rows={3} />
        <button className="button-primary" type="submit" disabled={sending || !title.trim() || !message.trim()}>{sending ? <LoaderCircle className="loading-icon" size={16} /> : <Send size={15} />} Send to all employees</button>
      </form>}

      {error && <div className="dashboard-error" role="alert"><CircleAlert size={17} /><p>{error}</p></div>}
      {!isLoading && notifications.length > 0 && <label className="notifications-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search notifications" aria-label="Search notifications" /></label>}
      {isLoading ? <div className="dashboard-status" role="status"><LoaderCircle className="loading-icon" size={18} /> Loading notifications…</div> : filteredNotifications.length === 0 ? (
        <div className="notifications-empty"><MailOpen size={22} /><strong>No pending requests at this time.</strong><span>{search ? 'Try a different search.' : 'New requests and announcements will appear here.'}</span></div>
      ) : (
        <div className="notification-list">
          {filteredNotifications.map((notification) => (
            <article className={`notification-item${notification.isRead ? '' : ' is-unread'}`} key={notification.id}>
              <span className="notification-item-icon"><Bell size={16} aria-hidden="true" /></span>
              <div className="notification-item-content">
                <div className="notification-item-heading"><strong>{notification.title}</strong><time dateTime={notification.createdAt}>{formatDate(notification.createdAt)}</time></div>
                <p>{notification.message}</p>
                {notification.metadata?.sections?.length ? <div className="notification-tags">{notification.metadata.sections.map((section) => <span key={section}>{section}</span>)}</div> : null}
                {notification.metadata?.employeeId && !notification.metadata.destination && <Link className="notification-view-link" to="/employees">View employee directory</Link>}
                {notification.metadata?.destination?.startsWith('/employees?section=pending-reviews') && <Link className="notification-view-link" to={notification.metadata.destination}>Review pending submission</Link>}
                {notification.metadata?.destination?.startsWith('/policy?article=') && <Link className="notification-view-link" to={notification.metadata.destination} onClick={() => void markRead(notification)}>View policy</Link>}
                {notification.metadata?.destination === '/employees' && <Link className="notification-view-link" to="/employees">View employee directory</Link>}
                {notification.metadata?.destination === '/my-information' && <Link className="notification-view-link" to="/my-information">View my information</Link>}
                {notification.metadata?.destination === '/payroll' && <Link className="notification-view-link" to="/payroll">View payslip</Link>}
                {notification.metadata?.destination === '/leaves' && <Link className="notification-view-link" to="/leaves">Review leave request</Link>}
                {notification.metadata?.destination === '/security' && <Link className="notification-view-link" to="/security">Review device request</Link>}
                {notification.type === 'ANNOUNCEMENT' && !notification.metadata?.destination && <span className="notification-view-link">Company announcement</span>}
              </div>
              {!notification.isRead && <button className="notification-mark-read" type="button" onClick={() => void markRead(notification)} aria-label="Mark notification as read"><Check size={15} /> Mark read</button>}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
