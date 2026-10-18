import { useMemo } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@components/dialog";

import TradeActions from "./TradeActions";
import TradeOfferEditor from "./TradeOfferEditor";
import TradeOfferSummary from "./TradeOfferSummary";
import { useTradeOfferDraft } from "@/features/warbands/hooks/warband/useTradeOfferDraft";
import { useTradeLockActions } from "@/features/warbands/hooks/warband/useTradeLockActions";
import { formatCountdown, useCountdown } from "@/features/warbands/hooks/warband/useCountdown";
import {
  addOfferItem,
  normalizeOffer,
  offerableStash,
  removeOfferItem,
  withOfferGold,
  withOfferTrader,
  type OfferableStashItem,
} from "@/features/warbands/utils/trade-offer";

import type { WarbandHero, WarbandItemSummary } from "@/features/warbands/types/warband-types";
import type {
  TradeOfferItem,
  TradeRequest,
  TradeSession,
} from "@/features/warbands/types/trade-request-types";

const TIME_LEFT_HINT =
  "Any change by either of you gives the trade another 10 minutes, up to an hour after it opened. When time runs out, the trade closes and both offers are dropped.";

type TradeSessionDialogProps = {
  session: TradeSession | null;
  tradeRequest: TradeRequest | null;
  heroes: WarbandHero[];
  warchestItems: WarbandItemSummary[];
  isWarchestLoading?: boolean;
  warchestError?: string;
  availableGold: number;
  onRequestUpdated: (request: TradeRequest) => void;
  onClose: () => void;
};

/**
 * An open trade: your offer as you edit it (`TradeOfferEditor`, saved by `useTradeOfferDraft`),
 * both offers (`TradeOfferSummary`), and Cancel / Accept / Unaccept (`TradeActions`).
 */
export default function TradeSessionDialog({
  session,
  tradeRequest,
  heroes,
  warchestItems,
  isWarchestLoading = false,
  warchestError = "",
  availableGold,
  onRequestUpdated,
  onClose,
}: TradeSessionDialogProps) {
  const isOpen = Boolean(session && session.status === "active");
  const isInitiator = session?.role === "initiator";
  const maxGold = Math.max(0, Number(availableGold) || 0);

  const myOffer = useMemo(
    () => normalizeOffer(isInitiator ? tradeRequest?.from_offer : tradeRequest?.to_offer),
    [isInitiator, tradeRequest?.from_offer, tradeRequest?.to_offer]
  );
  const theirOffer = useMemo(
    () => normalizeOffer(isInitiator ? tradeRequest?.to_offer : tradeRequest?.from_offer),
    [isInitiator, tradeRequest?.from_offer, tradeRequest?.to_offer]
  );
  const myAccepted = Boolean(isInitiator ? tradeRequest?.from_accepted : tradeRequest?.to_accepted);
  const theirAccepted = Boolean(
    isInitiator ? tradeRequest?.to_accepted : tradeRequest?.from_accepted
  );

  const offer = useTradeOfferDraft({
    session: tradeRequest ? session : null,
    serverOffer: myOffer,
    maxGold,
    locked: myAccepted,
    onSaved: onRequestUpdated,
  });
  const { draft, edit } = offer;
  const actions = useTradeLockActions({
    session,
    offerVersion: tradeRequest?.offer_version,
    myAccepted,
    onRequestUpdated,
  });
  // The deadline moves with every change either player makes (decision 8): read it each time.
  const timeLeft = useCountdown(tradeRequest?.expires_at ?? session?.expiresAt);
  const error = actions.actionError || offer.error;
  const warchest = useMemo(() => offerableStash(warchestItems, draft), [draft, warchestItems]);

  const handleAddItem = (item: OfferableStashItem) => {
    if (!myAccepted && item.available > 0) {
      edit((prev) => addOfferItem(prev, item));
    }
  };
  const handleRemoveItem = (item: TradeOfferItem) => {
    if (!myAccepted) {
      edit((prev) => removeOfferItem(prev, item));
    }
  };
  const handleGoldChange = (typed: string) => {
    if (!myAccepted) {
      edit((prev) => withOfferGold(prev, typed, maxGold));
    }
  };
  const handleTraderChange = (value: string) => {
    if (!myAccepted) {
      edit((prev) => withOfferTrader(prev, value));
    }
  };

  if (!session) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : null)}>
      <DialogContent className="min-[960px]:w-[1100px]">
        <DialogHeader className="items-start text-left">
          <DialogTitle>Trading with {session.partner.label}</DialogTitle>
          <DialogDescription className="sr-only">
            Offer stash items and gold; the trade completes when you both accept.
          </DialogDescription>
          {timeLeft !== null ? (
            <p className="text-xs text-muted-foreground" title={TIME_LEFT_HINT}>
              Time left: {formatCountdown(timeLeft)}
            </p>
          ) : null}
        </DialogHeader>

        <div className="space-y-6">
          <TradeOfferEditor
            draft={draft}
            heroes={heroes}
            maxGold={maxGold}
            locked={myAccepted}
            warchest={warchest}
            isWarchestLoading={isWarchestLoading}
            warchestError={warchestError}
            onTraderChange={handleTraderChange}
            onGoldChange={handleGoldChange}
            onAddItem={handleAddItem}
          />

          <div className="grid gap-4 min-[960px]:grid-cols-2">
            <TradeOfferSummary
              title="Your offer"
              offer={draft}
              accepted={myAccepted}
              emptyText="No items added."
              onRemoveItem={handleRemoveItem}
              disabled={myAccepted}
            />
            <TradeOfferSummary
              title={`${session.partner.label}'s offer`}
              offer={theirOffer}
              accepted={theirAccepted}
              emptyText="No items yet."
            />
          </div>

          {error ? <p className="text-xs text-red-400">{error}</p> : null}
          {myAccepted && !theirAccepted ? (
            <p className="text-xs text-muted-foreground">Waiting for {session.partner.label}...</p>
          ) : null}
        </div>

        <TradeActions
          myAccepted={myAccepted}
          hasUnsavedOffer={offer.isDirty || offer.isSaving}
          isLocking={actions.isLocking}
          isUnlocking={actions.isUnlocking}
          onAccept={actions.accept}
          onUnaccept={actions.unaccept}
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}
