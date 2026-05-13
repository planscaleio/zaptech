import { useMemo } from "react"

interface AuthUser {
  id: string
  name: string
  email: string
  role: string
  type: "user" | "admin"
  companyId?: string
}

export function useAuth(): AuthUser | null {
  return useMemo(() => {
    try {
      const raw = localStorage.getItem("zv_user")
      if (!raw) return null
      return JSON.parse(raw) as AuthUser
    } catch {
      return null
    }
  }, [])
}
