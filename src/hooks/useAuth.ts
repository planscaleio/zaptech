import { useEffect, useState } from "react"
import { listenAuthChanges, readStoredAuth, type AuthUser } from "@/lib/auth"

export function useAuth(): AuthUser | null {
  const [auth, setAuth] = useState<AuthUser | null>(() => readStoredAuth()?.user ?? null)

  useEffect(() => {
    const refreshAuth = () => setAuth(readStoredAuth()?.user ?? null)
    const stopListening = listenAuthChanges(refreshAuth)
    const interval = window.setInterval(refreshAuth, 30_000)

    return () => {
      stopListening()
      window.clearInterval(interval)
    }
  }, [])

  return auth
}
