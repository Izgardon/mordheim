import { useMemo, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";
import { Bell } from "lucide-react";
import { BattleInviteCard, BattleResultRequestCard, TradeRequestCard } from "./NotificationCards";

import type {
  BattleInviteNotification,
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
  onDismissBattleInvite: (notification: BattleInviteNotification) => NotificationAction;
  onAcceptBattleResultRequest: (
    notification: BattleResultRequestNotification
  ) => NotificationAction;
  onDeclineBattleResultRequest: (
    notification: BattleResultRequestNotification
  ) => NotificationAction;
  onClear?: () => void;
  className?: string;
  iconClassName?: string;
  label?: string;
};

export default function NotificationsMenu({
  tradeRequestNotifications,
  battleInviteNotifications,
  battleResultRequestNotifications,
  onAcceptTrade,
  onDeclineTrade,
  onAcceptBattleInvite,
  onDismissBattleInvite,
  onAcceptBattleResultRequest,
  onDeclineBattleResultRequest,
  onClear,
  className,
  iconClassName,
  label,
}: NotificationsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const unreadCount =
    tradeRequestNotifications.length +
    battleInviteNotifications.length +
    battleResultRequestNotifications.length;
  const hasNotifications = unreadCount > 0;

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

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    setFailure(null);
  };

  // The menu closes only once the action has gone through; a failure stays visible on its card.
  const runAction = async (id: string, action: () => NotificationAction) => {
    setPendingId(id);
    setFailure(null);
    try {
      await action();
      setIsOpen(false);
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
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            "icon-button relative flex h-9 w-9 items-center justify-center border-none bg-transparent p-0",
            className
          )}
          aria-label={label ?? "Notifications"}
        >
          <Bell className={cn("theme-heading-soft h-5 w-5", iconClassName)} aria-hidden="true" />
          {hasNotifications ? (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary px-1 text-[0.55rem] font-semibold text-primary-foreground">
              {unreadCount}
            </span>
          ) : null}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[32rem]">
        <DialogHeader className="items-start text-left">
          <div className="flex w-full items-center justify-between gap-3">
            <DialogTitle>Notifications</DialogTitle>
            {onClear ? (
              <button
                type="button"
                onClick={handleClear}
                disabled={!hasNotifications}
                className="text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-muted-foreground transition hover:text-foreground disabled:opacity-50"
              >
                Clear
              </button>
            ) : null}
          </div>
        </DialogHeader>
        {sortedTradeNotifications.length === 0 &&
        sortedBattleInvites.length === 0 &&
        sortedBattleResultRequests.length === 0 ? (
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
            {sortedBattleInvites.map((notification) => (
              <BattleInviteCard
                key={notification.id}
                notification={notification}
                state={cardState(notification.id)}
                onAccept={() =>
                  void runAction(notification.id, () => onAcceptBattleInvite(notification))
                }
                onDecline={() =>
                  void runAction(notification.id, () => onDismissBattleInvite(notification))
                }
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
      </DialogContent>
    </Dialog>
  );
}
