export interface AuthUser {
  id: string
  name: string
  email: string
  role: string
  type: "user" | "admin"
  companyId?: string
}

const TOKEN_KEY = "zv_token"
const USER_KEY = "zv_user"
const AUTH_CHANGED_EVENT = "zapvendas:auth-changed"
const SESSION_EXPIRED_NOTICE_KEY = "zapvendas:session-expired"

type JwtPayload = {
  exp?: number
}

function emitAuthChanged() {
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT))
}

function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const payload = token.split(".")[1]
    if (!payload) return null

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/")
    const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), "=")

    return JSON.parse(window.atob(padded)) as JwtPayload
  } catch {
    return null
  }
}

export function isTokenExpired(token: string, skewSeconds = 15) {
  const payload = decodeJwtPayload(token)
  if (!payload?.exp) return true

  return payload.exp * 1000 <= Date.now() + skewSeconds * 1000
}

export function clearStoredAuth() {
  const hadStoredAuth = localStorage.getItem(TOKEN_KEY) !== null || localStorage.getItem(USER_KEY) !== null

  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)

  if (hadStoredAuth) {
    emitAuthChanged()
  }
}

export function storeAuth(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  emitAuthChanged()
}

export function readStoredAuth(): { token: string; user: AuthUser } | null {
  const token = localStorage.getItem(TOKEN_KEY)
  const rawUser = localStorage.getItem(USER_KEY)

  if (!token || !rawUser) {
    clearStoredAuth()
    return null
  }

  if (isTokenExpired(token)) {
    sessionStorage.setItem(SESSION_EXPIRED_NOTICE_KEY, "1")
    clearStoredAuth()
    return null
  }

  try {
    return {
      token,
      user: JSON.parse(rawUser) as AuthUser,
    }
  } catch {
    clearStoredAuth()
    return null
  }
}

export function consumeSessionExpiredNotice() {
  const hasNotice = sessionStorage.getItem(SESSION_EXPIRED_NOTICE_KEY) === "1"
  sessionStorage.removeItem(SESSION_EXPIRED_NOTICE_KEY)
  return hasNotice
}

export function redirectToLogin(reason: "expired" | "invalid" = "expired") {
  clearStoredAuth()

  const nextPath = `${window.location.pathname}${window.location.search}`
  const loginUrl = new URL("/login", window.location.origin)

  loginUrl.searchParams.set(reason, "1")
  if (nextPath && !nextPath.startsWith("/login")) {
    loginUrl.searchParams.set("next", nextPath)
  }

  window.location.href = `${loginUrl.pathname}${loginUrl.search}`
}

export function listenAuthChanges(callback: () => void) {
  window.addEventListener("storage", callback)
  window.addEventListener(AUTH_CHANGED_EVENT, callback)

  return () => {
    window.removeEventListener("storage", callback)
    window.removeEventListener(AUTH_CHANGED_EVENT, callback)
  }
}

export function installAuthFetchInterceptor() {
  if (typeof window === "undefined") return

  const marker = "__zapvendasAuthFetchInstalled"
  const windowWithMarker = window as Window & { [marker]?: boolean }
  if (windowWithMarker[marker]) return

  windowWithMarker[marker] = true

  const nativeFetch = window.fetch.bind(window)

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = typeof input === "string" || input instanceof URL ? input.toString() : input.url
    const url = new URL(requestUrl, window.location.origin)
    const isSameOriginApi = url.origin === window.location.origin && url.pathname.startsWith("/api/")
    const isAuthLogin = url.pathname === "/api/auth/login"
    const isAuthLogout = url.pathname === "/api/auth/logout"

    if (!isSameOriginApi || isAuthLogin) {
      return nativeFetch(input, init)
    }

    const token = localStorage.getItem(TOKEN_KEY)

    if (token && isTokenExpired(token)) {
      redirectToLogin("expired")
      return new Response(JSON.stringify({ error: "Sessão expirada" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`)
    }

    const response = await nativeFetch(input, { ...init, headers })

    if (response.status === 401 && !isAuthLogout) {
      redirectToLogin("expired")
    }

    return response
  }
}
