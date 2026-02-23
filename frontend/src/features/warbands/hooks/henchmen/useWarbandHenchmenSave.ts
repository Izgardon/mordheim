import { useState, type RefObject } from "react";

import {
  createWarbandHenchmenGroup,
  deleteWarbandHenchmenGroup,
  listWarbandHenchmenGroups,
  updateWarbandHenchmenGroup,
} from "@/features/warbands/api/warbands-api";
import { emitWarbandUpdate } from "@/features/warbands/api/warbands-events";
import {
  buildHenchmenGroupStatPayload,
  toNullableNumber,
  validateHenchmenGroupForm,
} from "@/features/warbands/utils/warband-utils";
import { commitPendingPurchases, type PendingPurchase } from "@/features/warbands/utils/pending-purchases";
import { getHenchmenItemMultiplier } from "../../components/henchmen/utils/henchmen-cost";

import type { Item } from "@/features/items/types/item-types";

import type {
  HenchmenGroup,
  HenchmenGroupFormEntry,
} from "@/features/warbands/types/warband-types";
import type { NewHenchmenGroupForm } from "./useHenchmenGroupCreationForm";

type UseWarbandHenchmenSaveParams = {
  warbandId: number | null;
  canEdit: boolean;
  groupForms: HenchmenGroupFormEntry[];
  removedGroupIds: number[];
  isAddingGroupForm: boolean;
  newGroupForm: NewHenchmenGroupForm;
  raceQuery: string;
  originalGroupFormsRef: RefObject<Map<number, string>>;
  onSuccess: (refreshedGroups: HenchmenGroup[]) => void;
  pendingPurchases?: PendingPurchase[];
  onPendingCleared?: () => void;
};

const computeItemsWithNewHenchmen = (group: { items: Item[]; henchmen: { id?: number | null; includeItems?: boolean }[] }): { id: number; cost: number | null }[] => {
  const toEntry = (item: Item) => ({ id: item.id, cost: item.cost ?? null });
  const newHenchmen = group.henchmen.filter((h) => !h.id);
  if (newHenchmen.length === 0) {
    return group.items.map(toEntry);
  }
  const baseCount = group.henchmen.length - newHenchmen.length;
  let items: Item[] = [...group.items];
  for (let i = 0; i < newHenchmen.length; i += 1) {
    if (newHenchmen[i].includeItems === false) continue;
    const currentCount = baseCount + i;
    if (currentCount <= 0 || items.length === 0) continue;
    const itemCounts: Record<number, { item: Item; count: number }> = {};
    for (const item of items) {
      if (itemCounts[item.id]) {
        itemCounts[item.id].count += 1;
      } else {
        itemCounts[item.id] = { item, count: 1 };
      }
    }
    const toAdd: Item[] = [];
    for (const { item, count } of Object.values(itemCounts)) {
      const perHenchman = getHenchmenItemMultiplier(count, currentCount);
      for (let j = 0; j < perHenchman; j += 1) {
        toAdd.push(item);
      }
    }
    items = [...items, ...toAdd];
  }
  return items.map(toEntry);
};

