import type { PropsWithChildren } from "react"
import { createContext, useCallback, useContext, useMemo, useState } from "react"

// hooks
import { useAuth } from "@/features/auth/hooks/use-auth"

// types
import type { AuthUser } from "@/features/auth/types/auth-types"
import type { Item, ItemProperty } from "@/features/items/types/item-types"
import type { Skill } from "@/features/skills/types/skill-types"
import type { Spell } from "@/features/spells/types/spell-types"
import type { Warband } from "@/features/warbands/types/warband-types"
import type { TradeNotification, TradeSession } from "@/features/warbands/types/trade-request-types"
import type { BattleInviteNotification } from "@/features/battles/types/battle-types"

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
  tradeRequestNotifications: TradeNotification[]
  battleInviteNotifications: BattleInviteNotification[]
  tradeSession: TradeSession | null
  skillsCache: Record<string, CacheEntry<Skill> | undefined>
  spellsCache: Record<string, CacheEntry<Spell> | undefined>
  itemsCache: Record<string, CacheEntry<Item> | undefined>
  itemPropertiesCache: Record<string, CacheEntry<ItemProperty> | undefined>
  setWarband: (warband: Warband | null) => void
  setWarbandLoading: (loading: boolean) => void
  setWarbandError: (error: string) => void
  setCampaignStarted: (started: boolean) => void
  addTradeRequestNotification: (notification: TradeNotification) => void
  removeTradeRequestNotification: (notificationId: string) => void
  clearTradeRequestNotifications: () => void
  addBattleInviteNotification: (notification: BattleInviteNotification) => void
  removeBattleInviteNotification: (notificationId: string) => void
  clearBattleInviteNotifications: () => void
  setTradeSession: (session: TradeSession | null) => void
  setSkillsCache: (campaignKey: string, skills: Skill[]) => void
  upsertSkillCache: (campaignKey: string, skill: Skill) => void
  removeSkillCache: (campaignKey: string, skillId: number) => void
  setSpellsCache: (campaignKey: string, spells: Spell[]) => void
  upsertSpellCache: (campaignKey: string, spell: Spell) => void
  removeSpellCache: (campaignKey: string, spellId: number) => void
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
  const [tradeRequestNotifications, setTradeRequestNotifications] = useState<TradeNotification[]>([])
  const [battleInviteNotifications, setBattleInviteNotifications] = useState<
    BattleInviteNotification[]
  >([])
  const [tradeSession, setTradeSessionState] = useState<TradeSession | null>(null)
  const [skillsCache, setSkillsCacheState] = useState<
    Record<string, CacheEntry<Skill> | undefined>
  >({})
  const [spellsCache, setSpellsCacheState] = useState<
    Record<string, CacheEntry<Spell> | undefined>
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

  const setSpellsCache = useCallback((campaignKey: string, spells: Spell[]) => {
    setSpellsCacheState((prev) => ({
      ...prev,
      [campaignKey]: { data: spells, loaded: true },
    }))
  }, [])

  const upsertSpellCache = useCallback((campaignKey: string, spell: Spell) => {
    setSpellsCacheState((prev) => {
      const entry = prev[campaignKey]
      if (!entry?.loaded) {
        return prev
      }
      const index = entry.data.findIndex((existing) => existing.id === spell.id)
      const next = index >= 0
        ? entry.data.map((existing) => (existing.id === spell.id ? spell : existing))
        : [spell, ...entry.data]
      return { ...prev, [campaignKey]: { data: next, loaded: true } }
    })
  }, [])

  const removeSpellCache = useCallback((campaignKey: string, spellId: number) => {
    setSpellsCacheState((prev) => {
      const entry = prev[campaignKey]
      if (!entry?.loaded) {
        return prev
      }
      return {
        ...prev,
        [campaignKey]: { data: entry.data.filter((spell) => spell.id !== spellId), loaded: true },
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

  const addTradeRequestNotification = useCallback((notification: TradeNotification) => {
    setTradeRequestNotifications((prev) => {
      if (prev.some((existing) => existing.id === notification.id)) {
        return prev
      }
      return [notification, ...prev]
    })
  }, [])

  const removeTradeRequestNotification = useCallback((notificationId: string) => {
    setTradeRequestNotifications((prev) => prev.filter((entry) => entry.id !== notificationId))
  }, [])

  const clearTradeRequestNotifications = useCallback(() => {
    setTradeRequestNotifications([])
  }, [])

  const addBattleInviteNotification = useCallback((notification: BattleInviteNotification) => {
    setBattleInviteNotifications((prev) => {
      const index = prev.findIndex((existing) => existing.id === notification.id)
      if (index >= 0) {
        return prev.map((existing) =>
          existing.id === notification.id ? { ...existing, ...notification } : existing
        )
      }
      return [notification, ...prev]
    })
  }, [])

  const removeBattleInviteNotification = useCallback((notificationId: string) => {
    setBattleInviteNotifications((prev) => prev.filter((entry) => entry.id !== notificationId))
  }, [])

  const clearBattleInviteNotifications = useCallback(() => {
    setBattleInviteNotifications([])
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
      tradeRequestNotifications,
      battleInviteNotifications,
      tradeSession,
      skillsCache,
      spellsCache,
      itemsCache,
      itemPropertiesCache,
      setWarband,
      setWarbandLoading,
      setWarbandError,
      setCampaignStarted,
      addTradeRequestNotification,
      removeTradeRequestNotification,
      clearTradeRequestNotifications,
      addBattleInviteNotification,
      removeBattleInviteNotification,
      clearBattleInviteNotifications,
      setTradeSession,
      setSkillsCache,
      upsertSkillCache,
      removeSkillCache,
      setSpellsCache,
      upsertSpellCache,
      removeSpellCache,
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
      tradeRequestNotifications,
      battleInviteNotifications,
      tradeSession,
      skillsCache,
      spellsCache,
      itemsCache,
      itemPropertiesCache,
      setSkillsCache,
      upsertSkillCache,
      removeSkillCache,
      setSpellsCache,
      upsertSpellCache,
      removeSpellCache,
      addTradeRequestNotification,
      removeTradeRequestNotification,
      clearTradeRequestNotifications,
      addBattleInviteNotification,
      removeBattleInviteNotification,
      clearBattleInviteNotifications,
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
