import { useCallback, useEffect, useState } from 'react'
import { Bell, Check, CircleAlert, LoaderCircle, MailOpen } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ApiError, api } from '../lib/api'
import { useAuth } from '../auth/useAuth'

type NotificationRecord = {
  id: string
  title: string
  message: string
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'ANNOUNCEMENT'
  isRead: boolean
  metadata: { employeeId?: string; employeeName?: string; sections?: string[] } | null
  createdAt: string
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function NotificationsPage() {
  const { hasPermission } = useAuth()
  const canRead = hasPermission('notification:read')
  const [notifications, setNotifications] = useState<NotificationRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

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

      {error && <div className="dashboard-error" role="alert"><CircleAlert size={17} /><p>{error}</p></div>}
      {isLoading ? <div className="dashboard-status" role="status"><LoaderCircle className="loading-icon" size={18} /> Loading notifications…</div> : notifications.length === 0 ? (
        <div className="notifications-empty"><MailOpen size={22} /><strong>You’re all caught up</strong><span>New updates will appear here.</span></div>
      ) : (
        <div className="notification-list">
          {notifications.map((notification) => (
            <article className={`notification-item${notification.isRead ? '' : ' is-unread'}`} key={notification.id}>
              <span className="notification-item-icon"><Bell size={16} aria-hidden="true" /></span>
              <div className="notification-item-content">
                <div className="notification-item-heading"><strong>{notification.title}</strong><time dateTime={notification.createdAt}>{formatDate(notification.createdAt)}</time></div>
                <p>{notification.message}</p>
                {notification.metadata?.sections?.length ? <div className="notification-tags">{notification.metadata.sections.map((section) => <span key={section}>{section}</span>)}</div> : null}
                {notification.metadata?.employeeId && <Link className="notification-view-link" to="/employees">View employee directory</Link>}
              </div>
              {!notification.isRead && <button className="notification-mark-read" type="button" onClick={() => void markRead(notification)} aria-label="Mark notification as read"><Check size={15} /> Mark read</button>}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
