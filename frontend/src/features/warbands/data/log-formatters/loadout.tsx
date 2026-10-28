import { payloadOf, renderGoldBadge, type LogFormatter } from "./badges";

import type { WarbandLog } from "../../types/warband-types";

type LoadoutItemPayload = {
  hero?: string;
  warband?: string;
  item?: string;
  quantity?: number;
  price?: number;
  reason?: string;
};

type LoadoutItemFormatterOptions = {
  reasonFallback?: string;
  /** Replaces "{actor} received:" (a stash entry names no unit). */
  lead?: string;
};

/** "<unit> received: <item> x <n>" with the price paid, or the gift's reason. */
const formatLoadoutItem = (
  log: WarbandLog,
  { reasonFallback, lead }: LoadoutItemFormatterOptions = {}
) => {
  const payload = payloadOf<LoadoutItemPayload>(log);
  const actor = payload.hero || payload.warband || "Warband";
  const leadText = lead ?? `${actor} received:`;
  const quantity = Number(payload.quantity ?? 1);
  const itemName = payload.item || "Unknown Item";
  const itemLabel =
    Number.isFinite(quantity) && quantity > 1 ? `${itemName} x ${quantity}` : itemName;
  const itemPrice = Number(payload.price ?? 0);
  const rawReason = typeof payload.reason === "string" ? payload.reason.trim() : "";
  const reasonText = rawReason || reasonFallback || "";

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span>
        {leadText} {itemLabel}
      </span>
      {Number.isFinite(itemPrice) && itemPrice > 0 ? (
        <span className="inline-flex items-center gap-1">
          <span>(</span>
          {renderGoldBadge(itemPrice)}
          <span>)</span>
        </span>
      ) : reasonText ? (
        <span>({reasonText})</span>
      ) : null}
    </span>
  );
};

/** Items bought or given to a unit or the stash. */
export const LOADOUT_FORMATTERS: Record<string, LogFormatter> = {
  "loadout:hero_item": (log) => formatLoadoutItem(log, { reasonFallback: "No reason given" }),
  "loadout:henchmen_item": (log) => formatLoadoutItem(log),
  "loadout:stash_item": (log) => formatLoadoutItem(log, { lead: "Added to the stash:" }),
  "loadout:hireling_item": (log) => formatLoadoutItem(log, { reasonFallback: "No reason given" }),
};
