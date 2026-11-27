import type { PurchaseTarget } from "../types/acquire-types";
import type { Item } from "../types/item-types";

/** Who a store purchase goes to: the stash or a unit; a group gets one copy per member. */
export type Recipient = { key: string; label: string; target: PurchaseTarget; count: number };

/** One line of the basket: the item, who gets it and at what price (each), or free with a reason. */
export type BasketLine = {
  id: number;
  /** Its purchase's key (lib/request-key.ts): kept while Buy all is tried again, new when edited. */
  requestKey: string;
  item: Item;
  availabilityId: number | null;
  /** The availability's cost: what a gift keeps for its resale price. */
  baseCost: number;
  recipient: Recipient;
  price: number;
  free: boolean;
  reason: string;
  /** The total rolled for a price with dice ("25 + 2D6"), sent with its row. */
  diceRoll?: number | null;
  /** The price is the row's (with its roll): the server works it out. Off once it is edited. */
  rowPrice?: boolean;
  /** What the weapon is made of (weapon materials): "" for plain, with the word for its name. */
  material?: string;
  materialName?: string;
};

/** An upgrade of the warband's template for a hero (the templates plan, phase 3), at its price. */
export type UpgradeBasketLine = {
  id: number;
  requestKey: string;
  upgrade: { id: number; name: string; group: string; specialId: number };
  recipient: Recipient;
  price: number;
  free: false;
  reason: "";
};

/** What the basket holds: items, and upgrades bought onto a hero. */
export type AnyBasketLine = BasketLine | UpgradeBasketLine;
/** A line as a row picks it: the basket gives it its id and request key. */
export type NewItemBasketLine = Omit<BasketLine, "id" | "requestKey">;
export type NewBasketLine = NewItemBasketLine | Omit<UpgradeBasketLine, "id" | "requestKey">;

export const isUpgradeLine = (line: AnyBasketLine | NewBasketLine): line is UpgradeBasketLine =>
  "upgrade" in line;

/** The line's name: the item's (with what it is made of), or the upgrade's. */
export const lineName = (line: AnyBasketLine) =>
  isUpgradeLine(line) ? line.upgrade.name : materialName(line);

/** "Gromril Sword": the material in front of the item's name (weapon materials). */
const materialName = (line: BasketLine) => {
  const name = line.materialName ?? "";
  return name ? `${name} ${line.item.name}` : line.item.name;
};
