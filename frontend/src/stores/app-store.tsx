import type { PropsWithChildren } from "react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

// hooks
import { useAuth } from "@/features/auth/hooks/use-auth";

// types
import type { AuthUser } from "@/features/auth/types/auth-types";
import type { Warband } from "@/features/warbands/types/warband-types";
import type { TradeNotification } from "@/features/warbands/types/trade-request-types";
import type {
  BattleInviteNotification,
  BattleNudgeNotification,
  BattleResultRequestNotification,
} from "@/features/battles/types/battle-types";
import type { CurrentBattleSession } from "@/features/battles/utils/battle-session";

const DEFAULT_DICE_COLOR = "#2e8555";

type AppStoreValue = {
  user: AuthUser | null;
  warband: Warband | null;
  diceColor: string;
  warbandLoading: boolean;
  warbandError: string;
  tradeRequestNotifications: TradeNotification[];
  battleInviteNotifications: BattleInviteNotification[];
  battleResultRequestNotifications: BattleResultRequestNotification[];
  battleNudgeNotifications: BattleNudgeNotification[];
  currentBattleSession: CurrentBattleSession | null;
  setWarband: (warband: Warband | null) => void;
  setWarbandLoading: (loading: boolean) => void;
  setWarbandError: (error: string) => void;
  addTradeRequestNotification: (notification: TradeNotification) => void;
  removeTradeRequestNotification: (notificationId: string) => void;
  clearTradeRequestNotifications: () => void;
  addBattleInviteNotification: (notification: BattleInviteNotification) => void;
  removeBattleInviteNotification: (notificationId: string) => void;
  clearBattleInviteNotifications: () => void;
  addBattleResultRequestNotification: (notification: BattleResultRequestNotification) => void;
  removeBattleResultRequestNotification: (notificationId: string) => void;
  clearBattleResultRequestNotifications: () => void;
  addBattleNudgeNotification: (notification: BattleNudgeNotification) => void;
  removeBattleNudgeNotification: (notificationId: string) => void;
  clearBattleNudgeNotifications: () => void;
  setCurrentBattleSession: (session: CurrentBattleSession | null) => void;
  clearCurrentBattleSession: () => void;
};

const AppStoreContext = createContext<AppStoreValue | null>(null);

