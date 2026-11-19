import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { getErrorMessage } from "@/lib/get-error-message";

import { switchCompanion } from "../../api/beasts-api";
import {
  useItemMaterial,
  useItemMove,
  useItemSale,
  itemMutationUpdate,
} from "../../api/economy-queries";
import { useWarbandCacheUpdate, type WarbandUpdate } from "../../api/warband-cache";
import { LIST_KEY, type RosterUnit } from "../../components/roster/unit-view";
import { unitApi, type AdvancePick } from "../../units/unit-api";
import { toastServerWarnings } from "../../utils/server-warnings";
import type { UnitKindKey, UnitPayload } from "../../types/units";
import type { WarbandUnitDetail } from "../../types/warband-types";

type PatchVars = { entry: RosterUnit; patch: Partial<UnitPayload<UnitKindKey>> };

/** Where an item sits, for the item endpoints. */
export type ItemPlace = { type: UnitKindKey | "stash"; id?: number | null };

/**
 * The warband page's one-click unit actions: a field patch (XP, the trading action), a pick an
 * advance left for later, switching a mount on or off, and moving or selling an item. Each answer goes straight into the cached sheet.
 */
export function useUnitActions(warbandId: number) {
  const updateCache = useWarbandCacheUpdate();
  const itemMove = useItemMove(warbandId);
  const itemSale = useItemSale(warbandId);
  const itemMaterial = useItemMaterial(warbandId);
  const fail = (what: string) => (error: unknown) =>
    toast.error(what, { description: getErrorMessage(error) });

  const patch = useMutation({
    mutationFn: ({ entry, patch: body }: PatchVars) =>
      unitApi(entry.kind).update(warbandId, entry.unit.id, body as never),
    onSuccess: (unit, { entry }) =>
      updateCache(warbandId, { [LIST_KEY[entry.kind]]: [unit] } as WarbandUpdate),
    onError: fail("That change didn't save."),
  });

  const pick = useMutation({
    mutationFn: ({ entry, pick: chosen }: { entry: RosterUnit; pick: AdvancePick }) =>
      unitApi(entry.kind).pick(warbandId, entry.unit.id, chosen),
    onSuccess: (unit, { entry }) =>
      updateCache(warbandId, { [LIST_KEY[entry.kind]]: [unit] } as WarbandUpdate),
    onError: fail("That pick didn't save."),
  });

  const ride = useMutation({
    mutationFn: ({ entry, rowId, on }: { entry: RosterUnit; rowId: number; on: boolean }) =>
      switchCompanion(warbandId, entry.kind, entry.unit.id, rowId, on),
    onSuccess: ({ unit, summary, warnings }, { entry }) => {
      updateCache(warbandId, { [LIST_KEY[entry.kind]]: [unit], summary } as WarbandUpdate);
      toastServerWarnings(warnings);
    },
    onError: fail("Couldn't switch the mount."),
  });

  const sourceOf = (entry: RosterUnit) => ({
    listKey: LIST_KEY[entry.kind],
    units: [] as WarbandUnitDetail[],
  });

  /** Moves copies of an item to another unit or to the stash; `material` names which copies. */
  const moveItem = (
    from: RosterUnit | null,
    itemId: number,
    to: ItemPlace,
    quantity = 1,
    material = ""
  ) =>
    itemMove.mutate(
      {
        source_type: from ? from.kind : "stash",
        source_id: from?.unit.id ?? null,
        target_type: to.type,
        target_id: to.id ?? null,
        item_id: itemId,
        quantity,
        material,
      },
      {
        onSuccess: (result) =>
          updateCache(
            warbandId,
            itemMutationUpdate(
              { ...result, targetUnitType: to.type === "stash" ? "stash" : SECTION[to.type] },
              from ? sourceOf(from) : undefined
            )
          ),
        onError: fail("Couldn't move the item."),
      }
    );

  /** Sells copies of an item from a unit or the stash; `material` names which copies. */
  const sellItem = (
    from: RosterUnit | null,
    itemId: number,
    price: number,
    quantity = 1,
    material = ""
  ) =>
    itemSale.mutate(
      {
        source_type: from ? from.kind : "stash",
        source_id: from?.unit.id ?? null,
        item_id: itemId,
        quantity,
        price,
        material,
      },
      {
        onSuccess: (result) =>
          updateCache(warbandId, itemMutationUpdate(result, from ? sourceOf(from) : undefined)),
        onError: fail("Couldn't sell the item."),
      }
    );

  /**
   * Puts a material on a weapon the warband already owns (weapon materials): the server charges
   * what the material asks and may warn that the warband went below 0.
   */
  const materialItem = (from: RosterUnit | null, itemId: number, material: string) =>
    itemMaterial.mutate(
      {
        source_type: from ? from.kind : "stash",
        source_id: from?.unit.id ?? null,
        item_id: itemId,
        material,
      },
      {
        onSuccess: (result) => {
          updateCache(warbandId, itemMutationUpdate(result, from ? sourceOf(from) : undefined));
          toastServerWarnings(result.warnings ?? []);
        },
        onError: fail("Couldn't change what it is made of."),
      }
    );

  return {
    patchUnit: (entry: RosterUnit, body: PatchVars["patch"]) =>
      patch.mutate({ entry, patch: body }),
    /** A pick an advance left for later ("Skill to choose"). */
    pickLater: (entry: RosterUnit, chosen: AdvancePick) => pick.mutate({ entry, pick: chosen }),
    rideMount: (entry: RosterUnit, rowId: number, on: boolean) => ride.mutate({ entry, rowId, on }),
    moveItem,
    sellItem,
    materialItem,
    isBusy:
      patch.isPending ||
      ride.isPending ||
      itemMove.isPending ||
      itemSale.isPending ||
      itemMaterial.isPending,
  };
}

const SECTION: Record<UnitKindKey, string> = {
  hero: "heroes",
  henchmen_group: "henchmen",
  hireling: "hirelings",
};
