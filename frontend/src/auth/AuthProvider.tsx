import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { announceSessionReplacement, ApiError, api, session, sessionSignalKey, SESSION_CLEARED_EVENT, type TokenPair } from '../lib/api'
import { AuthContext, type CurrentUser } from './auth-context'

type LoginResponse = TokenPair & { user: CurrentUser }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [isLoading, setIsLoading] = useState(
    () => Boolean(session.accessToken || session.refreshToken),
  )

  useEffect(() => {
    let active = true

    if (!session.accessToken && !session.refreshToken) {
      return () => {
        active = false
      }
    }

    api
      .get<CurrentUser>('/auth/me')
      .then((currentUser) => {
        if (active) setUser(currentUser)
      })
      .catch(() => {
        session.clear()
        if (active) setUser(null)
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const handleCleared = () => setUser(null)
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== sessionSignalKey() || !event.newValue || !user) return
      const replacedUserId = event.newValue.slice(0, event.newValue.lastIndexOf(':'))
      if (replacedUserId === user.id) {
        session.clear()
        setUser(null)
      }
    }
    window.addEventListener(SESSION_CLEARED_EVENT, handleCleared)
    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener(SESSION_CLEARED_EVENT, handleCleared)
      window.removeEventListener('storage', handleStorage)
    }
  }, [user])

  useEffect(() => {
    if (!user) return
    let active = true
    const checkSession = async () => {
      try {
        const currentUser = await api.get<CurrentUser>('/auth/me')
        if (!active) return
        setUser((previous) => previous && previous.id === currentUser.id &&
          previous.email === currentUser.email && previous.status === currentUser.status &&
          JSON.stringify(previous.roles) === JSON.stringify(currentUser.roles) &&
          JSON.stringify(previous.permissions) === JSON.stringify(currentUser.permissions) &&
          JSON.stringify(previous.employee) === JSON.stringify(currentUser.employee)
          ? previous
          : currentUser)
      } catch (cause) {
        if (active && cause instanceof ApiError && cause.status === 401) session.clear()
      }
    }
    const timer = window.setInterval(() => void checkSession(), 15000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [user?.id])

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.post<LoginResponse>('/auth/login', { email, password })
    session.set(result)
    setUser(result.user)
    announceSessionReplacement(result.user.id)
  }, [])

  const logout = useCallback(async () => {
    const refreshToken = session.refreshToken
    try {
      if (refreshToken) {
        await api.post<null>('/auth/logout', { refreshToken })
      }
    } finally {
      session.clear()
      setUser(null)
    }
  }, [])

  const refreshUser = useCallback(async () => {
    const currentUser = await api.get<CurrentUser>('/auth/me')
    setUser(currentUser)
  }, [])

  const hasPermission = useCallback(
    (permission: string) => user?.roles.includes('SUPER_ADMIN') === true || (user?.permissions.includes(permission) ?? false),
    [user],
  )

  const value = useMemo(
    () => ({ user, isLoading, login, logout, refreshUser, hasPermission }),
    [user, isLoading, login, logout, refreshUser, hasPermission],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
