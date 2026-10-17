import type { ReactNode } from "react";
import { Check, Loader2, X } from "lucide-react";

import type {
  BattleInviteNotification,
  BattleResultRequestNotification,
} from "@/features/battles/types/battle-types";
import type { TradeNotification } from "@/features/warbands/types/trade-request-types";
import { cn } from "@/lib/utils";

type NotificationCardAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

type NotificationCardProps = {
  title: string;
  children?: ReactNode;
  decline: NotificationCardAction;
  accept: NotificationCardAction;
  /** This card's action is in flight: both buttons wait. */
  isPending?: boolean;
  /** Why this card's last action failed. */
  error?: string;
};

/** One notification with decline (X) and accept (tick) actions. */
function NotificationCard({
  title,
  children,
  decline,
  accept,
  isPending = false,
  error,
}: NotificationCardProps) {
  return (
    <div className="surface-panel-strong rounded-xl p-3" aria-busy={isPending || undefined}>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {children}
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-xs text-red-400">
          {error}
        </p>
      ) : null}
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          className="btn-icon icon-button flex h-8 w-8 items-center justify-center"
          onClick={decline.onClick}
          disabled={decline.disabled || isPending}
          aria-label={decline.label}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="btn-icon icon-button flex h-8 w-8 items-center justify-center"
          onClick={accept.onClick}
          disabled={accept.disabled || isPending}
          aria-label={accept.label}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Check className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}

export type NotificationCardState = { isPending: boolean; error?: string };

type CardProps<T> = {
  notification: T;
  state: NotificationCardState;
  onAccept: () => void;
  onDecline: () => void;
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

function BattleDetails({
  notification,
}: {
  notification: BattleInviteNotification | BattleResultRequestNotification;
}) {
  return (
    <>
      {notification.scenario ? (
        <p className="text-xs text-muted-foreground">{notification.scenario}</p>
      ) : null}
      {notification.battleDate ? (
        <p className="text-xs text-muted-foreground">{notification.battleDate}</p>
      ) : null}
      {notification.createdByLabel ? (
        <p className="text-xs text-muted-foreground">From: {notification.createdByLabel}</p>
      ) : null}
    </>
  );
}

export function BattleResultRequestCard({
  notification,
  state,
  onAccept,
  onDecline,
}: CardProps<BattleResultRequestNotification>) {
  return (
    <NotificationCard
      title="Battle result request"
      {...state}
      decline={{ label: "Decline reported battle result", onClick: onDecline }}
      accept={{ label: "Approve reported battle result", onClick: onAccept }}
    >
      <BattleDetails notification={notification} />
      <p className="text-xs text-muted-foreground">
        Winners:{" "}
        {notification.winnerWarbandNames.length > 0
          ? notification.winnerWarbandNames.join(", ")
          : "-"}
      </p>
    </NotificationCard>
  );
}

export function BattleInviteCard({
  notification,
  state,
  onAccept,
  onDecline,
}: CardProps<BattleInviteNotification>) {
  return (
    <NotificationCard
      title="Battle invite"
      {...state}
      decline={{ label: "Dismiss battle invite", onClick: onDecline }}
      accept={{ label: "Accept battle invite", onClick: onAccept }}
    >
      <BattleDetails notification={notification} />
    </NotificationCard>
  );
}

export function TradeRequestCard({
  notification,
  state,
  onAccept,
  onDecline,
}: CardProps<TradeNotification>) {
  const isExpired = new Date(notification.expiresAt).getTime() <= Date.now();
  const expiresLabel = formatTimestamp(notification.expiresAt);
  return (
    <NotificationCard
      title={`Trade request from ${notification.fromUser.label}`}
      {...state}
      decline={{ label: "Decline trade", disabled: isExpired, onClick: onDecline }}
      accept={{ label: "Accept trade", disabled: isExpired, onClick: onAccept }}
    >
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
    </NotificationCard>
  );
}
