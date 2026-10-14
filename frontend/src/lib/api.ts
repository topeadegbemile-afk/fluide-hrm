
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api/v1').replace(/\/+$/, '')
const ACCESS_TOKEN_KEY = 'fluide_hrm_access_token'
const REFRESH_TOKEN_KEY = 'fluide_hrm_refresh_token'
const SESSION_SIGNAL_KEY = 'fluide_hrm_session_replaced'
export const SESSION_CLEARED_EVENT = 'fluide-hrm-session-cleared'

type TokenPair = {
  accessToken: string
  refreshToken: string
}

type ApiEnvelope<T> = {
  success: boolean
  message: string
  data: T
}

export class ApiError extends Error {
  status: number
  code?: string
  details?: unknown

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export const session = {
  get accessToken() {
    return sessionStorage.getItem(ACCESS_TOKEN_KEY) ?? localStorage.getItem(ACCESS_TOKEN_KEY)
  },

  get refreshToken() {
    return sessionStorage.getItem(REFRESH_TOKEN_KEY) ?? localStorage.getItem(REFRESH_TOKEN_KEY)
  },

  set(tokens: TokenPair) {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken)
    sessionStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken)
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
  },

  clear() {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY)
    sessionStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    window.dispatchEvent(new Event(SESSION_CLEARED_EVENT))
  },
}

export function announceSessionReplacement(userId: string) {
  localStorage.setItem(SESSION_SIGNAL_KEY, `${userId}:${Date.now()}`)
}

export function sessionSignalKey() {
  return SESSION_SIGNAL_KEY
}

let refreshInProgress: Promise<boolean> | undefined

function updateTokens(tokens: TokenPair) {
  session.set(tokens)
}

async function refreshSession(): Promise<boolean> {
  const refreshToken = session.refreshToken

  if (!refreshToken) {
    session.clear()
    return false
  }

  if (!refreshInProgress) {
    refreshInProgress = fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
      .then(async (response) => {
        if (!response.ok) {
          session.clear()
          return false
        }

        const result = (await response.json()) as ApiEnvelope<TokenPair>
        updateTokens(result.data)
        return true
      })
      .catch(() => {
        session.clear()
        return false
      })
      .finally(() => {
        refreshInProgress = undefined
      })
  }

  return refreshInProgress
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  allowRefresh = true,
): Promise<T> {
  const headers = new Headers(init.headers)

  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const accessToken = session.accessToken

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  let response: Response

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
      credentials: 'include',
    })
  } catch {
    throw new ApiError(
      'Unable to reach the HRM server. Check the connection and try again.',
      0,
    )
  }

  if (
    response.status === 401 &&
    allowRefresh &&
    !['/auth/login', '/auth/refresh', '/auth/logout'].includes(path)
  ) {
    if (await refreshSession()) {
      return request<T>(path, init, false)
    }

    session.clear()
  }

  const result = (await response.json().catch(() => null)) as
    | (ApiEnvelope<T> & { error?: string; details?: unknown })
    | null

  if (!response.ok || !result?.success) {
    if (response.status === 401 && path === '/auth/me') {
      session.clear()
    }

    throw new ApiError(
      result?.message ?? `Request failed with status ${response.status}`,
      response.status,
      result?.error,
      result?.details,
    )
  }

  return result.data
}

export const api = {
  get: <T>(path: string) => request<T>(path),

  post: <T>(path: string, body: unknown) =>
    request<T>(
      path,
      { method: 'POST', body: JSON.stringify(body) },
      false,
    ),

  patch: <T>(path: string, body: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  put: <T>(path: string, body: unknown) =>
    request<T>(path, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  delete: <T>(path: string) =>
    request<T>(path, { method: 'DELETE' }),

  uploadFile: <T>(path: string, file: File) =>
    request<T>(path, {
      method: 'POST',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'X-File-Name': encodeURIComponent(file.name),
      },
      body: file,
    }),

  download: async (path: string) => {
    const fetchBlob = () =>
      fetch(`${API_BASE_URL}${path}`, {
        credentials: 'include',
        headers: session.accessToken
          ? { Authorization: `Bearer ${session.accessToken}` }
          : {},
      })

    let response = await fetchBlob()

    if (response.status === 401 && await refreshSession()) {
      response = await fetchBlob()
    }

    if (!response.ok) {
      const result = await response.json().catch(() => null) as
        | { message?: string; error?: string }
        | null

      throw new ApiError(
        result?.message ?? `Request failed with status ${response.status}`,
        response.status,
        result?.error,
      )
    }

    return response.blob()
  },
}

export type { ApiEnvelope, TokenPair }
