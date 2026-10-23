import { useEffect, useMemo, useState } from "react";

import { getWarbandMobileEditItemId } from "../warband/useWarbandMobileTopBar";
import { useUnitCreationForm } from "./useUnitCreationForm";
import { useUnitForms } from "./useUnitForms";
import { useUnitPendingPurchases } from "./useUnitPendingPurchases";
import { useUnitSave } from "./useUnitSave";

import type { Skill } from "@/features/skills/types/skill-types";
import type { PendingTab } from "../../components/units/UnitListBlocks";
import type { Unit, UnitKindKey } from "../../types/units";
import type { Warband, WarbandUpdatePayload } from "../../types/warband-types";
import type { RosterLimits, UnitKindConfig } from "../../units/unit-kind-types";
import type { ConfirmDiscard } from "../warband/useDiscardGuard";

export type UnitSectionEditorOptions<K extends UnitKindKey> = {
  warbandId: number;
  units: Unit<K>[];
  onUnitsChange: (units: Unit<K>[]) => void;
  canEdit: boolean;
  roster: RosterLimits;
  /** Heroes only: the warband whose name and faction save with the heroes. */
  warband?: Warband | null;
  /** Heroes only: the saved warband (merged with the new summary). */
  onWarbandSaved?: (warband: Warband) => void;
  /** The page's discard guard (decision 2); without one, Cancel discards at once. */
  confirmDiscard?: ConfirmDiscard;
};

export type PendingEditFocus = { unitId: number; tab: PendingTab };

/**
 * One roster section's edit session (design 0.28 §5.3): forms, the add form, recruits queued
 * until Save (decision 1), dismissals, queued purchases, Save and Cancel.
 */
