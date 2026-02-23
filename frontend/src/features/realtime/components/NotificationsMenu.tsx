import { useMemo, useState } from "react";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Bell, Check, X } from "lucide-react";

import type { BattleInviteNotification } from "@/features/battles/types/battle-types";
import type { TradeNotification } from "@/features/warbands/types/trade-request-types";

type NotificationsMenuProps = {
  tradeRequestNotifications: TradeNotification[];
  battleInviteNotifications: BattleInviteNotification[];
  onAcceptTrade: (notification: TradeNotification) => void;
  onDeclineTrade: (notification: TradeNotification) => void;
  onAcceptBattleInvite: (notification: BattleInviteNotification) => void;
  onDismissBattleInvite: (notification: BattleInviteNotification) => void;
  onClear?: () => void;
  className?: string;
  iconClassName?: string;
  label?: string;
};

export default function NotificationsMenu({
  tradeRequestNotifications,
  battleInviteNotifications,
  onAcceptTrade,
  onDeclineTrade,
  onAcceptBattleInvite,
  onDismissBattleInvite,
  onClear,
  className,
  iconClassName,
  label,
}: NotificationsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const unreadCount = tradeRequestNotifications.length + battleInviteNotifications.length;
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
          <Bell className={cn("h-5 w-5 text-[#e9dcc2]", iconClassName)} aria-hidden="true" />
          {hasNotifications ? (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[#d6b25e] px-1 text-[0.55rem] font-semibold text-[#1a120c]">
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
        {sortedTradeNotifications.length === 0 && sortedBattleInvites.length === 0 ? (
          <p className="text-sm text-muted-foreground">You are all caught up.</p>
        ) : (
          <div className="space-y-3">
            {sortedBattleInvites.map((notification) => (
              <div
                key={notification.id}
                className="rounded-xl border border-[#2b2117]/80 bg-[#0f0c09] p-3"
              >
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-semibold text-foreground">
                    Battle invite
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {notification.title}
                  </p>
                  {notification.scenario ? (
                    <p className="text-xs text-muted-foreground">
                      Scenario: {notification.scenario}
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
                    className="icon-button flex h-8 w-8 items-center justify-center border border-[#3b2f25]/70 bg-[#15100c]"
                    onClick={() => handleDismissBattleInvite(notification)}
                    aria-label="Dismiss battle invite"
                  >
                    <X className="h-4 w-4 text-[#e9dcc2]" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="icon-button flex h-8 w-8 items-center justify-center border border-[#3b2f25]/70 bg-[#15100c]"
                    onClick={() => handleAcceptBattleInvite(notification)}
                    aria-label="Accept battle invite"
                  >
                    <Check className="h-4 w-4 text-[#e9dcc2]" aria-hidden="true" />
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
                  className="rounded-xl border border-[#2b2117]/80 bg-[#0f0c09] p-3"
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
                      className="icon-button flex h-8 w-8 items-center justify-center border border-[#3b2f25]/70 bg-[#15100c]"
                      onClick={() => handleDeclineTrade(notification)}
                      disabled={isExpired}
                      aria-label="Decline trade"
                    >
                      <X className="h-4 w-4 text-[#e9dcc2]" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="icon-button flex h-8 w-8 items-center justify-center border border-[#3b2f25]/70 bg-[#15100c]"
                      onClick={() => handleAcceptTrade(notification)}
                      disabled={isExpired}
                      aria-label="Accept trade"
                    >
                      <Check className="h-4 w-4 text-[#e9dcc2]" aria-hidden="true" />
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
