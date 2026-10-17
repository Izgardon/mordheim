import { useCallback, useEffect, useRef, useState } from "react";

import { updateTradeOffer } from "@/features/campaigns/api/campaigns-api";

import type {
  TradeOffer,
  TradeRequest,
  TradeSession,
} from "@/features/warbands/types/trade-request-types";

export type DraftOffer = Required<TradeOffer>;

/** How long after the last edit the offer is saved. */
export const OFFER_SAVE_DELAY_MS = 300;

export const normalizeOffer = (offer?: TradeOffer): DraftOffer => ({
  trader_id: offer?.trader_id ?? null,
  trader_name: offer?.trader_name ?? null,
  gold: Math.max(0, Number(offer?.gold ?? 0)),
  items: Array.isArray(offer?.items) ? (offer?.items ?? []) : [],
});

const buildOfferPayload = (offer: DraftOffer, maxGold: number) => ({
  trader_id: offer.trader_id ?? null,
  gold: Math.min(Math.max(0, Number(offer.gold || 0)), maxGold),
  items: offer.items.map((item) => ({
    id: item.id,
    name: item.name,
    quantity: Math.max(0, Number(item.quantity) || 0),
  })),
});

type UseTradeOfferDraftOptions = {
  session: TradeSession | null;
  /** Your offer as the server last sent it (a save's answer or a realtime event). */
  serverOffer: DraftOffer;
  /** Your gold: the offer's gold is capped at it. */
  maxGold: number;
  /** You have accepted: the offer can't change. */
  locked: boolean;
  onSaved: (request: TradeRequest) => void;
};

/**
 * Your side of a trade while you edit it (BUG-42). An edit changes a local draft and marks it
 * dirty; the whole offer is saved a moment after the last edit, one save at a time. The server's
 * copy of your offer replaces the draft only while nothing local is unsent, so a click made
 * during the wait or while a save is in flight is never reverted, by a save's answer, a partner's
 * event or a change of your gold. A failed save keeps the draft and retries on the next edit.
 */
export function useTradeOfferDraft({
  session,
  serverOffer,
  maxGold,
  locked,
  onSaved,
}: UseTradeOfferDraftOptions) {
  const [draft, setDraft] = useState<DraftOffer>(serverOffer);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  const [error, setError] = useState("");
  // Counts edits, so a save's answer knows whether the draft changed while it was in flight.
  const editCount = useRef(0);
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;

  // Another trade starts from its own server copy, never from an earlier trade's unsent draft.
  const campaignId = session?.campaignId;
  const requestId = session?.requestId;
  const [draftRequestId, setDraftRequestId] = useState(requestId);
  if (draftRequestId !== requestId) {
    setDraftRequestId(requestId);
    setDraft(serverOffer);
    setIsDirty(false);
    setHasFailed(false);
    setError("");
  }

  useEffect(() => {
    if (!isDirty) {
      setDraft(serverOffer);
    }
  }, [isDirty, serverOffer]);

  const edit = useCallback(
    (update: (offer: DraftOffer) => DraftOffer) => {
      if (locked) {
        return;
      }
      editCount.current += 1;
      setDraft(update);
      setIsDirty(true);
      setHasFailed(false);
    },
    [locked]
  );

  useEffect(() => {
    if (!isDirty || isSaving || hasFailed || locked || campaignId === undefined || !requestId) {
      return;
    }
    const timeout = window.setTimeout(() => {
      const sentAt = editCount.current;
      setIsSaving(true);
      updateTradeOffer(campaignId, requestId, buildOfferPayload(draft, maxGold))
        .then((request) => {
          setError("");
          // Nothing was edited while this save was out, so the server's copy is the draft.
          if (editCount.current === sentAt) {
            setIsDirty(false);
          }
          onSavedRef.current(request);
        })
        .catch((err) => {
          setHasFailed(true);
          setError(err instanceof Error && err.message ? err.message : "Unable to update offer.");
        })
        .finally(() => setIsSaving(false));
    }, OFFER_SAVE_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, [campaignId, draft, hasFailed, isDirty, isSaving, locked, maxGold, requestId]);

  return { draft, edit, isDirty, isSaving, error };
}
