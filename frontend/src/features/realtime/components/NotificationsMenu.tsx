import { useMemo, useState } from "react";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Bell, Check, X } from "lucide-react";

import type {
  BattleInviteNotification,
  BattleResultRequestNotification,
} from "@/features/battles/types/battle-types";
import type { TradeNotification } from "@/features/warbands/types/trade-request-types";

type NotificationsMenuProps = {
  tradeRequestNotifications: TradeNotification[];
  battleInviteNotifications: BattleInviteNotification[];
  battleResultRequestNotifications: BattleResultRequestNotification[];
  onAcceptTrade: (notification: TradeNotification) => void;
  onDeclineTrade: (notification: TradeNotification) => void;
  onAcceptBattleInvite: (notification: BattleInviteNotification) => void;
  onDismissBattleInvite: (notification: BattleInviteNotification) => void;
  onAcceptBattleResultRequest: (notification: BattleResultRequestNotification) => void;
  onDeclineBattleResultRequest: (notification: BattleResultRequestNotification) => void;
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
    () =>
      [...tradeRequestNotifications].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [tradeRequestNotifications]
  );

  const sortedBattleInvites = useMemo(
    () =>
      [...battleInviteNotifications].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [battleInviteNotifications]
  );

  const sortedBattleResultRequests = useMemo(
    () =>
      [...battleResultRequestNotifications].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [battleResultRequestNotifications]
  );

  const handleAcceptTrade = (notification: TradeNotification) => {
    onAcceptTrade(notification);
    setIsOpen(false);
  };

  const handleDeclineTrade = (notification: TradeNotification) => {
    onDeclineTrade(notification);
    setIsOpen(false);
  };

  const handleAcceptBattleInvite = (notification: BattleInviteNotification) => {
    onAcceptBattleInvite(notification);
    setIsOpen(false);
  };

  const handleDismissBattleInvite = (notification: BattleInviteNotification) => {
    onDismissBattleInvite(notification);
    setIsOpen(false);
  };

  const handleAcceptBattleResultRequest = (notification: BattleResultRequestNotification) => {
    onAcceptBattleResultRequest(notification);
    setIsOpen(false);
  };

  const handleDeclineBattleResultRequest = (notification: BattleResultRequestNotification) => {
    onDeclineBattleResultRequest(notification);
    setIsOpen(false);
  };

  const handleClear = () => {
    onClear?.();
    setIsOpen(false);
  };

  const formatTimestamp = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    return date.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
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
              <div
                key={notification.id}
                className="surface-panel-strong rounded-xl p-3"
              >
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-semibold text-foreground">
                    Battle result request
                  </p>
                  {notification.scenario ? (
                    <p className="text-xs text-muted-foreground">
                      {notification.scenario}
                    </p>
                  ) : null}
                  {notification.battleDate ? (
                    <p className="text-xs text-muted-foreground">
                      {notification.battleDate}
                    </p>
                  ) : null}
                  {notification.createdByLabel ? (
                    <p className="text-xs text-muted-foreground">
                      From: {notification.createdByLabel}
                    </p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    Winners:{" "}
                    {notification.winnerWarbandNames.length > 0
                      ? notification.winnerWarbandNames.join(", ")
                      : "-"}
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className="btn-icon icon-button flex h-8 w-8 items-center justify-center"
                    onClick={() => handleDeclineBattleResultRequest(notification)}
                    aria-label="Decline reported battle result"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="btn-icon icon-button flex h-8 w-8 items-center justify-center"
                    onClick={() => handleAcceptBattleResultRequest(notification)}
                    aria-label="Approve reported battle result"
                  >
                    <Check className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
            {sortedBattleInvites.map((notification) => (
              <div
                key={notification.id}
                className="surface-panel-strong rounded-xl p-3"
              >
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-semibold text-foreground">
                    Battle invite
                  </p>
                  {notification.scenario ? (
                    <p className="text-xs text-muted-foreground">
                      {notification.scenario}
                    </p>
                  ) : null}
                  {notification.battleDate ? (
                    <p className="text-xs text-muted-foreground">
                      {notification.battleDate}
                    </p>
                  ) : null}
                  {notification.createdByLabel ? (
                    <p className="text-xs text-muted-foreground">
                      From: {notification.createdByLabel}
                    </p>
                  ) : null}
                </div>
                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className="btn-icon icon-button flex h-8 w-8 items-center justify-center"
                    onClick={() => handleDismissBattleInvite(notification)}
                    aria-label="Dismiss battle invite"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="btn-icon icon-button flex h-8 w-8 items-center justify-center"
                    onClick={() => handleAcceptBattleInvite(notification)}
                    aria-label="Accept battle invite"
                  >
                    <Check className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
            {sortedTradeNotifications.map((notification) => {
              const isExpired = new Date(notification.expiresAt).getTime() <= Date.now();
              const expiresLabel = formatTimestamp(notification.expiresAt);
              return (
                <div
                  key={notification.id}
                  className="surface-panel-strong rounded-xl p-3"
                >
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-semibold text-foreground">
                      Trade request from {notification.fromUser.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {notification.fromWarband.name} wants to trade with {notification.toWarband.name}
                    </p>
                    {expiresLabel ? (
                      <p className={cn("text-xs", isExpired ? "text-[#b45353]" : "text-muted-foreground")}>
                        {isExpired ? `Expired ${expiresLabel}.` : `Expires ${expiresLabel}.`}
                      </p>
                    ) : isExpired ? (
                      <p className="text-xs text-[#b45353]">Request expired.</p>
                    ) : null}
                  </div>
                  <div className="mt-3 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      className="btn-icon icon-button flex h-8 w-8 items-center justify-center"
                      onClick={() => handleDeclineTrade(notification)}
                      disabled={isExpired}
                      aria-label="Decline trade"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="btn-icon icon-button flex h-8 w-8 items-center justify-center"
                      onClick={() => handleAcceptTrade(notification)}
                      disabled={isExpired}
                      aria-label="Accept trade"
                    >
                      <Check className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
