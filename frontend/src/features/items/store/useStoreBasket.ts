import { useState, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type {
  HenchmenGroup,
  WarbandHero,
  WarbandHireling,
} from "@/features/warbands/types/warband-types";
import { isCreatureGroup } from "@/features/warbands/utils/companions";
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
  /** The total rolled for a price with dice ("25 + 2D6"), sent with its row. */
  diceRoll?: number | null;
  /** The price is the row's (with its roll): the server works it out. Off once it is edited. */
  rowPrice?: boolean;
};

const nameOf = (unit: { name?: string | null; unit_type?: string | null }, fallback: string) =>
  unit.name?.trim() || unit.unit_type?.trim() || fallback;

/** A unit's recipient key, as the warband page names the unit the store was opened for. */
export const recipientKey = (kind: "hero" | "henchmen_group" | "hireling", id: number) =>
  `${kind === "hero" ? "heroes" : kind === "henchmen_group" ? "henchmen" : "hirelings"}:${id}`;

/**
 * Everyone who can receive an item: the stash, the heroes, the henchmen groups (×members, not a
 * group of creatures, which carries nothing) and the hired swords; the unit the store was opened
 * for comes first.
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
    ...units.henchmenGroups
      .filter((unit) => !isCreatureGroup(unit))
      .map((unit) => ({
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

/** A warband's basket: its lines and the id the next line takes. */
type BasketState = { lines: BasketLine[]; nextId: number };

const EMPTY_BASKET: BasketState = { lines: [], nextId: 1 };
const baskets = new Map<number, BasketState>();
const listeners = new Set<() => void>();
const storageKey = (warbandId: number) => `mordheim:basket:${warbandId}`;

/**
 * A warband's basket, read once from this tab's session storage: one basket per warband, shared by
 * the warband page's store and Wargear's Get this item, kept until it is bought or the tab closes.
 */
function readBasket(warbandId: number): BasketState {
  const known = baskets.get(warbandId);
  if (known) return known;
  let state = EMPTY_BASKET;
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey(warbandId)) ?? "null");
    if (Array.isArray(saved?.lines)) {
      state = { lines: saved.lines, nextId: Number(saved.nextId) || saved.lines.length + 1 };
    }
  } catch {
    // No storage (a private window, blocked site data): the basket lives in memory only.
  }
  baskets.set(warbandId, state);
  return state;
}

function writeBasket(warbandId: number, update: (state: BasketState) => BasketState) {
  const next = update(readBasket(warbandId));
  baskets.set(warbandId, next);
  try {
    if (next.lines.length) sessionStorage.setItem(storageKey(warbandId), JSON.stringify(next));
    else sessionStorage.removeItem(storageKey(warbandId));
  } catch {
    // Kept in memory for this visit.
  }
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * The store's basket: lines added from the rows, their prices edited or removed, and Buy all,
 * which sends one purchase per line (today's POST purchases/) in order, stops at the first one
 * the server refuses and keeps the lines not bought. Every store panel of a warband shares it.
 */
export function useStoreBasket(warbandId: number) {
  const queryClient = useQueryClient();
  const { lines } = useSyncExternalStore(subscribe, () => readBasket(warbandId));
  const [buying, setBuying] = useState(false);
  const setLines = (update: (current: BasketLine[]) => BasketLine[]) =>
    writeBasket(warbandId, (state) => ({ ...state, lines: update(state.lines) }));

  const add = (line: Omit<BasketLine, "id">) =>
    writeBasket(warbandId, (state) => ({
      lines: [...state.lines, { ...line, id: state.nextId }],
      nextId: state.nextId + 1,
    }));
  const remove = (id: number) => setLines((current) => current.filter((line) => line.id !== id));
  const setPrice = (id: number, price: number) =>
    setLines((current) =>
      current.map((line) => (line.id === id ? { ...line, price, rowPrice: false } : line))
    );

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
            diceRoll: line.diceRoll ?? null,
            rowPrice: Boolean(line.rowPrice) && !line.free,
            // A mount bought for a unit lands ridden; in the stash it is carried.
            companion: line.recipient.target.kind !== "stash" && line.item.beast_kind === "mount",
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
