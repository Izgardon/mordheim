import { useMemo, useState, type ReactNode } from "react";

import { Slot } from "@radix-ui/react-slot";

import { SidePanel } from "@/components/ui/side-panel";
import { getErrorMessage } from "@/lib/get-error-message";
import {
  BattleInviteCard,
  BattleNudgeCard,
  BattleResultRequestCard,
  TradeRequestCard,
} from "./NotificationCards";

import type {
  BattleInviteNotification,
  BattleNudgeNotification,
  BattleResultRequestNotification,
} from "@/features/battles/types/battle-types";
import type { TradeNotification } from "@/features/warbands/types/trade-request-types";

type NotificationAction = Promise<void> | void;

const byNewest = <T extends { createdAt: string }>(items: T[]) =>
  [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

type NotificationsMenuProps = {
  tradeRequestNotifications: TradeNotification[];
  battleInviteNotifications: BattleInviteNotification[];
  battleResultRequestNotifications: BattleResultRequestNotification[];
  onAcceptTrade: (notification: TradeNotification) => NotificationAction;
  onDeclineTrade: (notification: TradeNotification) => NotificationAction;
  onAcceptBattleInvite: (notification: BattleInviteNotification) => NotificationAction;
  onDeclineBattleInvite: (notification: BattleInviteNotification) => NotificationAction;
  onAcceptBattleResultRequest: (
    notification: BattleResultRequestNotification
  ) => NotificationAction;
  onDeclineBattleResultRequest: (
    notification: BattleResultRequestNotification
  ) => NotificationAction;
  /** Nudges from other players (BATL-NEW-08): go to the battle, or dismiss. */
  battleNudgeNotifications?: BattleNudgeNotification[];
  onGoToNudge?: (notification: BattleNudgeNotification) => NotificationAction;
  onDismissNudge?: (notification: BattleNudgeNotification) => NotificationAction;
  onClear?: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The button that opens it, given the count (the shell owns the open state). */
  trigger?: (count: number) => ReactNode;
};

export default function NotificationsMenu({
  tradeRequestNotifications,
  battleInviteNotifications,
  battleResultRequestNotifications,
  onAcceptTrade,
  onDeclineTrade,
  onAcceptBattleInvite,
  onDeclineBattleInvite,
  onAcceptBattleResultRequest,
  onDeclineBattleResultRequest,
  battleNudgeNotifications = [],
  onGoToNudge,
  onDismissNudge,
  onClear,
  open,
  onOpenChange,
  trigger,
}: NotificationsMenuProps) {
  const unreadCount =
    tradeRequestNotifications.length +
    battleInviteNotifications.length +
    battleResultRequestNotifications.length +
    battleNudgeNotifications.length;

  const sortedTradeNotifications = useMemo(
    () => byNewest(tradeRequestNotifications),
    [tradeRequestNotifications]
  );
  const sortedBattleInvites = useMemo(
    () => byNewest(battleInviteNotifications),
    [battleInviteNotifications]
  );
  const sortedBattleResultRequests = useMemo(
    () => byNewest(battleResultRequestNotifications),
    [battleResultRequestNotifications]
  );

  const [pendingId, setPendingId] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ id: string; message: string } | null>(null);

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    setFailure(null);
  };

  // The menu closes only once the action has gone through; a failure stays visible on its card.
  const runAction = async (id: string, action: () => NotificationAction) => {
    setPendingId(id);
    setFailure(null);
    try {
      await action();
      onOpenChange(false);
    } catch (error) {
      setFailure({
        id,
        message: getErrorMessage(error, "That didn't go through. Please try again."),
      });
    } finally {
      setPendingId(null);
    }
  };

  const cardState = (id: string) => ({
    isPending: pendingId === id,
    error: failure?.id === id ? failure.message : undefined,
  });

  const handleClear = () => {
    onClear?.();
    onOpenChange(false);
  };

  return (
    <>
      {trigger ? <Slot onClick={() => handleOpenChange(true)}>{trigger(unreadCount)}</Slot> : null}
      <SidePanel
        open={open}
        onOpenChange={handleOpenChange}
        kicker="Campaign"
        title="Notifications"
        description="Battle invites, battle results waiting for your answer, and trade requests."
        actions={
          onClear ? (
            <button
              type="button"
              onClick={handleClear}
              disabled={unreadCount === 0}
              className="text-xs font-bold text-muted-foreground transition hover:text-head disabled:opacity-50"
            >
              Clear
            </button>
          ) : null
        }
      >
        {unreadCount === 0 ? (
          <p className="text-sm text-muted-foreground">You are all caught up.</p>
        ) : (
          <div className="space-y-3">
            {sortedBattleResultRequests.map((notification) => (
              <BattleResultRequestCard
                key={notification.id}
                notification={notification}
                state={cardState(notification.id)}
                onAccept={() =>
                  void runAction(notification.id, () => onAcceptBattleResultRequest(notification))
                }
                onDecline={() =>
                  void runAction(notification.id, () => onDeclineBattleResultRequest(notification))
                }
              />
            ))}
            {byNewest(battleNudgeNotifications).map((notification) => (
              <BattleNudgeCard
                key={notification.id}
                notification={notification}
                state={cardState(notification.id)}
                onAccept={() => void runAction(notification.id, () => onGoToNudge?.(notification))}
                onDecline={() =>
                  void runAction(notification.id, () => onDismissNudge?.(notification))
                }
              />
            ))}
            {sortedBattleInvites.map((notification) => (
              <BattleInviteCard
                key={notification.id}
                notification={notification}
                state={cardState(notification.id)}
                onAccept={() =>
                  void runAction(notification.id, () => onAcceptBattleInvite(notification))
                }
                onDecline={() =>
                  void runAction(notification.id, () => onDeclineBattleInvite(notification))
                }
                onNavigate={() => onOpenChange(false)}
              />
            ))}
            {sortedTradeNotifications.map((notification) => (
              <TradeRequestCard
                key={notification.id}
                notification={notification}
                state={cardState(notification.id)}
                onAccept={() => void runAction(notification.id, () => onAcceptTrade(notification))}
                onDecline={() =>
                  void runAction(notification.id, () => onDeclineTrade(notification))
                }
              />
            ))}
          </div>
        )}
      </SidePanel>
    </>
  );
}
