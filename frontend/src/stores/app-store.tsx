import type { PropsWithChildren } from "react"
import { createContext, useCallback, useContext, useMemo, useState } from "react"

// hooks
import { useAuth } from "@/features/auth/hooks/use-auth"

// types
import type { AuthUser } from "@/features/auth/types/auth-types"
import type { Item, ItemProperty } from "@/features/items/types/item-types"
import type { Skill } from "@/features/skills/types/skill-types"
import type { Warband } from "@/features/warbands/types/warband-types"
import type { TradeNotification, TradeSession } from "@/features/warbands/types/trade-request-types"

const DEFAULT_DICE_COLOR = "#2e8555"

type CacheEntry<T> = {
  data: T[]
  loaded: boolean
}

type AppStoreValue = {
  user: AuthUser | null
  warband: Warband | null
  diceColor: string
  warbandLoading: boolean
  warbandError: string
  campaignStarted: boolean
  tradeNotifications: TradeNotification[]
  tradeSession: TradeSession | null
  skillsCache: Record<string, CacheEntry<Skill> | undefined>
  itemsCache: Record<string, CacheEntry<Item> | undefined>
  itemPropertiesCache: Record<string, CacheEntry<ItemProperty> | undefined>
  setWarband: (warband: Warband | null) => void
  setWarbandLoading: (loading: boolean) => void
  setWarbandError: (error: string) => void
  setCampaignStarted: (started: boolean) => void
  addTradeNotification: (notification: TradeNotification) => void
  removeTradeNotification: (notificationId: string) => void
  clearTradeNotifications: () => void
  setTradeSession: (session: TradeSession | null) => void
  setSkillsCache: (campaignKey: string, skills: Skill[]) => void
  upsertSkillCache: (campaignKey: string, skill: Skill) => void
  removeSkillCache: (campaignKey: string, skillId: number) => void
  setItemsCache: (campaignKey: string, items: Item[]) => void
  upsertItemCache: (campaignKey: string, item: Item) => void
  removeItemCache: (campaignKey: string, itemId: number) => void
  setItemPropertiesCache: (campaignKey: string, properties: ItemProperty[]) => void
  upsertItemPropertyCache: (campaignKey: string, property: ItemProperty) => void
}

const AppStoreContext = createContext<AppStoreValue | null>(null)

