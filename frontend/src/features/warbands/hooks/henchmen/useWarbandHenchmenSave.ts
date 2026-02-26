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
import { removeWarbandItem } from "@/features/warbands/api/warbands-items";

import type { Item } from "@/features/items/types/item-types";

import type {
  HenchmenGroup,
  HenchmenGroupFormEntry,
  HenchmanItemChoice,
} from "@/features/warbands/types/warband-types";
import type { NewHenchmenGroupForm } from "./useHenchmenGroupCreationForm";

/**
 * Build a notes string for a henchman recruitment trade, including
 * base cost, XP cost, and per-henchman item breakdown.
 */
const buildRecruitNotes = (opts: {
  price: number | string;
  xp: number | string;
  items: Item[];
  henchmenCount: number;
  itemChoices?: HenchmanItemChoice[];
}): string => {
  const baseCost = toNullableNumber(opts.price) ?? 0;
  const xpRaw = toNullableNumber(opts.xp) ?? 0;
  const xpCost = xpRaw * 2;

  const lines: string[] = [];

  if (baseCost > 0) lines.push(`Base: ${baseCost} gc`);
  if (xpCost > 0) lines.push(`XP: ${xpRaw} x2 = ${xpCost} gc`);

  if (opts.itemChoices && opts.itemChoices.length > 0) {
    // Build a name lookup from the items array
    const itemNames = new Map<number, string>();
    for (const item of opts.items) {
      if (!itemNames.has(item.id)) itemNames.set(item.id, item.name);
    }

    const itemParts: string[] = [];
    for (const choice of opts.itemChoices) {
      const name = itemNames.get(choice.itemId) ?? `Item #${choice.itemId}`;
      const cost = choice.cost ?? 0;
      if (choice.action === "stash") {
        itemParts.push(`${name} (from stash)`);
      } else if (choice.action === "ignore") {
        itemParts.push(`${name} (ignored)`);
      } else if (cost > 0) {
        itemParts.push(`${name} (${cost} gc)`);
      } else {
        itemParts.push(name);
      }
    }

    if (itemParts.length > 0) {
      lines.push("Items: " + itemParts.join(", "));
    }
  } else if (opts.items.length > 0) {
    // No choices — default all items to buy (new group creation)
    const seen = new Map<number, { item: Item; count: number }>();
    for (const item of opts.items) {
      const existing = seen.get(item.id);
      if (existing) {
        existing.count += 1;
      } else {
        seen.set(item.id, { item, count: 1 });
      }
    }

    const itemParts: string[] = [];
    for (const [, { item, count }] of seen) {
      const perHenchman = getHenchmenItemMultiplier(count, opts.henchmenCount);
      if (perHenchman <= 0) continue;
      let label = item.name;
      if (perHenchman > 1) label = `${label} x${perHenchman}`;
      if (item.cost) {
        itemParts.push(`${label} (${item.cost * perHenchman} gc)`);
      } else {
        itemParts.push(label);
      }
    }

    if (itemParts.length > 0) {
      lines.push("Items: " + itemParts.join(", "));
    }
  }

  return lines.join(". ");
};

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

const computeItemsWithNewHenchmen = (group: { items: Item[]; henchmen: { id?: number | null; itemChoices?: HenchmanItemChoice[] }[] }): { id: number; cost: number | null }[] => {
  const toEntry = (item: Item) => ({ id: item.id, cost: item.cost ?? null });
  const newHenchmen = group.henchmen.filter((h) => !h.id);
  if (newHenchmen.length === 0) {
    return group.items.map(toEntry);
  }
  const baseCount = group.henchmen.length - newHenchmen.length;
  let items: Item[] = [...group.items];
  for (let i = 0; i < newHenchmen.length; i += 1) {
    const choices = newHenchmen[i].itemChoices;
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
      let toAddCount: number;
      if (choices) {
        toAddCount = choices.filter((c) => c.itemId === item.id && c.action !== "ignore").length;
      } else {
        toAddCount = getHenchmenItemMultiplier(count, currentCount);
      }
      for (let j = 0; j < toAddCount; j += 1) {
        toAdd.push(item);
      }
    }
    items = [...items, ...toAdd];
  }
  return items.map(toEntry);
};

const collectStashRemovals = (groupForms: HenchmenGroupFormEntry[]): { itemId: number; quantity: number }[] => {
  const removals: { itemId: number; quantity: number }[] = [];
  for (const group of groupForms) {
    if (!group.id) continue;
    const baseCount = group.henchmen.filter((h) => !!h.id).length;
    const newHenchmen = group.henchmen.filter((h) => !h.id);
    let items = [...group.items];
    for (let i = 0; i < newHenchmen.length; i += 1) {
      const choices = newHenchmen[i].itemChoices;
      if (!choices) continue;
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
      // Count stash choices per itemId
      const stashCounts: Record<number, number> = {};
      for (const choice of choices) {
        if (choice.action === "stash") {
          stashCounts[choice.itemId] = (stashCounts[choice.itemId] ?? 0) + 1;
        }
      }
      for (const [itemIdStr, qty] of Object.entries(stashCounts)) {
        removals.push({ itemId: Number(itemIdStr), quantity: qty });
      }
      // Advance items for next iteration (same logic as computeItemsWithNewHenchmen)
      const toAdd: Item[] = [];
      for (const { item, count } of Object.values(itemCounts)) {
        const toAddCount = choices.filter((c) => c.itemId === item.id && c.action !== "ignore").length;
        for (let j = 0; j < toAddCount; j += 1) {
          toAdd.push(item);
        }
      }
      items = [...items, ...toAdd];
    }
  }
  return removals;
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
              armour_save: toNullableNumber(group.armour_save),
              large: group.large,
              half_rate: group.half_rate,
              ...buildHenchmenGroupStatPayload(group),
              items: group.items.map((item) => ({ id: item.id, cost: item.cost ?? null })),
              item_notes: buildRecruitNotes({ price: group.price, xp: group.xp, items: group.items, henchmenCount: group.henchmen.length }),
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
                ...(!h.id ? { item_notes: buildRecruitNotes({ price: group.price, xp: group.xp, items: group.items, henchmenCount: group.henchmen.filter((x) => !!x.id).length, itemChoices: h.itemChoices }) } : {}),
              };
            }),
          })
        );

      const deletePromises = removedGroupIds.map((groupId) =>
        deleteWarbandHenchmenGroup(warbandId, groupId, { emitUpdate: false })
      );

      await Promise.all([...createPromises, ...updatePromises, ...deletePromises]);

      // Remove stash items chosen as "from stash" in the add-henchman dialog
      const stashRemovals = collectStashRemovals(groupForms);
      for (const { itemId, quantity } of stashRemovals) {
        await removeWarbandItem(warbandId, itemId, quantity);
      }

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
