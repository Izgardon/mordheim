import { useState, type RefObject } from "react";

import { getWarbandSummary, updateWarband } from "@/features/warbands/api/warbands-api";
import { emitWarbandUpdate } from "@/features/warbands/api/warbands-events";
import { unitApi } from "@/features/warbands/units/unit-api";
import {
  commitPendingPurchases,
  type PendingPurchase,
} from "@/features/warbands/utils/pending-purchases";

import type { Unit, UnitForm, UnitKindKey, UnitNewForm } from "../../types/units";
import type { Warband, WarbandUpdatePayload } from "../../types/warband-types";
import type { UnitKindConfig } from "../../units/unit-kind-types";

export type UseUnitSaveParams<K extends UnitKindKey> = {
  warbandId: number | null;
  canEdit: boolean;
  units: Unit<K>[];
  forms: UnitForm<K>[];
  removedIds: number[];
  isAdding: boolean;
  newForm: UnitNewForm<K>;
  raceQuery: string;
  originalFormsRef: RefObject<Map<number, string>>;
  /** Units the edit session started with; the others were created during it. */
  sessionInitialIds?: readonly number[];
  /** The refreshed roster; heroes also get the warband merged with the new summary. */
  onSuccess: (refreshed: Unit<K>[], updatedWarband?: Warband) => void;
  pendingPurchases?: PendingPurchase[];
  onPendingCleared?: () => void;
  /** Heroes only: the warband's name and faction, saved before the heroes. */
  warbandHeader?: { warband: Warband; form: WarbandUpdatePayload };
};

const mergeUnits = <U extends { id: number }>(current: U[], updated: U[], removedIds: number[]) => {
  const removed = new Set(removedIds);
  const byId = new Map(
    current.filter((unit) => !removed.has(unit.id)).map((unit) => [unit.id, unit])
  );
  for (const unit of updated) {
    byId.set(unit.id, unit);
  }
  return Array.from(byId.values());
};

/**
 * Save for one section: PATCH each changed unit and DELETE each dismissed one (fired together),
 * then the kind's extra writes, then the queued purchases one by one, then one summary GET.
 */
export function useUnitSave<K extends UnitKindKey>(
  kind: UnitKindConfig<K>,
  params: UseUnitSaveParams<K>
) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [hasAttemptedSave, setHasAttemptedSave] = useState(false);
  const { labels, editor } = kind;

  const handleSaveChanges = async () => {
    const { warbandId, forms, removedIds, warbandHeader, pendingPurchases = [] } = params;
    if (!warbandId || !params.canEdit) {
      return;
    }
    const trimmedName = warbandHeader?.form.name.trim() ?? "";
    const trimmedFaction = warbandHeader?.form.faction.trim() ?? "";
    if (warbandHeader && (!trimmedName || !trimmedFaction)) {
      setSaveError("Name and faction are required.");
      return;
    }
    if (params.isAdding && editor.creation.isDraftDirty(params.newForm, params.raceQuery)) {
      setSaveError(`Finish creating the new ${labels.draftNoun} or cancel it before saving.`);
      return;
    }
    if (forms.some((form) => kind.validate(form))) {
      setHasAttemptedSave(true);
      setSaveError(`Fix ${labels.draftNoun} details before saving.`);
      return;
    }
    // Heroes need a leader, even with no heroes at all (BUG-64, pinned).
    if (kind.flags.canLead && !forms.some((form) => "is_leader" in form && form.is_leader)) {
      setHasAttemptedSave(true);
      setSaveError("Select a leader before saving.");
      return;
    }
    setHasAttemptedSave(false);
    setIsSaving(true);
    setSaveError("");

    try {
      const { warband } = warbandHeader ?? {};
      const updatedWarband =
        warband && (trimmedName !== warband.name || trimmedFaction !== warband.faction)
          ? await updateWarband(
              warband.id,
              { name: trimmedName, faction: trimmedFaction },
              { emitUpdate: false }
            )
          : warband;

      const api = unitApi(kind.key);
      const updatePromises = forms
        .filter((form) => {
          if (!form.id) return false;
          const original = params.originalFormsRef.current?.get(form.id);
          return !original || original !== JSON.stringify(form);
        })
        .map((form) => {
          const isSessionCreated = !(params.sessionInitialIds ?? []).includes(form.id as number);
          return api.update(
            warbandId,
            form.id as number,
            kind.buildPayload(form, { isSessionCreated })
          );
        });
      const deletePromises = removedIds.map((unitId) =>
        api.remove(warbandId, unitId, { emitUpdate: false })
      );
      const updated = await Promise.all(updatePromises);
      await Promise.all(deletePromises);

      const extraWrites = (await editor.afterSaveWrites?.(warbandId, forms)) ?? 0;

      const purchases = pendingPurchases.filter(
        (entry) => entry.unitType === kind.section && !removedIds.includes(Number(entry.unitId))
      );
      if (purchases.length > 0) {
        await commitPendingPurchases(warbandId, purchases, (entry) => {
          const match = forms.find((form) => String(form.id) === entry.unitId);
          return match?.name?.trim() || labels.unknownName;
        });
      }

      const refreshed = mergeUnits(params.units, updated, removedIds);
      const shouldRefreshSummary =
        updated.length > 0 || removedIds.length > 0 || extraWrites > 0 || purchases.length > 0;
      const summary = shouldRefreshSummary ? await getWarbandSummary(warbandId) : null;

      // Heroes merge the summary into the warband they hand back; the others announce it.
      if (updatedWarband) {
        params.onSuccess(refreshed, summary ? { ...updatedWarband, ...summary } : updatedWarband);
      } else {
        params.onSuccess(refreshed);
        if (summary) {
          emitWarbandUpdate(warbandId, { summary });
        }
      }
      if (pendingPurchases.length > 0) {
        params.onPendingCleared?.();
      }
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setSaveError(errorResponse.message || labels.saveError);
      } else {
        setSaveError(labels.saveError);
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
