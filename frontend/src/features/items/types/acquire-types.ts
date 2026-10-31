import type { PurchaseLine } from "../api/purchase";
import type {
  HenchmenGroup,
  WarbandHero,
  WarbandHireling,
} from "@/features/warbands/types/warband-types";

/** What the player chose for a purchase (the store's basket line), as the purchase sends it. */
export type AcquireItemMeta = {
  isBuying: boolean;
  quantity: number;
  unitPrice: number; // Actual paid price used for trades and spend tracking.
  totalPrice: number;
  reason: string;
  baseCost: number; // Persisted on item join rows.
  /** Queued in roster edit mode: the purchase line the Save's batch sends, roll included. */
  line?: PurchaseLine;
};

/** Who receives a purchase: the stash, or a saved unit of the warband (as its list shows it). */
export type PurchaseTarget =
  | { kind: "stash" }
  | { kind: "heroes"; unit: WarbandHero }
  | { kind: "hirelings"; unit: WarbandHireling }
  | { kind: "henchmen"; unit: HenchmenGroup };
