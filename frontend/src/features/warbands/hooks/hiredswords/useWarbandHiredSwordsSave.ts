import { useState, type RefObject } from "react";

import {
  createWarbandHiredSword,
  deleteWarbandHiredSword,
  getWarbandSummary,
  updateWarbandHiredSword,
} from "@/features/warbands/api/warbands-api";
import { emitWarbandUpdate } from "@/features/warbands/api/warbands-events";
import {
  buildAvailableSkillsPayload,
  buildStatPayload,
  toNullableNumber,
  validateHiredSwordForm,
} from "@/features/warbands/utils/warband-utils";
import { commitPendingPurchases, type PendingPurchase } from "@/features/warbands/utils/pending-purchases";

import type {
  HiredSwordFormEntry,
  WarbandHiredSword,
} from "@/features/warbands/types/warband-types";
import type { NewHiredSwordForm } from "@/features/warbands/utils/warband-utils";

type UseWarbandHiredSwordsSaveParams = {
  warbandId: number;
  canEdit: boolean;
  currentHiredSwords: WarbandHiredSword[];
  hiredSwordForms: HiredSwordFormEntry[];
  removedHiredSwordIds: number[];
  isAddingHiredSwordForm: boolean;
  newHiredSwordForm: NewHiredSwordForm;
  raceQuery: string;
  originalHiredSwordFormsRef: RefObject<Map<number, string>>;
  onSuccess: (refreshed: WarbandHiredSword[]) => void;
  pendingPurchases?: PendingPurchase[];
  onPendingCleared?: () => void;
};