export function useWarbandHenchmenSave({
  warbandId,
  canEdit,
  groupForms,
  removedGroupIds,
  isAddingGroupForm,
  newGroupForm,
  raceQuery,
  originalGroupFormsRef,
  onSuccess,
  pendingPurchases = [],
  onPendingCleared,
}: UseWarbandHenchmenSaveParams) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [hasAttemptedSave, setHasAttemptedSave] = useState(false);

  const normalizeHenchmanCost = (value: unknown) => {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }
    if (typeof value === "string") {
      return toNullableNumber(value);
    }
    return null;
  };

  const handleSaveChanges = async () => {
    if (!warbandId || !canEdit) {
      return;
    }

    const isGroupDraftDirty =
      isAddingGroupForm &&
      (newGroupForm.name.trim() ||
        newGroupForm.unit_type.trim() ||
        raceQuery.trim() ||
        newGroupForm.firstHenchmanName.trim() ||
        (newGroupForm.price.trim() && newGroupForm.price.trim() !== "0") ||
        (newGroupForm.xp.trim() && newGroupForm.xp.trim() !== "0") ||
        (newGroupForm.max_size.trim() && newGroupForm.max_size.trim() !== "5"));
    if (isGroupDraftDirty) {
      setSaveError("Finish creating the new group or cancel it before saving.");
      return;
    }

    const currentErrors = groupForms.map((group) => validateHenchmenGroupForm(group));
    const hasErrors = currentErrors.some(Boolean);
    if (hasErrors) {
      setHasAttemptedSave(true);
      setSaveError("Fix group details before saving.");
      return;
    }
    setHasAttemptedSave(false);

    setIsSaving(true);
    setSaveError("");

    try {
      const createPromises = groupForms
        .filter((group) => !group.id)
        .map((group) =>
          createWarbandHenchmenGroup(
            warbandId,
            {
              name: group.name.trim() || null,
              unit_type: group.unit_type.trim() || null,
              race: group.race_id ?? null,
              price: toNullableNumber(group.price) ?? 0,
              xp: toNullableNumber(group.xp) ?? 0,
              max_size: toNullableNumber(group.max_size) ?? 5,
              deeds: group.deeds.trim() || null,
              armour_save: group.armour_save.trim() || null,
              large: group.large,
              half_rate: group.half_rate,
              ...buildHenchmenGroupStatPayload(group),
              items: group.items.map((item) => ({ id: item.id, cost: item.cost ?? null })),
              skill_ids: group.skills.map((skill) => skill.id),
              special_ids: group.specials.map((entry) => entry.id),
            henchmen: group.henchmen.map((h) => {
              const cost = normalizeHenchmanCost(h.cost);
              return {
                name: h.name,
                kills: h.kills,
                dead: h.dead,
                ...(cost !== null ? { cost } : {}),
              };
            }),
          },
          { emitUpdate: false }
        )
      );

      const updatePromises = groupForms
        .filter((group) => {
          if (!group.id) return false;
          const original = originalGroupFormsRef.current?.get(group.id);
          return !original || original !== JSON.stringify(group);
        })
        .map((group) =>
          updateWarbandHenchmenGroup(warbandId, group.id as number, {
            name: group.name.trim() || null,
            unit_type: group.unit_type.trim() || null,
            race: group.race_id ?? null,
            price: toNullableNumber(group.price) ?? 0,
            xp: toNullableNumber(group.xp) ?? 0,
            max_size: toNullableNumber(group.max_size) ?? 5,
            deeds: group.deeds.trim() || null,
            armour_save: group.armour_save.trim() || null,
            large: group.large,
            half_rate: group.half_rate,
            ...buildHenchmenGroupStatPayload(group),
            items: computeItemsWithNewHenchmen(group),
            skill_ids: group.skills.map((skill) => skill.id),
            special_ids: group.specials.map((entry) => entry.id),
            henchmen: group.henchmen.map((h) => {
              const cost = normalizeHenchmanCost(h.cost);
              return {
                ...(h.id ? { id: h.id } : {}),
                name: h.name,
                kills: h.kills,
                dead: h.dead,
                ...(cost !== null ? { cost } : {}),
              };
            }),
          })
        );

      const deletePromises = removedGroupIds.map((groupId) =>
        deleteWarbandHenchmenGroup(warbandId, groupId, { emitUpdate: false })
      );

      await Promise.all([...createPromises, ...updatePromises, ...deletePromises]);

      const henchmenPurchases = pendingPurchases.filter(
        (entry) =>
          entry.unitType === "henchmen" &&
          !removedGroupIds.includes(Number(entry.unitId))
      );

      if (henchmenPurchases.length > 0) {
        await commitPendingPurchases(warbandId, henchmenPurchases, (entry) => {
          const match = groupForms.find((group) => String(group.id) === entry.unitId);
          return match?.name?.trim() || "Unknown Group";
        });
        emitWarbandUpdate(warbandId);
      }

      const refreshed = await listWarbandHenchmenGroups(warbandId);
      onSuccess(refreshed);
      if (pendingPurchases.length > 0) {
        onPendingCleared?.();
      }
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setSaveError(errorResponse.message || "Unable to save henchmen groups");
      } else {
        setSaveError("Unable to save henchmen groups");
      }
    } finally {
      setIsSaving(false);
    }
  };

  return {
    isSaving,
    saveError,
    setSaveError,
    hasAttemptedSave,
    setHasAttemptedSave,
    handleSaveChanges,
  };
}
