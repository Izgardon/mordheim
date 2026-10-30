import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { openTradesQuery } from "@/features/warbands/api/economy-queries";
import { formatCountdown, useCountdown } from "@/features/warbands/hooks/warband/useCountdown";

import type { TradeRequest, TradeSession } from "@/features/warbands/types/trade-request-types";

const BANNER =
  "flex flex-wrap items-center justify-between gap-3 border border-accent-line bg-accent-soft px-4 py-2.5 text-sm text-ink";

/**
 * Your open trade when the page isn't showing it: "You have an open trade with <name> · Resume"
 * (an accepted one first, then one you sent); while one you sent waits, the time it has left.
 * Requests sent to you are answered from the bell.
 */
export default function OpenTradeBanner({
  campaignId,
  userId,
  session,
  openTradeId,
  onResume,
}: {
  campaignId: number;
  userId: number | undefined;
  session: TradeSession | null;
  openTradeId: string | null;
  onResume: (requestId: string) => void;
}) {
  const openTrades = useQuery(openTradesQuery(campaignId));
  const waiting = session?.status === "pending" && session.role === "initiator";
  const timeLeft = useCountdown(waiting ? session.expiresAt : null);

  if (waiting) {
    return (
      <p role="status" className={BANNER}>
        Waiting for {session.partner.label} to answer your trade
        {timeLeft !== null ? ` · ${formatCountdown(timeLeft)} left` : ""}
      </p>
    );
  }
  if (session || openTradeId) return null;
  const trades: TradeRequest[] = openTrades.data ?? [];
  const resumable =
    trades.find((trade) => trade.status === "accepted") ??
    trades.find((trade) => trade.status === "pending" && trade.from_user.id === userId);
  if (!resumable) return null;
  const partner = resumable.from_user.id === userId ? resumable.to_user : resumable.from_user;
  return (
    <section aria-label="Open trade" className={BANNER}>
      <span>You have an open trade with {partner.label}</span>
      <Button size="sm" onClick={() => onResume(resumable.id)}>
        Resume
      </Button>
    </section>
  );
}
