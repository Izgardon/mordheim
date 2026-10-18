import type { UnitTypeOption } from "@components/unit-selection-section";
import type { PurchaseLine } from "../api/purchase";
import type {
  HenchmenGroup,
  WarbandHero,
  WarbandHiredSword,
} from "@/features/warbands/types/warband-types";

/** What the player chose in the acquire dialog, as the purchase and its callers see it. */
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

/** A unit being created in the roster editor, offered as a receiver before it is saved. */
export type DraftUnit = {
  unitType: UnitTypeOption;
  id: string;
  name?: string | null;
  unit_type?: string | null;
};

/** Who receives a purchase: the stash, or a saved unit of the warband (as its list shows it). */
export type PurchaseTarget =
  | { kind: "stash" }
  | { kind: "heroes"; unit: WarbandHero }
  | { kind: "hiredswords"; unit: WarbandHiredSword }
  | { kind: "henchmen"; unit: HenchmenGroup };

/** A rarity roll as the dialog keeps it for the searching hero. */
export type HeroRarityRoll = {
  total: number;
  modifier: number;
  finalTotal: number;
  success: boolean;
  /** Why the modifier was added, when it was. */
  reason?: string;
};

/** A hero offered as the searcher of a rare item. */
export type HeroOption = {
  id: number | string;
  name?: string | null;
  trading_action?: boolean | null;
};
