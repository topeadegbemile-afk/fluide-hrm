import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api, session, type TokenPair } from '../lib/api'
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

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.post<LoginResponse>('/auth/login', { email, password })
    session.set(result)
    setUser(result.user)
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
    (permission: string) => user?.permissions.includes(permission) ?? false,
    [user],
  )

  const value = useMemo(
    () => ({ user, isLoading, login, logout, refreshUser, hasPermission }),
    [user, isLoading, login, logout, refreshUser, hasPermission],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
