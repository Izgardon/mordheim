import { useMemo, useState } from "react";

import { NumberInput } from "@/components/ui/number-input";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SidePanel } from "@/components/ui/side-panel";
import { formatCountdown, useCountdown } from "@/features/warbands/hooks/warband/useCountdown";
import { useTradeLockActions } from "@/features/warbands/hooks/warband/useTradeLockActions";
import { useTradeOfferDraft } from "@/features/warbands/hooks/warband/useTradeOfferDraft";
import {
  addOfferItem,
  normalizeOffer,
  offerableStash,
  removeOfferItem,
  withOfferGold,
  withOfferTrader,
} from "@/features/warbands/utils/trade-offer";

import type { TradeRequest, TradeSession } from "../../types/trade-request-types";
import type { WarbandHero, WarbandItemSummary } from "../../types/warband-types";
import { unitName } from "../roster/unit-view";
import TradeOffer from "./TradeOffer";

type TradePanelProps = {
  session: TradeSession | null;
  tradeRequest: TradeRequest | null;
  heroes: WarbandHero[];
  stash: WarbandItemSummary[];
  gold: number;
  onRequestUpdated: (request: TradeRequest) => void;
  /** Closing the panel hides the trade; it stays open and the banner offers it again. */
  onHide: () => void;
  /** Cancel, once confirmed: ends the trade for both sides. */
  onCancel: () => void;
};

/**
 * An open trade (design E panel): the time left, your trader, gold and stash items (saved as you
 * edit), both offers, and Accept or Unaccept; the trade completes when you both accept.
 */
export default function TradePanel({
  session,
  tradeRequest,
  heroes,
  stash,
  gold,
  onRequestUpdated,
  onHide,
  onCancel,
}: TradePanelProps) {
  const [confirmCancel, setConfirmCancel] = useState(false);
  const isInitiator = session?.role === "initiator";
  const maxGold = Math.max(0, gold);
  const mine = isInitiator ? tradeRequest?.from_offer : tradeRequest?.to_offer;
  const theirs = isInitiator ? tradeRequest?.to_offer : tradeRequest?.from_offer;
  const myOffer = useMemo(() => normalizeOffer(mine), [mine]);
  const theirOffer = useMemo(() => normalizeOffer(theirs), [theirs]);
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
  const timeLeft = useCountdown(tradeRequest?.expires_at ?? session?.expiresAt);
  const offerable = useMemo(() => offerableStash(stash, draft), [draft, stash]);
  const error = actions.actionError || offer.error;
  const partner = session?.partner.label ?? "";
  const trader = heroes.find((hero) => hero.id === draft.trader_id);

  return (
    <>
      <SidePanel
        open={session?.status === "active"}
        onOpenChange={(open) => (open ? null : onHide())}
        kicker={timeLeft !== null ? `Trade · ${formatCountdown(timeLeft)} left` : "Trade"}
        title={`Trading with ${partner}`}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setConfirmCancel(true)}>
              Cancel trade
            </Button>
            {myAccepted ? (
              <Button
                className="flex-1"
                variant="secondary"
                disabled={actions.isUnlocking}
                onClick={actions.unaccept}
              >
                {actions.isUnlocking ? "Unaccepting…" : "Unaccept"}
              </Button>
            ) : (
              <Button
                className="flex-1"
                disabled={offer.isDirty || offer.isSaving || actions.isLocking}
                onClick={actions.accept}
              >
                {actions.isLocking ? "Accepting…" : "Accept"}
              </Button>
            )}
          </div>
        }
      >
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-faint">
            Trader
          </span>
          <div role="group" aria-label="Trader" className="flex flex-wrap gap-1.5">
            <Chip
              pressed={!draft.trader_id}
              disabled={myAccepted}
              onClick={() => edit((prev) => withOfferTrader(prev, "none"))}
            >
              Nobody
            </Chip>
            {heroes.map((hero) => (
              <Chip
                key={hero.id}
                pressed={draft.trader_id === hero.id}
                disabled={myAccepted}
                onClick={() => edit((prev) => withOfferTrader(prev, String(hero.id)))}
              >
                {unitName(hero)}
                {hero.trading_action === false ? (
                  <span className="text-[11px] text-muted-foreground">spent</span>
                ) : null}
              </Chip>
            ))}
          </div>
          {trader && trader.trading_action === false && !myAccepted ? (
            <p className="m-0 text-xs text-danger">
              {unitName(trader)} has used his trading action this round. You can still send him.
            </p>
          ) : null}
        </div>
        <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground">
          Gold (you have {maxGold} gc)
          <NumberInput
            disabled={myAccepted}
            value={String(draft.gold ?? 0)}
            onChange={(event) => edit((prev) => withOfferGold(prev, event.target.value, maxGold))}
          />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-faint">
            From your stash
          </span>
          <div className="flex flex-wrap gap-1.5">
            {offerable.length === 0 ? (
              <span className="text-[13px] text-muted-foreground">The stash is empty.</span>
            ) : null}
            {offerable.map((item) => (
              <Chip
                key={item.id}
                disabled={myAccepted || item.available <= 0}
                onClick={() => edit((prev) => addOfferItem(prev, item))}
              >
                {item.name}
                <span className="font-mono text-[11px] text-muted-foreground">
                  {item.available}/{item.total}
                </span>
              </Chip>
            ))}
          </div>
        </div>
        <div className="grid gap-3 min-[600px]:grid-cols-2">
          <TradeOffer
            title="Your offer"
            offer={draft}
            accepted={myAccepted}
            emptyText="Nothing yet."
            onRemoveItem={myAccepted ? undefined : (item) => edit((p) => removeOfferItem(p, item))}
          />
          <TradeOffer
            title={`${partner}'s offer`}
            offer={theirOffer}
            accepted={theirAccepted}
            emptyText="Nothing yet."
          />
        </div>
        {error ? <p className="m-0 text-sm text-danger">{error}</p> : null}
        {myAccepted && !theirAccepted ? (
          <p className="m-0 text-sm text-muted-foreground">Waiting for {partner}…</p>
        ) : null}
      </SidePanel>
      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancel this trade?"
        description="Both sides lose their offers."
        confirmText="Cancel trade"
        cancelText="Go back"
        confirmVariant="danger"
        onConfirm={() => {
          setConfirmCancel(false);
          onCancel();
        }}
      />
    </>
  );
}
