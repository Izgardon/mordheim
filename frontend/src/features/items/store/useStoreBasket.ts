import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type {
  HenchmenGroup,
  WarbandHero,
  WarbandHireling,
} from "@/features/warbands/types/warband-types";
import { getErrorMessage } from "@/lib/get-error-message";

import { purchase } from "../api/purchase";
import type { PurchaseTarget } from "../types/acquire-types";
import type { Item } from "../types/item-types";

/** Who a store purchase goes to: the stash or a unit; a group gets one copy per member. */
export type Recipient = { key: string; label: string; target: PurchaseTarget; count: number };

/** One line of the basket: the item, who gets it and at what price (each), or free with a reason. */
export type BasketLine = {
  id: number;
  item: Item;
  availabilityId: number | null;
  /** The availability's cost: what a gift keeps for its resale price. */
  baseCost: number;
  recipient: Recipient;
  price: number;
  free: boolean;
  reason: string;
};

const nameOf = (unit: { name?: string | null; unit_type?: string | null }, fallback: string) =>
  unit.name?.trim() || unit.unit_type?.trim() || fallback;

/** A unit's recipient key, as the warband page names the unit the store was opened for. */
export const recipientKey = (kind: "hero" | "henchmen_group" | "hireling", id: number) =>
  `${kind === "hero" ? "heroes" : kind === "henchmen_group" ? "henchmen" : "hirelings"}:${id}`;

/**
 * Everyone who can receive an item: the stash, the heroes, the henchmen groups (×members) and the
 * hired swords; the unit the store was opened for comes first.
 */
export function recipientsFor(
  units: { heroes: WarbandHero[]; henchmenGroups: HenchmenGroup[]; hirelings: WarbandHireling[] },
  firstKey: string | null
): Recipient[] {
  const all: Recipient[] = [
    { key: "stash", label: "Stash", target: { kind: "stash" }, count: 1 },
    ...units.heroes.map((unit) => ({
      key: `heroes:${unit.id}`,
      label: nameOf(unit, "Hero"),
      target: { kind: "heroes" as const, unit },
      count: 1,
    })),
    ...units.henchmenGroups.map((unit) => ({
      key: `henchmen:${unit.id}`,
      label: nameOf(unit, "Henchmen"),
      target: { kind: "henchmen" as const, unit },
      count: Math.max(1, unit.henchmen?.length ?? 1),
    })),
    ...units.hirelings.map((unit) => ({
      key: `hirelings:${unit.id}`,
      label: nameOf(unit, "Hired sword"),
      target: { kind: "hirelings" as const, unit },
      count: 1,
    })),
  ];
  const first = all.find((entry) => entry.key === firstKey);
  return first ? [first, ...all.filter((entry) => entry !== first)] : all;
}

/** What a line costs: nothing when free, its price for each copy otherwise. */
export const lineTotal = (line: Pick<BasketLine, "free" | "price" | "recipient">) =>
  line.free ? 0 : line.price * line.recipient.count;

/**
 * The store's basket: lines added from the rows, their prices edited or removed, and Buy all,
 * which sends one purchase per line (today's POST purchases/) in order, stops at the first one
 * the server refuses and keeps the lines not bought.
 */
export function useStoreBasket(warbandId: number) {
  const queryClient = useQueryClient();
  const [lines, setLines] = useState<BasketLine[]>([]);
  const [buying, setBuying] = useState(false);
  const [nextId, setNextId] = useState(1);

  const add = (line: Omit<BasketLine, "id">) => {
    setLines((current) => [...current, { ...line, id: nextId }]);
    setNextId((id) => id + 1);
  };
  const remove = (id: number) => setLines((current) => current.filter((line) => line.id !== id));
  const setPrice = (id: number, price: number) =>
    setLines((current) => current.map((line) => (line.id === id ? { ...line, price } : line)));

  const buyAll = async () => {
    setBuying(true);
    let bought = 0;
    try {
      for (const line of lines) {
        const quantity = line.recipient.count;
        await purchase(
          {
            warbandId,
            target: line.recipient.target,
            item: line.item,
            availabilityId: line.availabilityId,
            meta: {
              isBuying: !line.free,
              quantity,
              unitPrice: line.price,
              totalPrice: lineTotal(line),
              reason: line.free ? line.reason.trim() || "Found or given" : "",
              baseCost: line.baseCost,
            },
          },
          queryClient
        );
        bought += 1;
        setLines((current) => current.filter((entry) => entry.id !== line.id));
      }
      return true;
    } catch (error) {
      toast.error(bought ? `Bought ${bought}; the rest didn't go through.` : "Couldn't buy that.", {
        description: getErrorMessage(error),
      });
      return false;
    } finally {
      setBuying(false);
    }
  };

  return {
    lines,
    add,
    remove,
    setPrice,
    buyAll,
    buying,
    total: lines.reduce((sum, line) => sum + lineTotal(line), 0),
  };
}

export type StoreBasket = ReturnType<typeof useStoreBasket>;
