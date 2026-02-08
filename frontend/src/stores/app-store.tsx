import type { PropsWithChildren } from "react"
import { createContext, useContext, useMemo, useState } from "react"

// hooks
import { useAuth } from "@/features/auth/hooks/use-auth"

// types
import type { AuthUser } from "@/features/auth/types/auth-types"
import type { Warband } from "@/features/warbands/types/warband-types"

const DEFAULT_DICE_COLOR = "#2e8555"

type AppStoreValue = {
  user: AuthUser | null
  warband: Warband | null
  diceColor: string
  warbandLoading: boolean
  warbandError: string
  campaignStarted: boolean
  setWarband: (warband: Warband | null) => void
  setWarbandLoading: (loading: boolean) => void
  setWarbandError: (error: string) => void
  setCampaignStarted: (started: boolean) => void
}

const AppStoreContext = createContext<AppStoreValue | null>(null)

export function AppStoreProvider({ children }: PropsWithChildren) {
  const { user } = useAuth()
  const [warband, setWarband] = useState<Warband | null>(null)
  const [warbandLoading, setWarbandLoading] = useState(false)
  const [warbandError, setWarbandError] = useState("")
  const [campaignStarted, setCampaignStarted] = useState(false)

  const diceColor = useMemo(
    () => warband?.dice_color ?? DEFAULT_DICE_COLOR,
    [warband?.dice_color]
  )

  const value = useMemo<AppStoreValue>(
    () => ({
      user,
      warband,
      diceColor,
      warbandLoading,
      warbandError,
      campaignStarted,
      setWarband,
      setWarbandLoading,
      setWarbandError,
      setCampaignStarted,
    }),
    [user, warband, diceColor, warbandLoading, warbandError, campaignStarted]
  )

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>
}

export function useAppStore() {
  const context = useContext(AppStoreContext)
  if (!context) {
    throw new Error("useAppStore must be used within AppStoreProvider")
  }
  return context
}