export function useUnitSectionEditor<K extends UnitKindKey>(
  kind: UnitKindConfig<K>,
  {
    warbandId,
    units,
    onUnitsChange,
    canEdit,
    roster,
    warband,
    onWarbandSaved,
    confirmDiscard,
  }: UnitSectionEditorOptions<K>
) {
  const [isEditing, setIsEditing] = useState(false);
  const [pendingEditFocus, setPendingEditFocus] = useState<PendingEditFocus | null>(null);
  const [warbandForm, setWarbandForm] = useState<WarbandUpdatePayload>({ name: "", faction: "" });
  const forms = useUnitForms(kind);
  const purchases = useUnitPendingPurchases(kind, forms.forms);
  const extras = kind.editor.useFormExtras(warbandId, forms.forms);
  const limitsFor = (newForm: Parameters<typeof kind.editor.limits>[0]["newForm"]) =>
    kind.editor.limits({ units, forms: forms.forms, isEditing, newForm, roster });

  useEffect(() => {
    if (warband && !isEditing) {
      setWarbandForm({ name: warband.name, faction: warband.faction });
    }
  }, [warband, isEditing]);

  // A new unit is only queued: Save recruits and charges it, Cancel drops it (decision 1).
  const creation = useUnitCreationForm(kind, {
    isCreateBlocked: (newForm) => limitsFor(newForm).isCreateBlocked,
    appendForm: forms.appendForm,
  });
  const limits = limitsFor(creation.newForm);

  const finishSession = () => {
    forms.resetForms();
    creation.resetCreationForm();
    setIsEditing(false);
    setPendingEditFocus(null);
    purchases.setPendingPurchases([]);
    save.clearFormErrors();
  };

  const save = useUnitSave(kind, {
    warbandId,
    canEdit,
    units,
    forms: forms.forms,
    removedIds: forms.removedIds,
    isAdding: creation.isAdding,
    newForm: creation.newForm,
    raceQuery: creation.raceQuery,
    originalFormsRef: forms.originalFormsRef,
    versionsRef: forms.versionsRef,
    warbandHeader:
      kind.flags.savesWarbandHeader && warband ? { warband, form: warbandForm } : undefined,
    onSuccess: (refreshed, updatedWarband) => {
      if (updatedWarband) {
        onWarbandSaved?.(updatedWarband);
      }
      onUnitsChange(refreshed);
      finishSession();
      forms.setExpandedId(null);
    },
    pendingPurchases: purchases.pendingPurchases,
    onPendingCleared: () => purchases.setPendingPurchases([]),
  });

  /** The forms start from the sheet's units, which are already in the detail shape (PERF-26). */
  const startEditing = () => {
    if (!canEdit || !warbandId) return;
    save.setSaveError("");
    save.setHasAttemptedSave(false);
    purchases.setPendingPurchases([]);
    if (warband) {
      setWarbandForm({ name: warband.name, faction: warband.faction });
    }
    extras.onStartEditing?.();
    forms.initializeForms(units);
    creation.resetCreationForm();
    setIsEditing(true);
  };

  const cancelEditing = () => {
    finishSession();
    save.setSaveError("");
    save.setHasAttemptedSave(false);
    if (warband) {
      setWarbandForm({ name: warband.name, faction: warband.faction });
    }
  };

  /** Edits Cancel would lose: changed or dismissed units, queued purchases, a typed draft. */
  const isDirty =
    isEditing &&
    (forms.removedIds.length > 0 ||
      purchases.pendingPurchases.length > 0 ||
      forms.forms.some(
        (form) => !form.id || forms.originalFormsRef.current?.get(form.id) !== JSON.stringify(form)
      ) ||
      (creation.isAdding &&
        kind.editor.creation.isDraftDirty(creation.newForm, creation.raceQuery)) ||
      Boolean(
        warband && (warbandForm.name !== warband.name || warbandForm.faction !== warband.faction)
      ));

  /** Cancel, asking first when it would lose edits (decision 2). */
  const requestCancel = () => {
    if (!confirmDiscard) {
      cancelEditing();
      return;
    }
    confirmDiscard({
      isDirty,
      message: `Discard your unsaved changes to ${kind.labels.plural}?`,
      discard: cancelEditing,
    });
  };

  /** A pending "New Skill/Spell/Special" entry opens edit mode on that unit's tab. */
  const editPendingEntry = (unitId: number, tab: PendingTab) => {
    setPendingEditFocus({ unitId, tab });
    startEditing();
  };

  /** Dismiss an existing unit (on Save) or drop a queued recruit, with its queued purchases. */
  const removeForm = (index: number) => {
    const form = forms.forms[index];
    const purchaseKey = form?.id ?? form?.draftKey;
    if (purchaseKey) {
      purchases.dropUnitPurchases(purchaseKey);
    }
    forms.removeForm(index);
  };

  /** Queue a copy of a unit as a new recruit (ROST-NEW-01), unless the kind's cap is reached. */
  const duplicateForm = (index: number) => {
    const source = forms.forms[index];
    if (!source || limits.duplicateBlockedReason(source)) return;
    forms.appendForm(kind.editor.creation.duplicate(source));
  };

  /** The mobile top bar's jump list: each form, then the add entry while the add form is closed. */
  const navigationItems = useMemo(() => {
    const items = forms.forms.map((form, index) => {
      const value = form.id ? `${kind.labels.formIdPrefix}-${form.id}` : `draft-${index}`;
      return {
        value,
        label: form.name.trim() || (kind.labelsFor?.(form) ?? kind.labels).newUnit,
        elementId: getWarbandMobileEditItemId(kind.section, value),
      };
    });
    if (!creation.isAdding) {
      items.push({
        value: "add-new",
        label: kind.labels.addNew,
        elementId: getWarbandMobileEditItemId(kind.section, "add-new"),
      });
    }
    return items;
  }, [creation.isAdding, forms.forms, kind]);

  const addCreatedSkill = (index: number, skill: Skill) =>
    forms.updateForm(index, (current) => kind.editor.addCreatedSkill(current, skill));

  /** A card's unit changed (its own mutation already updated the sheet and its summary). */
  const replaceUnit = (updated: Unit<K>) => {
    onUnitsChange(units.map((unit) => (unit.id === updated.id ? updated : unit)));
  };

  /** A unit added outside an edit (a hire; its own mutation already updated the sheet). */
  const addUnit = (added: Unit<K>) => {
    onUnitsChange([...units.filter((unit) => unit.id !== added.id), added]);
  };

  /** Henchmen: Lad's Got Talent promoted the group's last member (promote/ wrote the summary). */
  const removeUnit = (unitId: number) => {
    onUnitsChange(units.filter((unit) => unit.id !== unitId));
    forms.setExpandedId((current) => (current === unitId ? null : current));
  };

  return {
    kind,
    isEditing,
    pendingEditFocus,
    forms,
    creation,
    limits,
    purchases,
    formExtras: extras.cardProps,
    save,
    startEditing,
    cancelEditing,
    requestCancel,
    isDirty,
    editPendingEntry,
    removeForm,
    duplicateForm,
    addCreatedSkill,
    replaceUnit,
    addUnit,
    removeUnit,
    navigationItems,
    /** The caps and counts the section compares against. */
    roster,
    toggleExpanded: (unitId: number) =>
      forms.setExpandedId(forms.expandedId === unitId ? null : unitId),
  };
}

export type UnitSectionEditor<K extends UnitKindKey> = ReturnType<typeof useUnitSectionEditor<K>>;
