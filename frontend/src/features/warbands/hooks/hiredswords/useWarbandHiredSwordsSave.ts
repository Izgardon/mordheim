import { useState, type RefObject } from "react";

import {
  deleteWarbandHiredSword,
  getWarbandSummary,
  updateWarbandHiredSword,
} from "@/features/warbands/api/warbands-api";
import { emitWarbandUpdate } from "@/features/warbands/api/warbands-events";
import { hiredSwordKind } from "@/features/warbands/units/kinds/hired-sword";
import {
  commitPendingPurchases,
  type PendingPurchase,
} from "@/features/warbands/utils/pending-purchases";

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
  sessionInitialHiredSwordIds?: readonly number[];
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
  sessionInitialHiredSwordIds = [],
  onSuccess,
  pendingPurchases = [],
  onPendingCleared,
}: UseWarbandHiredSwordsSaveParams) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [hasAttemptedSave, setHasAttemptedSave] = useState(false);

  const mergeHiredSwords = (
    current: WarbandHiredSword[],
    updated: WarbandHiredSword[],
    removedIds: number[]
  ) => {
    const removed = new Set(removedIds);
    const next = current.filter((entry) => !removed.has(entry.id));
    const byId = new Map(next.map((entry) => [entry.id, entry]));
    for (const entry of updated) {
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

    const currentErrors = hiredSwordForms.map((entry) => hiredSwordKind.validate(entry));
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
      const updatePromises = hiredSwordForms
        .filter((entry) => {
          if (!entry.id) return false;
          const original = originalHiredSwordFormsRef.current?.get(entry.id);
          return !original || original !== JSON.stringify(entry);
        })
        .map((entry) => {
          const isSessionCreated = !sessionInitialHiredSwordIds.includes(entry.id as number);
          return updateWarbandHiredSword(
            warbandId,
            entry.id as number,
            hiredSwordKind.buildPayload(entry, { isSessionCreated })
          );
        });

      const deletePromises = removedHiredSwordIds.map((entryId) =>
        deleteWarbandHiredSword(warbandId, entryId, { emitUpdate: false })
      );

      const updatedHiredSwords = await Promise.all(updatePromises);
      await Promise.all(deletePromises);

      const hiredSwordPurchases = pendingPurchases.filter(
        (entry) =>
          entry.unitType === "hiredswords" && !removedHiredSwordIds.includes(Number(entry.unitId))
      );

      if (hiredSwordPurchases.length > 0) {
        await commitPendingPurchases(warbandId, hiredSwordPurchases, (entry) => {
          const match = hiredSwordForms.find((form) => String(form.id) === entry.unitId);
          return match?.name?.trim() || "Unknown Hired Sword";
        });
      }

      const refreshed = mergeHiredSwords(
        currentHiredSwords,
        updatedHiredSwords,
        removedHiredSwordIds
      );
      const shouldRefreshSummary =
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
