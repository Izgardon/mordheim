import { useState, type RefObject } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiErrorCode, getErrorMessage } from "@/lib/get-error-message";
import { toastPurchaseWarnings } from "@/features/items/api/purchase";
import {
  invalidateWarbandReads,
  useWarbandCacheUpdate,
} from "@/features/warbands/api/warband-cache";
import { sortBatchErrors } from "@/features/warbands/units/batch-errors";
import { type PendingPurchase } from "@/features/warbands/utils/pending-purchases";
import { writeSection, type SectionWrite } from "./write-section";

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
  /** Each unit's `updated_at` when the edit began: a unit saved elsewhere since is refused. */
  versionsRef?: RefObject<Map<number, string>>;
  /** The saved roster; heroes also get the warband merged with the new summary. */
  onSuccess: (refreshed: Unit<K>[], updatedWarband?: Warband) => void;
  pendingPurchases?: PendingPurchase[];
  onPendingCleared?: () => void;
  /** Heroes only: the warband's name and faction, saved before the heroes. */
  warbandHeader?: { warband: Warband; form: WarbandUpdatePayload };
};

const NO_FORM_ERRORS = new Map<never, string[]>();
const CAP_CODES = new Set(["hero_cap_reached", "hired_sword_cap_reached"]);
export const UNIT_CHANGED_MESSAGE = "This unit was changed elsewhere; reload it.";

/** Save and its checks for one section; the writes run as one mutation. */
export function useUnitSave<K extends UnitKindKey>(
  kind: UnitKindConfig<K>,
  params: UseUnitSaveParams<K>
) {
  const [saveError, setSaveError] = useState("");
  const [hasAttemptedSave, setHasAttemptedSave] = useState(false);
  /** The server's messages for each form after a refused Save (UX-05). */
  const [formErrors, setFormErrors] = useState<Map<UnitForm<K>, string[]>>(NO_FORM_ERRORS);
  const updateWarbandCache = useWarbandCacheUpdate();
  const queryClient = useQueryClient();
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
    // Heroes need a leader while any are left (the forms hold living heroes only; BUG-64).
    const hasLeader = forms.some((form) => "is_leader" in form && form.is_leader);
    if (kind.flags.canLead && forms.length > 0 && !hasLeader) {
      setHasAttemptedSave(true);
      setSaveError("Select a leader before saving.");
      return;
    }
    setHasAttemptedSave(false);
    setSaveError("");
    setFormErrors(NO_FORM_ERRORS);

    const input: SectionWrite<K> = {
      warbandId,
      forms,
      createForms: forms.filter((form) => !form.id),
      updateForms: forms.filter((form) => {
        if (!form.id) return false;
        const original = params.originalFormsRef.current?.get(form.id);
        return !original || original !== JSON.stringify(form);
      }),
      dismissIds: removedIds,
      purchases: pendingPurchases.filter(
        (entry) => entry.unitType === kind.section && !removedIds.includes(Number(entry.unitId))
      ),
      versions: params.versionsRef?.current ?? undefined,
      header: warbandHeader
        ? { warband: warbandHeader.warband, name: trimmedName, faction: trimmedFaction }
        : undefined,
    };
    let written: Awaited<ReturnType<typeof writeSection<K>>>;
    try {
      written = await save.mutateAsync(input);
    } catch (errorResponse) {
      showSaveError(errorResponse, input);
      return;
    }

    // The batch is in, purchases and stash takes with it: the sheet gets its units and summary
    // and the edit ends, so the queue is gone.
    const { units, updatedWarband, summary } = written;
    const refreshed = units ?? params.units;
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
    if (written.movedItems) {
      invalidateWarbandReads(queryClient, warbandId, "stash", "treasury", "logs");
    }
    toastPurchaseWarnings(written.warnings);
  };

  /** A refused batch: nothing was saved, and the forms stay for another go. */
  const showSaveError = (errorResponse: unknown, input: SectionWrite<K>) => {
    const formOf = (unitKey: string) =>
      input.forms.find((form) => String(form.id ?? form.draftKey) === unitKey);
    const sorted = sortBatchErrors(errorResponse, input.createForms, input.updateForms, {
      purchases: input.purchases.map((entry) => formOf(entry.unitId)),
      stash_takes: (editor.stashTakes?.(input.forms) ?? []).map((take) =>
        formOf(String(take.unitId))
      ),
    });
    const code = apiErrorCode(errorResponse) ?? "";
    if (code === "unit_changed") {
      // Saved in another tab since this edit began (409): nothing was saved here.
      setFormErrors(sorted?.byForm ?? NO_FORM_ERRORS);
      setSaveError(UNIT_CHANGED_MESSAGE);
    } else if (CAP_CODES.has(code)) {
      // A cap refusal (decision 12): the server applies dismissals first, so one can make room.
      setSaveError(
        `${getErrorMessage(errorResponse)}. Dismiss one in this Save or remove a queued recruit.`
      );
    } else if (sorted && (sorted.byForm.size > 0 || sorted.general.length > 0)) {
      setFormErrors(sorted.byForm);
      setSaveError([sorted.detail, ...sorted.general].filter(Boolean).join(" "));
    } else if (errorResponse instanceof Error) {
      setSaveError(errorResponse.message || labels.saveError);
    } else {
      setSaveError(labels.saveError);
    }
  };

  return {
    isSaving: save.isPending,
    saveError,
    setSaveError,
    formErrors,
    clearFormErrors: () => setFormErrors(NO_FORM_ERRORS),
    hasAttemptedSave,
    setHasAttemptedSave,
    handleSaveChanges,
  };
}
