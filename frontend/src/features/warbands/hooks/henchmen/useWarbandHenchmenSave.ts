import { useState, type RefObject } from "react";

import {
  deleteWarbandHenchmenGroup,
  getWarbandSummary,
  updateWarbandHenchmenGroup,
} from "@/features/warbands/api/warbands-api";
import { emitWarbandUpdate } from "@/features/warbands/api/warbands-events";
import {
  commitPendingPurchases,
  type PendingPurchase,
} from "@/features/warbands/utils/pending-purchases";
import { removeWarbandItem } from "@/features/warbands/api/warbands-items";
import { henchmenKind } from "@/features/warbands/units/kinds/henchmen";
import { collectStashRemovals } from "@/features/warbands/units/kinds/henchmen-members";

import type {
  HenchmenGroup,
  HenchmenGroupFormEntry,
} from "@/features/warbands/types/warband-types";
import type { NewHenchmenGroupForm } from "./useHenchmenGroupCreationForm";

type UseWarbandHenchmenSaveParams = {
  warbandId: number | null;
  canEdit: boolean;
  currentGroups: HenchmenGroup[];
  groupForms: HenchmenGroupFormEntry[];
  removedGroupIds: number[];
  isAddingGroupForm: boolean;
  newGroupForm: NewHenchmenGroupForm;
  raceQuery: string;
  originalGroupFormsRef: RefObject<Map<number, string>>;
  sessionInitialGroupIds?: readonly number[];
  onSuccess: (refreshedGroups: HenchmenGroup[]) => void;
  pendingPurchases?: PendingPurchase[];
  onPendingCleared?: () => void;
};

export function useWarbandHenchmenSave({
  warbandId,
  canEdit,
  currentGroups,
  groupForms,
  removedGroupIds,
  isAddingGroupForm,
  newGroupForm,
  raceQuery,
  originalGroupFormsRef,
  sessionInitialGroupIds = [],
  onSuccess,
  pendingPurchases = [],
  onPendingCleared,
}: UseWarbandHenchmenSaveParams) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [hasAttemptedSave, setHasAttemptedSave] = useState(false);

  const mergeGroups = (
    current: HenchmenGroup[],
    updated: HenchmenGroup[],
    removedIds: number[]
  ) => {
    const removed = new Set(removedIds);
    const next = current.filter((group) => !removed.has(group.id));
    const byId = new Map(next.map((group) => [group.id, group]));
    for (const group of updated) {
      byId.set(group.id, group);
    }
    return Array.from(byId.values());
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

    const currentErrors = groupForms.map((group) => henchmenKind.validate(group));
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
      const updatePromises = groupForms
        .filter((group) => {
          if (!group.id) return false;
          const original = originalGroupFormsRef.current?.get(group.id);
          return !original || original !== JSON.stringify(group);
        })
        .map((group) => {
          const isSessionCreated = !sessionInitialGroupIds.includes(group.id as number);
          return updateWarbandHenchmenGroup(
            warbandId,
            group.id as number,
            henchmenKind.buildPayload(group, { isSessionCreated })
          );
        });

      const deletePromises = removedGroupIds.map((groupId) =>
        deleteWarbandHenchmenGroup(warbandId, groupId, { emitUpdate: false })
      );

      const updatedGroups = await Promise.all(updatePromises);
      await Promise.all(deletePromises);

      // Remove stash items chosen as "from stash" in the add-henchman dialog
      const stashRemovals = collectStashRemovals(groupForms);
      for (const { itemId, quantity } of stashRemovals) {
        await removeWarbandItem(warbandId, itemId, quantity, { emitUpdate: false });
      }

      const henchmenPurchases = pendingPurchases.filter(
        (entry) => entry.unitType === "henchmen" && !removedGroupIds.includes(Number(entry.unitId))
      );

      if (henchmenPurchases.length > 0) {
        await commitPendingPurchases(warbandId, henchmenPurchases, (entry) => {
          const match = groupForms.find((group) => String(group.id) === entry.unitId);
          return match?.name?.trim() || "Unknown Group";
        });
      }

      const refreshedGroups = mergeGroups(currentGroups, updatedGroups, removedGroupIds);
      const shouldRefreshSummary =
        updatedGroups.length > 0 ||
        removedGroupIds.length > 0 ||
        stashRemovals.length > 0 ||
        henchmenPurchases.length > 0;
      const summary = shouldRefreshSummary ? await getWarbandSummary(warbandId) : null;

      onSuccess(refreshedGroups);
      if (summary) {
        emitWarbandUpdate(warbandId, { summary });
      }
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