export function useWarbandHiredSwordsSave({
  warbandId,
  canEdit,
  currentHiredSwords,
  hiredSwordForms,
  removedHiredSwordIds,
  isAddingHiredSwordForm,
  newHiredSwordForm,
  raceQuery,
  originalHiredSwordFormsRef,
  onSuccess,
  pendingPurchases = [],
  onPendingCleared,
}: UseWarbandHiredSwordsSaveParams) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [hasAttemptedSave, setHasAttemptedSave] = useState(false);

  const mergeHiredSwords = (
    current: WarbandHiredSword[],
    created: WarbandHiredSword[],
    updated: WarbandHiredSword[],
    removedIds: number[],
  ) => {
    const removed = new Set(removedIds);
    const next = current.filter((entry) => !removed.has(entry.id));
    const byId = new Map(next.map((entry) => [entry.id, entry]));
    for (const entry of [...updated, ...created]) {
      byId.set(entry.id, entry);
    }
    return Array.from(byId.values());
  };

  const handleSaveChanges = async () => {
    if (!warbandId || !canEdit) {
      return;
    }

    const isDraftDirty =
      isAddingHiredSwordForm &&
      (newHiredSwordForm.name.trim() ||
        newHiredSwordForm.unit_type.trim() ||
        raceQuery.trim() ||
        (newHiredSwordForm.price.trim() && newHiredSwordForm.price.trim() !== "0") ||
        (newHiredSwordForm.upkeep_price.trim() && newHiredSwordForm.upkeep_price.trim() !== "0") ||
        (newHiredSwordForm.rating.trim() && newHiredSwordForm.rating.trim() !== "0") ||
        (newHiredSwordForm.xp.trim() && newHiredSwordForm.xp.trim() !== "0") ||
        newHiredSwordForm.items.length > 0 ||
        newHiredSwordForm.skills.length > 0 ||
        newHiredSwordForm.spells.length > 0 ||
        newHiredSwordForm.specials.length > 0);
    if (isDraftDirty) {
      setSaveError("Finish creating the new hired sword or cancel it before saving.");
      return;
    }

    const currentErrors = hiredSwordForms.map((entry) => validateHiredSwordForm(entry));
    const hasErrors = currentErrors.some(Boolean);
    if (hasErrors) {
      setHasAttemptedSave(true);
      setSaveError("Fix hired sword details before saving.");
      return;
    }
    setHasAttemptedSave(false);

    setIsSaving(true);
    setSaveError("");

    try {
      const createPromises = hiredSwordForms
        .filter((entry) => !entry.id)
        .map((entry) =>
          createWarbandHiredSword(
            warbandId,
            {
              name: entry.name.trim() || null,
              unit_type: entry.unit_type.trim() || null,
              race: entry.race_id ?? null,
              price: toNullableNumber(entry.price) ?? 0,
              upkeep_price: toNullableNumber(entry.upkeep_price) ?? 0,
              rating: toNullableNumber(entry.rating) ?? 0,
              xp: toNullableNumber(entry.xp) ?? 0,
              deeds: entry.deeds.trim() || null,
              armour_save: toNullableNumber(entry.armour_save),
              large: entry.large,
              caster: entry.caster,
              half_rate: entry.half_rate,
              blood_pacted: entry.blood_pacted,
              available_skills: buildAvailableSkillsPayload(entry.available_skills),
              ...buildStatPayload(entry),
              items: entry.items.map((item) => ({ id: item.id, cost: item.cost ?? null })),
              skill_ids: entry.skills.map((skill) => skill.id),
              special_ids: entry.specials.map((entry) => entry.id),
              spell_ids: entry.spells.map((spell) => spell.id),
            },
            { emitUpdate: false }
          )
        );

      const updatePromises = hiredSwordForms
        .filter((entry) => {
          if (!entry.id) return false;
          const original = originalHiredSwordFormsRef.current?.get(entry.id);
          return !original || original !== JSON.stringify(entry);
        })
        .map((entry) =>
          updateWarbandHiredSword(warbandId, entry.id as number, {
            name: entry.name.trim() || null,
            unit_type: entry.unit_type.trim() || null,
            race: entry.race_id ?? null,
            price: toNullableNumber(entry.price) ?? 0,
            upkeep_price: toNullableNumber(entry.upkeep_price) ?? 0,
            rating: toNullableNumber(entry.rating) ?? 0,
            xp: toNullableNumber(entry.xp) ?? 0,
            deeds: entry.deeds.trim() || null,
            armour_save: entry.armour_save.trim() || null,
            large: entry.large,
            caster: entry.caster,
            half_rate: entry.half_rate,
            blood_pacted: entry.blood_pacted,
            available_skills: buildAvailableSkillsPayload(entry.available_skills),
            ...buildStatPayload(entry),
            items: entry.items.map((item) => ({ id: item.id, cost: item.cost ?? null })),
            skill_ids: entry.skills.map((skill) => skill.id),
            special_ids: entry.specials.map((entry) => entry.id),
            spell_ids: entry.spells.map((spell) => spell.id),
          }, { emitUpdate: false })
        );

      const deletePromises = removedHiredSwordIds.map((entryId) =>
        deleteWarbandHiredSword(warbandId, entryId, { emitUpdate: false })
      );

      const [createdHiredSwords, updatedHiredSwords] = await Promise.all([
        Promise.all(createPromises),
        Promise.all(updatePromises),
      ]);
      await Promise.all(deletePromises);

      const hiredSwordPurchases = pendingPurchases.filter(
        (entry) =>
          entry.unitType === "hiredswords" &&
          !removedHiredSwordIds.includes(Number(entry.unitId))
      );

      if (hiredSwordPurchases.length > 0) {
        await commitPendingPurchases(warbandId, hiredSwordPurchases, (entry) => {
          const match = hiredSwordForms.find((form) => String(form.id) === entry.unitId);
          return match?.name?.trim() || "Unknown Hired Sword";
        });
      }

      const refreshed = mergeHiredSwords(
        currentHiredSwords,
        createdHiredSwords,
        updatedHiredSwords,
        removedHiredSwordIds,
      );
      const shouldRefreshSummary =
        createdHiredSwords.length > 0 ||
        updatedHiredSwords.length > 0 ||
        removedHiredSwordIds.length > 0 ||
        hiredSwordPurchases.length > 0;
      const summary = shouldRefreshSummary ? await getWarbandSummary(warbandId) : null;

      onSuccess(refreshed);
      if (summary) {
        emitWarbandUpdate(warbandId, { summary });
      }
      if (pendingPurchases.length > 0) {
        onPendingCleared?.();
      }
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setSaveError(errorResponse.message || "Unable to update hired swords");
      } else {
        setSaveError("Unable to update hired swords");
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
