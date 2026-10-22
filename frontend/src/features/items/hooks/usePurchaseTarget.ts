import { useEffect, useMemo, useState } from "react";

import { listWarbandHenchmenGroups } from "@/features/warbands/api/warbands-api";
import { useActingWarband } from "@/features/warbands/components/warband/shown-warband-context";

import type { UnitSelectEntry, UnitTypeOption } from "@components/unit-selection-section";
import type { HenchmenGroup } from "@/features/warbands/types/warband-types";
import type { DraftUnit, PurchaseTarget } from "../types/acquire-types";

/** Who can receive an item, in the order the receiver picker offers them. */
export const UNIT_TYPES: UnitTypeOption[] = ["heroes", "hirelings", "henchmen", "stash"];

/**
 * How many copies to suggest for a henchmen group: enough to reach the next multiple of the
 * group's size (one per member), at least one.
 */
export function henchmenQuantityFor(group: HenchmenGroup, itemId: number) {
  const members = (group.henchmen ?? []).length;
  const owned = (group.items ?? []).filter((entry) => entry.id === itemId).length;
  if (members <= 0) {
    return 1;
  }
  const needed =
    owned > members ? (Math.floor(owned / members) + 1) * members - owned : members - owned;
  return needed > 0 ? needed : 1;
}

/** Why a purchase can't go to the chosen unit, or the unit it goes to (null: drop it silently). */
export type ResolvedTarget = { target: PurchaseTarget } | { error: string } | null;

type UsePurchaseTargetOptions = {
  open: boolean;
  presetUnitType?: UnitTypeOption;
  presetUnitId?: number | string;
  draftUnit?: DraftUnit;
  itemId: number;
  /** Suggest a henchmen group's quantity (Buy again). */
  autoQuantity: boolean;
};

/**
 * Who receives the item: the warband on screen (or, on the Items page, your own), its units as
 * receivers, and the chosen one. Henchmen groups are read when the dialog opens.
 */
export function usePurchaseTarget({
  open,
  presetUnitType,
  presetUnitId,
  draftUnit,
  itemId,
  autoQuantity,
}: UsePurchaseTargetOptions) {
  // The warband on screen (or, on the Items page, your own): it is stocked and charged (BUG-107).
  const warband = useActingWarband();
  const [selectedUnitType, setSelectedUnitType] = useState<UnitTypeOption | "">("");
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [henchmenGroups, setHenchmenGroups] = useState<HenchmenGroup[]>([]);
  const heroes = warband?.heroes;
  const hirelings = warband?.hirelings;
  const heroUnits = useMemo(() => heroes ?? [], [heroes]);
  const hirelingUnits = useMemo(() => hirelings ?? [], [hirelings]);

  const resolvedUnitType = (selectedUnitType || presetUnitType || "") as UnitTypeOption | "";
  const resolvedUnitId =
    selectedUnitId ||
    (presetUnitId !== undefined && presetUnitId !== null ? String(presetUnitId) : "");

  useEffect(() => {
    if (!open || !warband) {
      return;
    }
    let active = true;
    listWarbandHenchmenGroups(warband.id)
      .then((data) => {
        if (active) setHenchmenGroups(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [open, warband]);

  useEffect(() => {
    if (open && !selectedUnitType && !presetUnitType) {
      setSelectedUnitType(UNIT_TYPES[0]);
    }
  }, [open, selectedUnitType, presetUnitType]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (presetUnitType) {
      setSelectedUnitType(presetUnitType);
    }
    if (presetUnitId !== undefined && presetUnitId !== null) {
      setSelectedUnitId(String(presetUnitId));
    }
  }, [open, presetUnitType, presetUnitId]);

  const units = useMemo<UnitSelectEntry[]>(() => {
    const lists: Partial<Record<UnitTypeOption, UnitSelectEntry[]>> = {
      heroes: heroUnits,
      hirelings: hirelingUnits,
      henchmen: henchmenGroups,
    };
    const base = resolvedUnitType ? lists[resolvedUnitType] : undefined;
    if (!base) {
      return [];
    }
    return draftUnit && draftUnit.unitType === resolvedUnitType
      ? [
          ...base,
          {
            id: draftUnit.id,
            name: draftUnit.name ?? null,
            unit_type: draftUnit.unit_type ?? null,
          },
        ]
      : base;
  }, [resolvedUnitType, draftUnit, heroUnits, hirelingUnits, henchmenGroups]);

  const selectedUnitLabel = useMemo(() => {
    if (!resolvedUnitType) {
      return "";
    }
    if (resolvedUnitType === "stash") {
      return "Warband Stash";
    }
    return units.find((unit) => String(unit.id) === resolvedUnitId)?.name ?? "";
  }, [resolvedUnitId, resolvedUnitType, units]);

  const canProceed =
    Boolean(resolvedUnitType) && (resolvedUnitType === "stash" || Boolean(resolvedUnitId));

  const suggestedGroup =
    autoQuantity && resolvedUnitType === "henchmen" && resolvedUnitId
      ? henchmenGroups.find((group) => group.id === Number(resolvedUnitId))
      : undefined;
  const suggestedQuantity = suggestedGroup ? henchmenQuantityFor(suggestedGroup, itemId) : null;

  /** The saved unit the purchase goes to, as its list shows it. */
  const resolve = (): ResolvedTarget => {
    if (resolvedUnitType === "stash") {
      return { target: { kind: "stash" } };
    }
    const unitId = Number(resolvedUnitId);
    if (resolvedUnitType === "hirelings") {
      if (Number.isNaN(unitId)) return { error: "Select a saved hired sword." };
      const unit = hirelingUnits.find((entry) => entry.id === unitId);
      return unit ? { target: { kind: "hirelings", unit } } : null;
    }
    if (resolvedUnitType === "henchmen") {
      if (Number.isNaN(unitId)) return { error: "Select a saved henchmen group." };
      const unit = henchmenGroups.find((entry) => entry.id === unitId);
      return unit ? { target: { kind: "henchmen", unit } } : null;
    }
    if (Number.isNaN(unitId)) return { error: "Select a saved hero." };
    const unit = heroUnits.find((entry) => entry.id === unitId);
    return unit ? { target: { kind: "heroes", unit } } : null;
  };

  /** No receiver chosen, as the dialog closes. */
  const reset = () => {
    setSelectedUnitType("");
    setSelectedUnitId("");
    setHenchmenGroups([]);
  };

  return {
    warband,
    heroUnits,
    resolvedUnitType,
    resolvedUnitId,
    setSelectedUnitType,
    setSelectedUnitId,
    units,
    selectedUnitLabel,
    canProceed,
    suggestedQuantity,
    resolve,
    reset,
  };
}
