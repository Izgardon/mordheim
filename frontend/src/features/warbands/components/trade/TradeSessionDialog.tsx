import type { ChangeEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@components/button";
import { NumberInput } from "@components/number-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@components/dialog";
import { cn } from "@/lib/utils";

import { lockTradeOffer, updateTradeOffer } from "@/features/campaigns/api/campaigns-api";
import type { WarbandHero, WarbandItemSummary } from "@/features/warbands/types/warband-types";
import type {
  TradeOffer,
  TradeOfferItem,
  TradeRequest,
  TradeSession,
} from "@/features/warbands/types/trade-request-types";

const normalizeOffer = (offer?: TradeOffer): Required<TradeOffer> => ({
  trader_id: offer?.trader_id ?? null,
  trader_name: offer?.trader_name ?? null,
  gold: Math.max(0, Number(offer?.gold ?? 0)),
  items: Array.isArray(offer?.items) ? offer?.items ?? [] : [],
});

const buildOfferPayload = (offer: Required<TradeOffer>, maxGold: number) => ({
  trader_id: offer.trader_id ?? null,
  gold: Math.min(Math.max(0, Number(offer.gold || 0)), maxGold),
  items: offer.items.map((item) => ({
    id: item.id,
    name: item.name,
    quantity: Math.max(0, Number(item.quantity) || 0),
  })),
});

const calculateOfferValue = (offer: Required<TradeOffer>) => {
  const gold = Math.max(0, Number(offer.gold ?? 0));
  const itemTotal = offer.items.reduce((sum, item) => {
    const quantity = Math.max(0, Number(item.quantity ?? 0));
    const cost = Math.max(0, Number(item.cost ?? 0));
    return sum + quantity * cost;
  }, 0);
  return gold + itemTotal;
};

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
  const theirAccepted = Boolean(isInitiator ? tradeRequest?.to_accepted : tradeRequest?.from_accepted);

  const [draftOffer, setDraftOffer] = useState<Required<TradeOffer>>(myOffer);
  const [isSaving, setIsSaving] = useState(false);
  const [isLocking, setIsLocking] = useState(false);
  const [error, setError] = useState("");
  const lastSentRef = useRef<string>("");

  useEffect(() => {
    setDraftOffer(myOffer);
    lastSentRef.current = JSON.stringify(buildOfferPayload(myOffer, maxGold));
    setError("");
  }, [maxGold, myOffer]);

  useEffect(() => {
    if (!session || !tradeRequest || myAccepted) {
      return;
    }
    const payload = buildOfferPayload(draftOffer, maxGold);
    const serialized = JSON.stringify(payload);
    if (serialized === lastSentRef.current) {
      return;
    }
    const timeout = window.setTimeout(() => {
      setIsSaving(true);
      updateTradeOffer(session.campaignId, session.requestId, payload)
        .then((request) => {
          lastSentRef.current = serialized;
          onRequestUpdated(request);
          setError("");
        })
        .catch((err) => {
          if (err instanceof Error) {
            setError(err.message || "Unable to update offer.");
          } else {
            setError("Unable to update offer.");
          }
        })
        .finally(() => setIsSaving(false));
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [draftOffer, maxGold, myAccepted, onRequestUpdated, session, tradeRequest]);

  const offeredCounts = useMemo(() => {
    const map = new Map<number, number>();
    draftOffer.items.forEach((item) => {
      map.set(item.id, (map.get(item.id) ?? 0) + item.quantity);
    });
    return map;
  }, [draftOffer.items]);

  const availableWarchest = useMemo(
    () =>
      warchestItems.map((item) => {
        const total = Math.max(0, Number(item.quantity ?? 0));
        const offered = offeredCounts.get(item.id) ?? 0;
        return {
          ...item,
          total,
          available: Math.max(0, total - offered),
        };
      }),
    [offeredCounts, warchestItems]
  );

  const handleAddItem = (item: WarbandItemSummary & { available: number }) => {
    if (myAccepted || item.available <= 0) {
      return;
    }
    setDraftOffer((prev) => {
      const nextItems = [...prev.items];
      const idx = nextItems.findIndex((entry) => entry.id === item.id);
      if (idx === -1) {
        nextItems.push({ id: item.id, name: item.name, quantity: 1, cost: item.cost ?? 0 });
      } else {
        nextItems[idx] = {
          ...nextItems[idx],
          cost: nextItems[idx].cost ?? item.cost ?? 0,
          quantity: nextItems[idx].quantity + 1,
        };
      }
      return { ...prev, items: nextItems };
    });
  };

  const handleRemoveItem = (item: TradeOfferItem) => {
    if (myAccepted) {
      return;
    }
    setDraftOffer((prev) => {
      const nextItems = prev.items
        .map((entry) =>
          entry.id === item.id
            ? { ...entry, quantity: entry.quantity - 1 }
            : entry
        )
        .filter((entry) => entry.quantity > 0);
      return { ...prev, items: nextItems };
    });
  };

  const handleGoldChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (myAccepted) {
      return;
    }
    const value = Number(event.target.value || 0);
    const nextGold = Math.min(Math.max(0, value), maxGold);
    setDraftOffer((prev) => ({ ...prev, gold: nextGold }));
  };

  const handleTraderChange = (value: string) => {
    if (myAccepted) {
      return;
    }
    const nextTrader = value === "none" ? null : Number(value);
    setDraftOffer((prev) => ({ ...prev, trader_id: Number.isNaN(nextTrader) ? null : nextTrader }));
  };

  const handleAccept = async () => {
    if (!session || myAccepted) {
      return;
    }
    setIsLocking(true);
    setError("");
    try {
      const request = await lockTradeOffer(session.campaignId, session.requestId);
      onRequestUpdated(request);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message || "Unable to accept trade.");
      } else {
        setError("Unable to accept trade.");
      }
    } finally {
      setIsLocking(false);
    }
  };

  if (!session) {
    return null;
  }

  const traderValue = draftOffer.trader_id ? String(draftOffer.trader_id) : "none";
  const myTotalValue = calculateOfferValue(draftOffer);
  const theirTotalValue = calculateOfferValue(theirOffer);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : null)}>
      <DialogContent className="min-[960px]:w-[1100px]">
        <DialogHeader className="items-start text-left">
          <DialogTitle>Trading with {session.partner.label}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid gap-4 min-[960px]:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Trader</p>
              <Select value={traderValue} onValueChange={handleTraderChange} disabled={myAccepted}>
                <SelectTrigger className="bg-background/70">
                  <SelectValue placeholder="Select (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {heroes.map((hero) => (
                    <SelectItem key={hero.id} value={String(hero.id)}>
                      {hero.name || `Hero ${hero.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Add gold</p>
                <span className="text-xs text-muted-foreground">Available: {maxGold} gc</span>
              </div>
              <NumberInput
                min={0}
                max={maxGold}
                step={1}
                value={draftOffer.gold ?? 0}
                onChange={handleGoldChange}
                disabled={myAccepted}
                allowEmpty
                className="bg-background/70 border-border/60 text-foreground"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Warchest</p>
              {isWarchestLoading ? (
                <span className="text-xs text-muted-foreground">Loading...</span>
              ) : null}
            </div>
            {warchestError ? (
              <p className="text-xs text-red-400">{warchestError}</p>
            ) : (
              <div className="grid max-h-48 grid-cols-2 gap-2 overflow-y-auto pr-1 min-[960px]:grid-cols-4">
                {availableWarchest.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleAddItem(item)}
                    disabled={myAccepted || item.available <= 0}
                    className={cn(
                      "rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-left text-xs transition-colors",
                      item.available <= 0 || myAccepted
                        ? "opacity-50"
                        : "hover:border-white/40"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold">{item.name}</span>
                      <span className="text-[0.55rem] text-muted-foreground">
                        {item.available}/{item.total}
                      </span>
                    </div>
                  </button>
                ))}
                {availableWarchest.length === 0 && !isWarchestLoading ? (
                  <div className="text-xs text-muted-foreground">No items in warchest.</div>
                ) : null}
              </div>
            )}
          </div>

          <div className="grid gap-4 min-[960px]:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Your offer</p>
                  <span className="text-[0.65rem] text-muted-foreground">Total value: {myTotalValue} gc</span>
                </div>
                {myAccepted ? (
                  <span className="rounded-full border border-[#3b2f25]/70 bg-[#15100c] px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.2em] text-[#e9dcc2]">
                    Locked
                  </span>
                ) : null}
              </div>
              <div className="rounded-xl border border-[#2b2117]/80 bg-[#0f0c09] p-3">
                <div className="grid min-h-[80px] grid-cols-2 gap-2">
                  {draftOffer.items.length === 0 ? (
                    <span className="text-xs text-muted-foreground">No items added.</span>
                  ) : (
                    draftOffer.items.map((item) => (
                      <button
                        key={`${item.id}-${item.quantity}`}
                        type="button"
                        onClick={() => handleRemoveItem(item)}
                        disabled={myAccepted}
                        className={cn(
                          "rounded border border-white/10 bg-white/5 px-2 py-1 text-left text-xs",
                          myAccepted ? "opacity-50" : "hover:border-white/40"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate">{item.name}</span>
                          <span className="text-[0.55rem] text-muted-foreground">x{item.quantity}</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Gold</span>
                  <span>{draftOffer.gold || 0} gc</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                    {session.partner.label}&apos;s offer
                  </p>
                  <span className="text-[0.65rem] text-muted-foreground">Total value: {theirTotalValue} gc</span>
                </div>
                {theirAccepted ? (
                  <span className="rounded-full border border-[#3b2f25]/70 bg-[#15100c] px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.2em] text-[#e9dcc2]">
                    Locked
                  </span>
                ) : null}
              </div>
              <div className="rounded-xl border border-[#2b2117]/80 bg-[#0f0c09] p-3">
                <div className="grid min-h-[80px] grid-cols-2 gap-2">
                  {theirOffer.items.length === 0 ? (
                    <span className="text-xs text-muted-foreground">No items yet.</span>
                  ) : (
                    theirOffer.items.map((item) => (
                      <div
                        key={`${item.id}-${item.quantity}`}
                        className="rounded border border-white/10 bg-white/5 px-2 py-1 text-left text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate">{item.name}</span>
                          <span className="text-[0.55rem] text-muted-foreground">x{item.quantity}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Gold</span>
                  <span>{theirOffer.gold || 0} gc</span>
                </div>
              </div>
            </div>
          </div>

          {error ? <p className="text-xs text-red-400">{error}</p> : null}
          {myAccepted && !theirAccepted ? (
            <p className="text-xs text-muted-foreground">Waiting for {session.partner.label}...</p>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleAccept}
            disabled={myAccepted || isSaving || isLocking}
          >
            {myAccepted ? "Accepted" : isLocking ? "Accepting..." : "Accept"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
