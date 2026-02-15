import { useState, type RefObject } from "react";

import {
  createWarbandHenchmenGroup,
  deleteWarbandHenchmenGroup,
  listWarbandHenchmenGroups,
  updateWarbandHenchmenGroup,
} from "@/features/warbands/api/warbands-api";
import {
  buildHenchmenGroupStatPayload,
  toNullableNumber,
  validateHenchmenGroupForm,
} from "@/features/warbands/utils/warband-utils";

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
              item_ids: group.items.map((item) => item.id),
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
            item_ids: group.items.map((item) => item.id),
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

      const refreshed = await listWarbandHenchmenGroups(warbandId);
      onSuccess(refreshed);
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
