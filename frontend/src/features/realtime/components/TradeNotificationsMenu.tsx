import { useEffect, useMemo, useState } from "react";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/lib/use-media-query";
import { Bell, Check, X } from "lucide-react";

import type { TradeNotification } from "@/features/warbands/types/trade-request-types";

type TradeNotificationsMenuProps = {
  notifications: TradeNotification[];
  onAccept: (notification: TradeNotification) => void;
  onDecline: (notification: TradeNotification) => void;
  onClear?: () => void;
  className?: string;
  iconClassName?: string;
  label?: string;
};

export default function TradeNotificationsMenu({
  notifications,
  onAccept,
  onDecline,
  onClear,
  className,
  iconClassName,
  label,
}: TradeNotificationsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 960px)");
  const unreadCount = notifications.length;
  const hasNotifications = unreadCount > 0;

  const sortedNotifications = useMemo(
    () =>
      [...notifications].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [notifications]
  );

  useEffect(() => {
    if (isMobile && isOpen && notifications.length === 0) {
      setIsOpen(false);
    }
  }, [isMobile, isOpen, notifications.length]);

  const handleAccept = (notification: TradeNotification) => {
    onAccept(notification);
    setIsOpen(false);
  };

  const handleDecline = (notification: TradeNotification) => {
    onDecline(notification);
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
        {sortedNotifications.length === 0 ? (
          <p className="text-sm text-muted-foreground">You are all caught up.</p>
        ) : (
          <div className="space-y-3">
            {sortedNotifications.map((notification) => {
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
                      onClick={() => handleDecline(notification)}
                      disabled={isExpired}
                      aria-label="Decline trade"
                    >
                      <X className="h-4 w-4 text-[#e9dcc2]" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="icon-button flex h-8 w-8 items-center justify-center border border-[#3b2f25]/70 bg-[#15100c]"
                      onClick={() => handleAccept(notification)}
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