export function AppStoreProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const [warband, setWarband] = useState<Warband | null>(null);
  const [warbandLoading, setWarbandLoading] = useState(false);
  const [warbandError, setWarbandError] = useState("");
  const [tradeRequestNotifications, setTradeRequestNotifications] = useState<TradeNotification[]>(
    []
  );
  const [battleInviteNotifications, setBattleInviteNotifications] = useState<
    BattleInviteNotification[]
  >([]);
  const [battleResultRequestNotifications, setBattleResultRequestNotifications] = useState<
    BattleResultRequestNotification[]
  >([]);
  const [currentBattleSession, setCurrentBattleSessionState] =
    useState<CurrentBattleSession | null>(null);
  // Nudges (BATL-NEW-08): one per battle, the newest replacing an older one.
  const [battleNudgeNotifications, setBattleNudgeNotifications] = useState<
    BattleNudgeNotification[]
  >([]);

  // When the signed-in user changes (sign-out, expiry, another account), drop the previous
  // user's session state before anything renders with it (BUG-22). Done during render, the
  // React way to reset state when an input changes, so children never see the stale values.
  const userId = user?.id ?? null;
  const [sessionUserId, setSessionUserId] = useState(userId);
  if (sessionUserId !== userId) {
    setSessionUserId(userId);
    if (sessionUserId !== null) {
      setWarband(null);
      setWarbandLoading(false);
      setWarbandError("");
      setTradeRequestNotifications([]);
      setBattleInviteNotifications([]);
      setBattleResultRequestNotifications([]);
      setBattleNudgeNotifications([]);
      setCurrentBattleSessionState(null);
    }
  }

  const diceColor = useMemo(() => warband?.dice_color ?? DEFAULT_DICE_COLOR, [warband?.dice_color]);

  const addTradeRequestNotification = useCallback((notification: TradeNotification) => {
    setTradeRequestNotifications((prev) => {
      if (prev.some((existing) => existing.id === notification.id)) {
        return prev;
      }
      return [notification, ...prev];
    });
  }, []);

  const removeTradeRequestNotification = useCallback((notificationId: string) => {
    setTradeRequestNotifications((prev) => prev.filter((entry) => entry.id !== notificationId));
  }, []);

  const clearTradeRequestNotifications = useCallback(() => {
    setTradeRequestNotifications([]);
  }, []);

  const addBattleInviteNotification = useCallback((notification: BattleInviteNotification) => {
    setBattleInviteNotifications((prev) => {
      const index = prev.findIndex((existing) => existing.id === notification.id);
      if (index >= 0) {
        return prev.map((existing) =>
          existing.id === notification.id ? { ...existing, ...notification } : existing
        );
      }
      return [notification, ...prev];
    });
  }, []);

  const removeBattleInviteNotification = useCallback((notificationId: string) => {
    setBattleInviteNotifications((prev) => prev.filter((entry) => entry.id !== notificationId));
  }, []);

  const clearBattleInviteNotifications = useCallback(() => {
    setBattleInviteNotifications([]);
  }, []);

  const addBattleResultRequestNotification = useCallback(
    (notification: BattleResultRequestNotification) => {
      setBattleResultRequestNotifications((prev) => {
        const index = prev.findIndex((existing) => existing.id === notification.id);
        if (index >= 0) {
          return prev.map((existing) =>
            existing.id === notification.id ? { ...existing, ...notification } : existing
          );
        }
        return [notification, ...prev];
      });
    },
    []
  );

  const removeBattleResultRequestNotification = useCallback((notificationId: string) => {
    setBattleResultRequestNotifications((prev) =>
      prev.filter((entry) => entry.id !== notificationId)
    );
  }, []);

  const clearBattleResultRequestNotifications = useCallback(() => {
    setBattleResultRequestNotifications([]);
  }, []);

  const addBattleNudgeNotification = useCallback((notification: BattleNudgeNotification) => {
    setBattleNudgeNotifications((prev) => [
      notification,
      ...prev.filter((entry) => entry.battleId !== notification.battleId),
    ]);
  }, []);
  const removeBattleNudgeNotification = useCallback((notificationId: string) => {
    setBattleNudgeNotifications((prev) => prev.filter((entry) => entry.id !== notificationId));
  }, []);
  const clearBattleNudgeNotifications = useCallback(() => setBattleNudgeNotifications([]), []);

  const setCurrentBattleSession = useCallback((session: CurrentBattleSession | null) => {
    setCurrentBattleSessionState(session);
  }, []);

  const clearCurrentBattleSession = useCallback(() => {
    setCurrentBattleSessionState(null);
  }, []);

  const value = useMemo<AppStoreValue>(
    () => ({
      user,
      warband,
      diceColor,
      warbandLoading,
      warbandError,
      tradeRequestNotifications,
      battleInviteNotifications,
      battleResultRequestNotifications,
      battleNudgeNotifications,
      currentBattleSession,
      setWarband,
      setWarbandLoading,
      setWarbandError,
      addTradeRequestNotification,
      removeTradeRequestNotification,
      clearTradeRequestNotifications,
      addBattleInviteNotification,
      removeBattleInviteNotification,
      clearBattleInviteNotifications,
      addBattleResultRequestNotification,
      removeBattleResultRequestNotification,
      clearBattleResultRequestNotifications,
      addBattleNudgeNotification,
      removeBattleNudgeNotification,
      clearBattleNudgeNotifications,
      setCurrentBattleSession,
      clearCurrentBattleSession,
    }),
    [
      user,
      warband,
      diceColor,
      warbandLoading,
      warbandError,
      tradeRequestNotifications,
      battleInviteNotifications,
      battleResultRequestNotifications,
      battleNudgeNotifications,
      currentBattleSession,
      addTradeRequestNotification,
      removeTradeRequestNotification,
      clearTradeRequestNotifications,
      addBattleInviteNotification,
      removeBattleInviteNotification,
      clearBattleInviteNotifications,
      addBattleResultRequestNotification,
      removeBattleResultRequestNotification,
      clearBattleResultRequestNotifications,
      addBattleNudgeNotification,
      removeBattleNudgeNotification,
      clearBattleNudgeNotifications,
      setCurrentBattleSession,
      clearCurrentBattleSession,
    ]
  );

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore() {
  const context = useContext(AppStoreContext);
  if (!context) {
    throw new Error("useAppStore must be used within AppStoreProvider");
  }
  return context;
}
