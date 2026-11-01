import type { ReactNode } from "react";
import { Check, Loader2, X } from "lucide-react";

import type {
  BattleInviteNotification,
  BattleNudgeNotification,
  BattleResultRequestNotification,
} from "@/features/battles/types/battle-types";
import type { BountyClaimNotification } from "@/features/bounties/types";
import type { TradeNotification } from "@/features/warbands/types/trade-request-types";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";
import UnfinishedBattleBanner from "@/features/battles/components/shared/UnfinishedBattleBanner";

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
    <div className="border border-border bg-surface p-3" aria-busy={isPending || undefined}>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-ink">{title}</p>
        {children}
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-xs text-danger">
          {error}
        </p>
      ) : null}
      <div className="mt-3 flex items-center justify-end gap-2">
        <IconButton
          onClick={decline.onClick}
          disabled={decline.disabled || isPending}
          aria-label={decline.label}
          title={decline.label}
        >
          <X aria-hidden="true" />
        </IconButton>
        <IconButton
          onClick={accept.onClick}
          disabled={accept.disabled || isPending}
          aria-label={accept.label}
        >
          {isPending ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <Check aria-hidden="true" />
          )}
        </IconButton>
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
  /** Following a link out of the card (closes the menu). */
  onNavigate?: () => void;
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
  onNavigate,
}: CardProps<BattleInviteNotification>) {
  return (
    <NotificationCard
      title="Battle invite"
      {...state}
      decline={{ label: "Decline battle invite", onClick: onDecline }}
      accept={{ label: "Accept battle invite", onClick: onAccept }}
    >
      <BattleDetails notification={notification} />
      <UnfinishedBattleBanner
        campaignId={notification.campaignId}
        excludeBattleId={notification.battleId}
        onGo={onNavigate}
        className="text-xs"
      />
    </NotificationCard>
  );
}

/** A nudge: the battle is waiting for you; the tick goes to it, the X dismisses it. */
export function BattleNudgeCard({
  notification,
  state,
  onAccept,
  onDecline,
}: CardProps<BattleNudgeNotification>) {
  return (
    <NotificationCard
      title={`Nudge from ${notification.fromLabel}`}
      {...state}
      decline={{ label: "Dismiss nudge", onClick: onDecline }}
      accept={{ label: "Go to the battle", onClick: onAccept }}
    >
      <p className="text-xs text-muted-foreground">{notification.scenario} is waiting for you.</p>
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
        <p className={cn("text-xs", isExpired ? "text-danger" : "text-muted-foreground")}>
          {isExpired ? `Expired ${expiresLabel}.` : `Expires ${expiresLabel}.`}
        </p>
      ) : isExpired ? (
        <p className="text-xs text-danger">Request expired.</p>
      ) : null}
    </NotificationCard>
  );
}

/** A claim on your bounty: the tick accepts it and pays, the X declines it. */
export function BountyClaimCard({
  notification,
  state,
  onAccept,
  onDecline,
}: CardProps<BountyClaimNotification>) {
  return (
    <NotificationCard
      title={`Bounty claim from ${notification.claimantUserName}`}
      {...state}
      decline={{ label: "Decline bounty claim", onClick: onDecline }}
      accept={{ label: `Accept and pay ${notification.amount} gc`, onClick: onAccept }}
    >
      <p className="text-xs text-muted-foreground">
        {notification.claimantWarbandName} claims your {notification.amount} gc bounty on{" "}
        {notification.targetName}
        {notification.unitName ? ` for ${notification.unitName}` : ""}
        {notification.battleScenario ? ` in ${notification.battleScenario}` : ""}.
      </p>
    </NotificationCard>
  );
}
