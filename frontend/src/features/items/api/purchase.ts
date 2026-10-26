import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { apiRequest } from "@/lib/api-client";
import {
  applyWarbandUpdate,
  markLedgerStale,
  setHeroTradingAction,
  type WarbandUpdate,
} from "@/features/warbands/api/warband-cache";
import { prependTreasuryRow } from "@/features/warbands/api/economy-queries";
import { getPersistedItemCost } from "../utils/acquire-item-costs";

import type { Item } from "../types/item-types";
import type { RecruitTarget } from "@/features/warbands/api/beasts-api";
import type { UnitCompanionFields } from "@/features/warbands/types/companion-types";
import type { AcquireItemMeta, PurchaseTarget } from "../types/acquire-types";
import type {
  HenchmenGroup,
  WarbandItemSummary,
  WarbandTrade,
  WarbandUnitsSummary,
} from "@/features/warbands/types/warband-types";

/** What the server warned about while the purchase went ahead (decisions 2 and 9). */
/** A purchase went ahead with a warning; `archived_entry` names the archived item (`item_id`). */
export type PurchaseWarning = {
  code: string;
  message: string;
  gold?: number;
  hero_id?: number;
  item_id?: number;
};

/** A rarity roll saved with the purchase: the searching hero spends his trading action. */
export type RarityRollLine = {
  hero_id: number;
  roll: number;
  modifier: number;
  rarity: string;
  reason?: string;
  success: boolean;
};

type ApiTargetType = "stash" | "hero" | "hireling" | "henchmen_group";

/**
 * `POST warbands/<id>/purchases/`'s answer: what changed, slim (BUG-07). A unit target's
 * `mount`, `pets` and `effective_stats` (and a group's `mounts`) describe it after the purchase;
 * a recruit's `group` is the group the copies joined or formed.
 */
export type PurchaseAnswer = UnitCompanionFields & {
  target_type: ApiTargetType;
  target_id: number | null;
  updated_at: string | null;
  /** The unit's items in detail shape (null for the stash). */
  items: Item[] | null;
  stash_item: WarbandItemSummary | null;
  group?: HenchmenGroup | null;
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
  /** A mount or pet bought for a unit: every copy lands switched on for it. */
  companion?: boolean;
  /** A creature bought for the stash: recruited straight away instead (POST purchases/ only). */
  recruit?: RecruitTarget | null;
};

const API_TARGETS: Record<PurchaseTarget["kind"], ApiTargetType> = {
  stash: "stash",
  heroes: "hero",
  hirelings: "hireling",
  henchmen: "henchmen_group",
};

const LIST_KEYS = {
  hero: "heroes",
  hireling: "hirelings",
  henchmen_group: "henchmenGroups",
} as const;

/** The purchase line as the server takes it (also a roster batch's `purchases` entry). */
export function purchaseLine({
  item,
  meta,
  availabilityId,
  atCurrentPrice,
  rarityRoll,
  companion,
}: Omit<PurchaseRequest, "warbandId" | "target" | "recruit">) {
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
    ...(companion ? { companion: true } : {}),
  };
}

export type PurchaseLine = ReturnType<typeof purchaseLine>;

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
    const { mount, pets, effective_stats, mounts } = answer;
    const unit = {
      id: answer.target_id,
      items: answer.items ?? [],
      updated_at: answer.updated_at,
      ...(answer.mount !== undefined ? { mount, pets, effective_stats } : {}),
      // A group's every kind of mount: its list of mount entries reads these, not `mount`.
      ...(mounts !== undefined ? { mounts } : {}),
    };
    Object.assign(update, { [LIST_KEYS[answer.target_type]]: [unit] });
  }
  if (answer.group) {
    update.henchmenGroups = [...(update.henchmenGroups ?? []), answer.group];
  }
  applyWarbandUpdate(queryClient, warbandId, update);
  if (answer.trade) {
    prependTreasuryRow(queryClient, warbandId, answer.trade);
  }
}

/**
 * The server's warnings (overspend, spent searcher, failed roll, an archived item bought from a
 * stale list): the purchase went ahead. One toast per code, and per item for an item's warning.
 */
export function toastPurchaseWarnings(warnings: PurchaseWarning[] = []) {
  for (const warning of warnings) {
    const item = warning.item_id ? `-${warning.item_id}` : "";
    toast.warning(warning.message, { id: `purchase-warning-${warning.code}${item}` });
  }
}

/**
 * Buys or gives an item in one request (BUG-07): the server writes the copies, the "Buy" row,
 * the log and any rarity roll in one transaction, refuses as a whole, and answers what changed.
 */
export async function purchase(request: PurchaseRequest, queryClient: QueryClient) {
  const { warbandId, target, recruit } = request;
  const answer = await apiRequest<PurchaseAnswer>(`/warbands/${warbandId}/purchases/`, {
    method: "POST",
    body: {
      ...purchaseLine(request),
      target_type: API_TARGETS[target.kind],
      ...(target.kind === "stash" ? {} : { target_id: target.unit.id }),
      ...(recruit ? { recruit } : {}),
    },
  });
  applyPurchaseAnswer(queryClient, warbandId, answer);
  toastPurchaseWarnings(answer.warnings);
  return answer;
}

/**
 * A search that ended without a purchase (decision 9): the server spends the hero's trading
 * action and logs the roll. Its warnings (a spent searcher, a failed roll) show as toasts.
 */
export async function saveRarityRoll(
  queryClient: QueryClient,
  warbandId: number,
  roll: RarityRollLine & { item_id: number }
) {
  const answer = await apiRequest<{ hero_id: number; warnings: PurchaseWarning[] }>(
    `/warbands/${warbandId}/rarity-rolls/`,
    { method: "POST", body: roll }
  );
  setHeroTradingAction(queryClient, warbandId, answer.hero_id, false);
  markLedgerStale(queryClient, warbandId);
  toastPurchaseWarnings(answer.warnings);
  return answer;
}
