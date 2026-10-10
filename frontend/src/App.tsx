import { useEffect, useState } from 'react'
import { NavLink, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronRight,
  ClipboardList,
  Clock3,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Moon,
  Network,
  PartyPopper,
  Settings,
  Shield,
  Sun,
  UsersRound,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from './auth/useAuth'
import { PublicOnly, RequireAuth } from './auth/RouteGuards'
import { DashboardPage } from './pages/DashboardPage'
import { AttendancePage } from './pages/AttendancePage'
import { AppraisalsPage } from './pages/AppraisalsPage'
import { CelebrationsPage } from './pages/CelebrationsPage'
import { DepartmentsPage } from './pages/DepartmentsPage'
import { EmployeesPage } from './pages/EmployeesPage'
import { MyPersonalInformationPage } from './pages/MyPersonalInformationPage'
import { HandbookPage } from './pages/HandbookPage'
import { LoginPage } from './pages/LoginPage'
import { LeavePage } from './pages/LeavePage'
import { OrganogramPage } from './pages/OrganogramPage'
import { PositionsPage } from './pages/PositionsPage'
import { ReportsPage } from './pages/ReportsPage'
import { UsersPage } from './pages/UsersPage'
import { RolesPage } from './pages/RolesPage'
import { AuditLogsPage } from './pages/AuditLogsPage'
import { SettingsPage } from './pages/SettingsPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { CollaborationPage } from './pages/CollaborationPage'
import { api } from './lib/api'
import { useTheme } from './theme/useTheme'
import { EmployeeAvatar } from './components/EmployeeAvatar'
import './App.css'

type NavigationItem = {
  label: string
  path: string
  icon: LucideIcon
  permission?: string
}

type NavigationSection = {
  label: string
  items: NavigationItem[]
}

const navigation: NavigationSection[] = [
  {
    label: 'Overview',
    items: [{ label: 'Dashboard', path: '/', icon: LayoutDashboard }],
  },
  {
    label: 'People',
    items: [
      { label: 'Employees', path: '/employees', icon: UsersRound, permission: 'employee:read' },
      { label: 'My information', path: '/my-information', icon: UsersRound },
      { label: 'Departments', path: '/departments', icon: Building2, permission: 'department:read' },
      { label: 'Positions', path: '/positions', icon: BriefcaseBusiness, permission: 'position:read' },
      { label: 'Organogram', path: '/organogram', icon: Network, permission: 'employee:read' },
    ],
  },
  {
    label: 'HR management',
    items: [
      { label: 'Attendance', path: '/attendance', icon: Clock3, permission: 'attendance:read' },
      { label: 'Leave', path: '/leaves', icon: CalendarDays, permission: 'leave:read' },
      { label: 'Performance', path: '/appraisals', icon: ClipboardList, permission: 'appraisal:read' },
      { label: 'Celebrations', path: '/celebrations', icon: PartyPopper, permission: 'celebration:read' },
      { label: 'Policy', path: '/policy', icon: BookOpen, permission: 'handbook:read' },
      { label: 'Team chat', path: '/collaboration', icon: MessageCircle },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Notifications', path: '/notifications', icon: Bell, permission: 'notification:read' },
      { label: 'Reports', path: '/reports', icon: ChartNoAxesCombined, permission: 'report:read' },
      { label: 'Users', path: '/users', icon: UsersRound, permission: 'user:read' },
      { label: 'Roles & permissions', path: '/roles', icon: Shield, permission: 'role:read' },
      { label: 'Audit logs', path: '/audit-logs', icon: FileText, permission: 'audit:read' },
      { label: 'Settings', path: '/settings', icon: Settings },
    ],
  },
]

const pages = navigation.flatMap((section) => section.items)

function Sidebar({ onNavigate, theme }: { onNavigate: () => void; theme: 'light' | 'dark' }) {
  const { hasPermission } = useAuth()

  return (
    <aside className="sidebar">
      <NavLink className="brand" to="/" onClick={onNavigate} aria-label="Fluidé Homes home">
        <img src={theme === 'dark' ? '/fluide-logo-white.png' : '/fluide-logo.png'} alt="Fluidé Homes" />
      </NavLink>

      <div className="workspace-label">PEOPLE OPERATIONS</div>

      <nav className="main-navigation" aria-label="Main navigation">
        {navigation.map((section) => {
          const visibleItems = section.items.filter(
            (item) => !item.permission || hasPermission(item.permission),
          )
          if (!visibleItems.length) return null

          return (
            <div className="navigation-section" key={section.label}>
              <h2 className="navigation-heading">{section.label}</h2>
              <ul>
                {visibleItems.map((item) => {
                  const Icon = item.icon
                  return (
                    <li key={item.path}>
                      <NavLink
                        to={item.path}
                        end={item.path === '/'}
                        onClick={onNavigate}
                        className={({ isActive }) =>
                          `navigation-link${isActive ? ' is-active' : ''}`
                        }
                      >
                        <Icon aria-hidden="true" size={17} strokeWidth={1.8} />
                        <span>{item.label}</span>
                      </NavLink>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </nav>

      <div className="sidebar-footer">
        <span className="footer-mark" aria-hidden="true">F</span>
        <span>Fluidé Homes</span>
        <span className="footer-version">HRM</span>
      </div>
    </aside>
  )
}

function AppShell() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  const { user, logout, hasPermission } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const canReadNotifications = hasPermission('notification:read')
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [liveNotification, setLiveNotification] = useState<{ id: string; title: string; message: string } | null>(null)
  const page = pages.find((item) => item.path === location.pathname) ?? pages[0]
  const isDashboard = location.pathname === '/'
  const displayName = user?.employee
    ? `${user.employee.firstName} ${user.employee.lastName}`
    : user?.email ?? 'Account'

  useEffect(() => {
    if (!canReadNotifications) return
    let active = true
    let isInitialLoad = true
    let knownIds = new Set<string>()

    async function refreshNotifications() {
      try {
        const notifications = await api.get<Array<{ id: string; title: string; message: string; isRead: boolean }>>('/notifications')
        if (!active) return
        setUnreadNotifications(notifications.filter((item) => !item.isRead).length)
        if (!isInitialLoad) {
          const incoming = notifications.find((item) => !knownIds.has(item.id) && !item.isRead)
          if (incoming) {
            setLiveNotification(incoming)
            window.setTimeout(() => setLiveNotification((current) => current?.id === incoming.id ? null : current), 8000)
          }
        }
        knownIds = new Set(notifications.map((item) => item.id))
        isInitialLoad = false
      } catch {
        // The notification center reports fetch errors when opened.
      }
    }

    void refreshNotifications()
    const timer = window.setInterval(() => void refreshNotifications(), 15000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [canReadNotifications])

  function toggleTheme() {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }

  async function handleLogout() {
    try {
      await logout()
      navigate('/login', { replace: true })
    } catch {
      navigate('/login', {
        replace: true,
        state: { notice: 'You were signed out on this device, but the server could not confirm session revocation.' },
      })
    }
  }

  return (
    <div className="app-shell" data-theme={theme}>
      <div
        className={`sidebar-scrim${isMenuOpen ? ' is-visible' : ''}`}
        onClick={() => setIsMenuOpen(false)}
        aria-hidden="true"
      />
      <div className={`sidebar-frame${isMenuOpen ? ' is-open' : ''}`}>
        <Sidebar theme={theme} onNavigate={() => setIsMenuOpen(false)} />
      </div>

      <main className="main-area">
        <header className="topbar">
          <button
            className="mobile-menu-button"
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            aria-label={isMenuOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={isMenuOpen}
          >
            {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <span className="topbar-title">Human Resources</span>
          <span className="topbar-context">Fluidé Homes</span>
          <div className="topbar-account">
            {user?.employee && <EmployeeAvatar className="topbar-avatar" photo={user.employee.profilePhoto} name={displayName} />}
            <span className="account-name">{displayName}</span>
            {canReadNotifications && (
              <button className="app-notification-button" type="button" onClick={() => navigate('/notifications')} aria-label={`Notifications${unreadNotifications ? `, ${unreadNotifications} unread` : ''}`} title="Notifications">
                <Bell size={17} aria-hidden="true" />
                {unreadNotifications > 0 && <span>{unreadNotifications > 9 ? '9+' : unreadNotifications}</span>}
              </button>
            )}
            <button
              className="theme-toggle"
              type="button"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              aria-pressed={theme === 'dark'}
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}
              <span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
            </button>
            <button className="sign-out-button" type="button" onClick={() => void handleLogout()} aria-label="Sign out">
              <LogOut size={16} aria-hidden="true" />
              <span>Sign out</span>
            </button>
          </div>
        </header>

        <div className="page-content">
          <div className="breadcrumb">
            <span>Fluidé Homes</span>
            <ChevronRight size={14} aria-hidden="true" />
            <span className="breadcrumb-current">{page.label}</span>
          </div>

          <div className="page-heading">
            <div>
              <p className="eyebrow">{isDashboard ? 'PEOPLE OPERATIONS' : 'HR MANAGEMENT'}</p>
              <h1>{page.label}</h1>
              <p className="page-description">
                {isDashboard
                  ? 'A considered workspace for your people and operations.'
                  : `The ${page.label.toLowerCase()} workspace for Fluidé Homes.`}
              </p>
            </div>
          </div>

          <Outlet />
        </div>
        {liveNotification && (
          <button className="app-notification-toast" type="button" onClick={() => { setLiveNotification(null); navigate('/notifications') }}>
            <span className="app-notification-toast-icon"><Bell size={16} aria-hidden="true" /></span>
            <span><strong>{liveNotification.title}</strong><small>{liveNotification.message}</small></span>
            <X size={15} aria-hidden="true" />
          </button>
        )}
      </main>
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route element={<PublicOnly />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="employees" element={<EmployeesPage />} />
          <Route path="my-information" element={<MyPersonalInformationPage />} />
          <Route path="departments" element={<DepartmentsPage />} />
          <Route path="positions" element={<PositionsPage />} />
          <Route path="organogram" element={<OrganogramPage />} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="leaves" element={<LeavePage />} />
          <Route path="appraisals" element={<AppraisalsPage />} />
          <Route path="celebrations" element={<CelebrationsPage />} />
          <Route path="policy" element={<HandbookPage />} />
          <Route path="handbook" element={<Navigate to="/policy" replace />} />
          <Route path="collaboration" element={<CollaborationPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="roles" element={<RolesPage />} />
          <Route path="audit-logs" element={<AuditLogsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