export function AppStoreProvider({ children }: PropsWithChildren) {
  const { user } = useAuth()
  const [warband, setWarband] = useState<Warband | null>(null)
  const [warbandLoading, setWarbandLoading] = useState(false)
  const [warbandError, setWarbandError] = useState("")
  const [campaignStarted, setCampaignStarted] = useState(false)
  const [tradeNotifications, setTradeNotifications] = useState<TradeNotification[]>([])
  const [tradeSession, setTradeSessionState] = useState<TradeSession | null>(null)
  const [skillsCache, setSkillsCacheState] = useState<
    Record<string, CacheEntry<Skill> | undefined>
  >({})
  const [itemsCache, setItemsCacheState] = useState<
    Record<string, CacheEntry<Item> | undefined>
  >({})
  const [itemPropertiesCache, setItemPropertiesCacheState] = useState<
    Record<string, CacheEntry<ItemProperty> | undefined>
  >({})

  const diceColor = useMemo(
    () => warband?.dice_color ?? DEFAULT_DICE_COLOR,
    [warband?.dice_color]
  )

  const setSkillsCache = useCallback((campaignKey: string, skills: Skill[]) => {
    setSkillsCacheState((prev) => ({
      ...prev,
      [campaignKey]: { data: skills, loaded: true },
    }))
  }, [])

  const upsertSkillCache = useCallback((campaignKey: string, skill: Skill) => {
    setSkillsCacheState((prev) => {
      const entry = prev[campaignKey]
      if (!entry?.loaded) {
        return prev
      }
      const index = entry.data.findIndex((existing) => existing.id === skill.id)
      const next = index >= 0
        ? entry.data.map((existing) => (existing.id === skill.id ? skill : existing))
        : [skill, ...entry.data]
      return {
        ...prev,
        [campaignKey]: { data: next, loaded: true },
      }
    })
  }, [])

  const removeSkillCache = useCallback((campaignKey: string, skillId: number) => {
    setSkillsCacheState((prev) => {
      const entry = prev[campaignKey]
      if (!entry?.loaded) {
        return prev
      }
      return {
        ...prev,
        [campaignKey]: {
          data: entry.data.filter((skill) => skill.id !== skillId),
          loaded: true,
        },
      }
    })
  }, [])

  const setItemsCache = useCallback((campaignKey: string, items: Item[]) => {
    setItemsCacheState((prev) => ({
      ...prev,
      [campaignKey]: { data: items, loaded: true },
    }))
  }, [])

  const upsertItemCache = useCallback((campaignKey: string, item: Item) => {
    setItemsCacheState((prev) => {
      const entry = prev[campaignKey]
      if (!entry?.loaded) {
        return prev
      }
      const index = entry.data.findIndex((existing) => existing.id === item.id)
      const next = index >= 0
        ? entry.data.map((existing) => (existing.id === item.id ? item : existing))
        : [item, ...entry.data]
      return {
        ...prev,
        [campaignKey]: { data: next, loaded: true },
      }
    })
  }, [])

  const removeItemCache = useCallback((campaignKey: string, itemId: number) => {
    setItemsCacheState((prev) => {
      const entry = prev[campaignKey]
      if (!entry?.loaded) {
        return prev
      }
      return {
        ...prev,
        [campaignKey]: {
          data: entry.data.filter((item) => item.id !== itemId),
          loaded: true,
        },
      }
    })
  }, [])

  const setItemPropertiesCache = useCallback(
    (campaignKey: string, properties: ItemProperty[]) => {
      setItemPropertiesCacheState((prev) => ({
        ...prev,
        [campaignKey]: { data: properties, loaded: true },
      }))
    },
    []
  )

  const upsertItemPropertyCache = useCallback(
    (campaignKey: string, property: ItemProperty) => {
      setItemPropertiesCacheState((prev) => {
        const entry = prev[campaignKey]
        if (!entry?.loaded) {
          return prev
        }
        const index = entry.data.findIndex((existing) => existing.id === property.id)
        const next = index >= 0
          ? entry.data.map((existing) => (existing.id === property.id ? property : existing))
          : [property, ...entry.data]
        return {
          ...prev,
          [campaignKey]: { data: next, loaded: true },
        }
      })
    },
    []
  )

  const addTradeNotification = useCallback((notification: TradeNotification) => {
    setTradeNotifications((prev) => {
      if (prev.some((existing) => existing.id === notification.id)) {
        return prev
      }
      return [notification, ...prev]
    })
  }, [])

  const removeTradeNotification = useCallback((notificationId: string) => {
    setTradeNotifications((prev) => prev.filter((entry) => entry.id !== notificationId))
  }, [])

  const clearTradeNotifications = useCallback(() => {
    setTradeNotifications([])
  }, [])

  const setTradeSession = useCallback((session: TradeSession | null) => {
    setTradeSessionState(session)
  }, [])

  const value = useMemo<AppStoreValue>(
    () => ({
      user,
      warband,
      diceColor,
      warbandLoading,
      warbandError,
      campaignStarted,
      tradeNotifications,
      tradeSession,
      skillsCache,
      itemsCache,
      itemPropertiesCache,
      setWarband,
      setWarbandLoading,
      setWarbandError,
      setCampaignStarted,
      addTradeNotification,
      removeTradeNotification,
      clearTradeNotifications,
      setTradeSession,
      setSkillsCache,
      upsertSkillCache,
      removeSkillCache,
      setItemsCache,
      upsertItemCache,
      removeItemCache,
      setItemPropertiesCache,
      upsertItemPropertyCache,
    }),
    [
      user,
      warband,
      diceColor,
      warbandLoading,
      warbandError,
      campaignStarted,
      tradeNotifications,
      tradeSession,
      skillsCache,
      itemsCache,
      itemPropertiesCache,
      setSkillsCache,
      upsertSkillCache,
      removeSkillCache,
      addTradeNotification,
      removeTradeNotification,
      clearTradeNotifications,
      setTradeSession,
      setItemsCache,
      upsertItemCache,
      removeItemCache,
      setItemPropertiesCache,
      upsertItemPropertyCache,
    ]
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
