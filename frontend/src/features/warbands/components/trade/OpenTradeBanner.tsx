import { useQuery } from "@tanstack/react-query";

import { Button } from "@components/button";
import { openTradesQuery } from "@/features/warbands/api/economy-queries";
import { formatCountdown, useCountdown } from "@/features/warbands/hooks/warband/useCountdown";

import type { TradeRequest, TradeSession } from "@/features/warbands/types/trade-request-types";

type OpenTradeBannerProps = {
  campaignId: number;
  userId: number | undefined;
  /** The trade open on the page (from `?trade=`), if any. */
  session: TradeSession | null;
  /** The trade `?trade=` names: once Resume put it there, the banner makes way for it. */
  openTradeId: string | null;
  onResume: (requestId: string) => void;
};

const BANNER_CLASS =
  "flex flex-wrap items-center justify-between gap-3 rounded border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-200";

/**
 * Your own open trade, when the page isn't showing it (only `?trade=` opens the dialog): "You
 * have an open trade with <name> · Resume". An accepted trade comes first, then a request you
 * sent; requests sent to you are answered from the bell. While a request you sent waits for an
 * answer, the banner says so, with the time it has left.
 */
export default function OpenTradeBanner({
  campaignId,
  userId,
  session,
  openTradeId,
  onResume,
}: OpenTradeBannerProps) {
  const openTrades = useQuery(openTradesQuery(campaignId));
  const isWaiting = session?.status === "pending" && session.role === "initiator";
  const timeLeft = useCountdown(isWaiting ? session.expiresAt : null);

  if (isWaiting) {
    return (
      <p role="status" className={BANNER_CLASS}>
        Waiting for {session.partner.label} to answer your trade
        {timeLeft !== null ? ` · ${formatCountdown(timeLeft)} left` : ""}
      </p>
    );
  }
  if (session || openTradeId) {
    return null;
  }

  const trades: TradeRequest[] = openTrades.data ?? [];
  const resumable =
    trades.find((trade) => trade.status === "accepted") ??
    trades.find((trade) => trade.status === "pending" && trade.from_user.id === userId);
  if (!resumable) {
    return null;
  }
  const partner = resumable.from_user.id === userId ? resumable.to_user : resumable.from_user;

  return (
    <section aria-label="Open trade" className={BANNER_CLASS}>
      <span>You have an open trade with {partner.label}</span>
      <Button type="button" size="sm" onClick={() => onResume(resumable.id)}>
        Resume
      </Button>
    </section>
  );
}
