import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { apiRequest } from "@/lib/api-client";
import { applyWarbandUpdate, type WarbandUpdate } from "@/features/warbands/api/warband-cache";
import { prependTreasuryRow } from "@/features/warbands/api/economy-queries";
import { getPersistedItemCost } from "../utils/acquire-item-costs";

import type { Item } from "../types/item-types";
import type { AcquireItemMeta, PurchaseTarget } from "../types/acquire-types";
import type {
  WarbandItemSummary,
  WarbandTrade,
  WarbandUnitsSummary,
} from "@/features/warbands/types/warband-types";

/** What the server warned about while the purchase went ahead (decisions 2 and 9). */
export type PurchaseWarning = { code: string; message: string; gold?: number; hero_id?: number };

/** A rarity roll saved with the purchase: the searching hero spends his trading action. */
export type RarityRollLine = {
  hero_id: number;
  roll: number;
  modifier: number;
  rarity: string;
  reason?: string;
  success: boolean;
};

type ApiTargetType = "stash" | "hero" | "hired_sword" | "henchmen_group";

/** `POST warbands/<id>/purchases/`'s answer: what changed, slim (BUG-07). */
export type PurchaseAnswer = {
  target_type: ApiTargetType;
  target_id: number | null;
  updated_at: string | null;
  /** The unit's items in detail shape (null for the stash). */
  items: Item[] | null;
  stash_item: WarbandItemSummary | null;
  /** The "Buy" ledger row (null for a gift or a free purchase). */
  trade: WarbandTrade | null;
  summary: WarbandUnitsSummary;
  warnings: PurchaseWarning[];
};

/** One purchase or gift: the item, who receives it and what the player chose. */
export type PurchaseRequest = {
  warbandId: number;
  target: PurchaseTarget;
  item: Item;
  meta: AcquireItemMeta;
  availabilityId?: number | null;
  /** "Buy again" (decision 11): the server charges the campaign's current price. */
  atCurrentPrice?: boolean;
  rarityRoll?: RarityRollLine | null;
};

const API_TARGETS: Record<PurchaseTarget["kind"], ApiTargetType> = {
  stash: "stash",
  heroes: "hero",
  hiredswords: "hired_sword",
  henchmen: "henchmen_group",
};

const LIST_KEYS = {
  hero: "heroes",
  hired_sword: "hiredSwords",
  henchmen_group: "henchmenGroups",
} as const;

/** The purchase line as the server takes it (also a roster batch's `purchases` entry). */
export function purchaseLine({
  item,
  meta,
  availabilityId,
  atCurrentPrice,
  rarityRoll,
}: Omit<PurchaseRequest, "warbandId" | "target">) {
  // A copy's price: what one costs when buying, the cost it keeps for resale when given.
  const price = meta.isBuying ? meta.unitPrice : getPersistedItemCost(item, meta);
  const reason = meta.reason.trim();
  return {
    item_id: item.id,
    quantity: meta.quantity,
    ...(atCurrentPrice ? {} : { price, availability_id: availabilityId ?? null }),
    is_buying: meta.isBuying,
    ...(reason ? { reason } : {}),
    ...(rarityRoll ? { rarity_roll: rarityRoll } : {}),
  };
}

/** The answer into the cache: the unit's items and version, or the stash entry; gold; the row. */
export function applyPurchaseAnswer(
  queryClient: QueryClient,
  warbandId: number,
  answer: PurchaseAnswer
) {
  const update: WarbandUpdate = {
    summary: answer.summary,
    stashItems: answer.stash_item ? [answer.stash_item] : undefined,
  };
  if (answer.target_type !== "stash" && answer.target_id !== null) {
    const unit = { id: answer.target_id, items: answer.items ?? [], updated_at: answer.updated_at };
    Object.assign(update, { [LIST_KEYS[answer.target_type]]: [unit] });
  }
  applyWarbandUpdate(queryClient, warbandId, update);
  if (answer.trade) {
    prependTreasuryRow(queryClient, warbandId, answer.trade);
  }
}

/** The server's warnings (overspend, spent searcher, failed roll): the purchase went ahead. */
export function toastPurchaseWarnings(warnings: PurchaseWarning[] = []) {
  for (const warning of warnings) {
    toast.warning(warning.message, { id: `purchase-warning-${warning.code}` });
  }
}

/**
 * Buys or gives an item in one request (BUG-07): the server writes the copies, the "Buy" row,
 * the log and any rarity roll in one transaction, refuses as a whole, and answers what changed.
 */
export async function purchase(request: PurchaseRequest, queryClient: QueryClient) {
  const { warbandId, target } = request;
  const answer = await apiRequest<PurchaseAnswer>(`/warbands/${warbandId}/purchases/`, {
    method: "POST",
    body: {
      ...purchaseLine(request),
      target_type: API_TARGETS[target.kind],
      ...(target.kind === "stash" ? {} : { target_id: target.unit.id }),
    },
  });
  applyPurchaseAnswer(queryClient, warbandId, answer);
  toastPurchaseWarnings(answer.warnings);
  return answer;
}
