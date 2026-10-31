import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/features/auth/hooks/use-auth";

import { warbandStashQuery } from "../../api/economy-queries";
import { useWarbandTradeSession } from "../../hooks/warband/useWarbandTradeSession";
import type { WarbandHero } from "../../types/warband-types";
import OpenTradeBanner from "./OpenTradeBanner";
import TradeInvitePanel from "./TradeInvitePanel";
import TradePanel from "./TradePanel";

/**
 * Trading on your own warband page (only its owner trades for it, decision 10): the open-trade
 * banner, the invite panel from the ⋯ menu, and the open trade's panel (`?trade=`).
 */
export default function WarbandTrade({
  campaignId,
  warbandId,
  heroes,
  gold,
  inviteOpen,
  onInviteOpenChange,
}: {
  campaignId: number;
  warbandId: number;
  heroes: WarbandHero[];
  gold: number;
  inviteOpen: boolean;
  onInviteOpenChange: (open: boolean) => void;
}) {
  const { user } = useAuth();
  // The stash the page already reads (its count in the header): the trade offers from it.
  const stash = useQuery(warbandStashQuery(campaignId, warbandId));
  const { refetch } = stash;
  const loadStash = useCallback(() => void refetch(), [refetch]);
  const trade = useWarbandTradeSession({
    campaignId,
    hasCampaignId: true,
    enabled: true,
    warbandId,
    loadWarchestItems: loadStash,
  });

  return (
    <>
      <OpenTradeBanner
        campaignId={campaignId}
        userId={user?.id}
        session={trade.session}
        openTradeId={trade.openTradeId}
        onResume={trade.resumeTrade}
      />
      <TradeInvitePanel
        campaignId={campaignId}
        userId={user?.id}
        open={inviteOpen}
        onOpenChange={onInviteOpenChange}
        onInvite={trade.handleTradeRequestCreated}
      />
      <TradePanel
        session={trade.session}
        tradeRequest={trade.tradeRequest}
        heroes={heroes}
        stash={stash.data ?? []}
        gold={gold}
        onRequestUpdated={trade.handleRequestUpdated}
        onHide={trade.leaveTrade}
        onCancel={trade.handleTradeSessionClose}
      />
    </>
  );
}
