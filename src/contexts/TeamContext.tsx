import { createContext, useContext, useState, useEffect, useCallback } from "react"
import { useAuth } from "@/hooks/useAuth"

interface TeamEntry { id: string; name: string }

interface TeamContextValue {
  myTeams: TeamEntry[]
  activeTeamId: string | null
  setActiveTeamId: (id: string | null) => void
}

const TeamContext = createContext<TeamContextValue>({
  myTeams: [],
  activeTeamId: null,
  setActiveTeamId: () => {},
})

const STORAGE_KEY = "zv_active_team"

export function TeamProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth()
  const [myTeams, setMyTeams] = useState<TeamEntry[]>([])
  const [activeTeamId, setActiveTeamIdState] = useState<string | null>(() => {
    try { return localStorage.getItem(STORAGE_KEY) } catch { return null }
  })

  useEffect(() => {
    if (!auth?.companyId || !auth?.id) { setMyTeams([]); return }
    fetch(`/api/teams/my?companyId=${auth.companyId}&userId=${auth.id}`)
      .then((r) => r.json())
      .then((teams: TeamEntry[]) => {
        setMyTeams(teams)
        // If saved teamId no longer valid, clear it
        setActiveTeamIdState((prev) => {
          if (prev && !teams.some((t) => t.id === prev)) {
            localStorage.removeItem(STORAGE_KEY)
            return null
          }
          return prev
        })
      })
      .catch(() => {})
  }, [auth?.companyId, auth?.id])

  const setActiveTeamId = useCallback((id: string | null) => {
    setActiveTeamIdState(id)
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id)
      else localStorage.removeItem(STORAGE_KEY)
    } catch {}
  }, [])

  return (
    <TeamContext.Provider value={{ myTeams, activeTeamId, setActiveTeamId }}>
      {children}
    </TeamContext.Provider>
  )
}

export function useTeam() {
  return useContext(TeamContext)
}
