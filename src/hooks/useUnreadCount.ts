import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/hooks/useAuth"

export const CONV_READ_EVENT = "conv:read"

export function useUnreadCount() {
  const auth = useAuth()
  const companyId = auth?.companyId
  const [count, setCount] = useState(0)

  const refresh = useCallback(() => {
    if (!companyId) return
    fetch(`/api/conversations/unread-count?companyId=${companyId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d: { count: number } | null) => { if (d) setCount(d.count) })
      .catch(() => {})
  }, [companyId])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 15_000)
    // Refresh immediately whenever a conversation is marked as read
    window.addEventListener(CONV_READ_EVENT, refresh)
    return () => {
      clearInterval(id)
      window.removeEventListener(CONV_READ_EVENT, refresh)
    }
  }, [refresh])

  return { count, refresh }
}
