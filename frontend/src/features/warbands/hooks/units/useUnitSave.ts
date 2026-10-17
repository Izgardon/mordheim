import { useState, type RefObject } from "react";
import { useMutation } from "@tanstack/react-query";

import { getWarbandSummary, updateWarband } from "@/features/warbands/api/warbands-api";
import { useWarbandCacheUpdate } from "@/features/warbands/api/warband-cache";
import { unitApi } from "@/features/warbands/units/unit-api";
import {
  commitPendingPurchases,
  type PendingPurchase,
} from "@/features/warbands/utils/pending-purchases";

import type { Unit, UnitForm, UnitKindKey, UnitNewForm } from "../../types/units";
import type { Warband, WarbandUnitsSummary, WarbandUpdatePayload } from "../../types/warband-types";
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

type SectionWrite<K extends UnitKindKey> = {
  warbandId: number;
  forms: UnitForm<K>[];
  removedIds: number[];
  changedForms: UnitForm<K>[];
  sessionInitialIds: readonly number[];
  purchases: PendingPurchase[];
  /** Heroes only: the name and faction to save first, when they changed. */
  header?: { warband: Warband; name: string; faction: string };
};

type SectionWriteResult<K extends UnitKindKey> = {
  updated: Unit<K>[];
  updatedWarband?: Warband;
  summary: WarbandUnitsSummary | null;
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
 * One section's writes: the warband header (heroes), a PATCH per changed unit and a DELETE per
 * dismissed one (fired together), the kind's extra writes, the queued purchases one by one, then
 * one summary GET when anything was written.
 */
async function writeSection<K extends UnitKindKey>(
  kind: UnitKindConfig<K>,
  input: SectionWrite<K>
): Promise<SectionWriteResult<K>> {
  const { warbandId, forms, removedIds, header, purchases } = input;
  const updatedWarband =
    header && (header.name !== header.warband.name || header.faction !== header.warband.faction)
      ? await updateWarband(header.warband.id, { name: header.name, faction: header.faction })
      : header?.warband;

  const api = unitApi(kind.key);
  const updatePromises = input.changedForms.map((form) => {
    const unitId = form.id as number;
    const isSessionCreated = !input.sessionInitialIds.includes(unitId);
    return api.update(warbandId, unitId, kind.buildPayload(form, { isSessionCreated }));
  });
  const deletePromises = removedIds.map((unitId) => api.remove(warbandId, unitId));
  const updated = await Promise.all(updatePromises);
  await Promise.all(deletePromises);

  const extraWrites = (await kind.editor.afterSaveWrites?.(warbandId, forms)) ?? 0;

  if (purchases.length > 0) {
    await commitPendingPurchases(warbandId, purchases, (entry) => {
      const match = forms.find((form) => String(form.id) === entry.unitId);
      return match?.name?.trim() || kind.labels.unknownName;
    });
  }

  const wroteAnything =
    updated.length > 0 || removedIds.length > 0 || extraWrites > 0 || purchases.length > 0;
  const summary = wroteAnything ? await getWarbandSummary(warbandId) : null;
  return { updated, updatedWarband, summary };
}

/** Save and its checks for one section; the writes run as one mutation. */
export function useUnitSave<K extends UnitKindKey>(
  kind: UnitKindConfig<K>,
  params: UseUnitSaveParams<K>
) {
  const [saveError, setSaveError] = useState("");
  const [hasAttemptedSave, setHasAttemptedSave] = useState(false);
  const updateWarbandCache = useWarbandCacheUpdate();
  const { labels, editor } = kind;
  const save = useMutation({
    mutationFn: (input: SectionWrite<K>) => writeSection(kind, input),
  });

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
    setSaveError("");

    try {
      const { updated, updatedWarband, summary } = await save.mutateAsync({
        warbandId,
        forms,
        removedIds,
        changedForms: forms.filter((form) => {
          if (!form.id) return false;
          const original = params.originalFormsRef.current?.get(form.id);
          return !original || original !== JSON.stringify(form);
        }),
        sessionInitialIds: params.sessionInitialIds ?? [],
        purchases: pendingPurchases.filter(
          (entry) => entry.unitType === kind.section && !removedIds.includes(Number(entry.unitId))
        ),
        header: warbandHeader
          ? { warband: warbandHeader.warband, name: trimmedName, faction: trimmedFaction }
          : undefined,
      });
      const refreshed = mergeUnits(params.units, updated, removedIds);

      // Heroes merge the summary into the warband they hand back; the others write it.
      if (updatedWarband) {
        params.onSuccess(refreshed, summary ? { ...updatedWarband, ...summary } : updatedWarband);
      } else {
        params.onSuccess(refreshed);
        if (summary) {
          updateWarbandCache(warbandId, { summary });
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
    }
  };

  return {
    isSaving: save.isPending,
    saveError,
    setSaveError,
    hasAttemptedSave,
    setHasAttemptedSave,
    handleSaveChanges,
  };
}
