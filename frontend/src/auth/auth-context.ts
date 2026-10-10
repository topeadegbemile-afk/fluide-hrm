import { createContext } from 'react'

export type CurrentUser = {
  id: string
  email: string
  status: string
  employee: {
    id: string
    employeeNumber: string
    firstName: string
    middleName: string | null
    lastName: string
    email: string
    phone: string | null
    profilePhoto: string | null
    employmentStatus: string
    dateJoined: string
    department: { id: string; name: string } | null
    position: { id: string; title: string } | null
  } | null
  roles: string[]
  permissions: string[]
}

export type AuthContextValue = {
  user: CurrentUser | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
  hasPermission: (permission: string) => boolean
}

export const AuthContext = createContext<AuthContextValue | null>(null)
