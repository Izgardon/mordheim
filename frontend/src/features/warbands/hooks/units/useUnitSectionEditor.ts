import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useWarbandCacheUpdate } from "../../api/warband-cache";
import { getWarbandMobileEditItemId } from "../warband/useWarbandMobileTopBar";
import { unitApi } from "../../units/unit-api";
import { useUnitCreationForm } from "./useUnitCreationForm";
import { useUnitForms } from "./useUnitForms";
import { useUnitPendingPurchases } from "./useUnitPendingPurchases";
import { useUnitSave } from "./useUnitSave";

import type { Skill } from "@/features/skills/types/skill-types";
import type { PendingTab } from "../../components/units/UnitListBlocks";
import type { Unit, UnitForm, UnitKindKey } from "../../types/units";
import type { Warband, WarbandUpdatePayload } from "../../types/warband-types";
import type { RosterLimits, UnitKindConfig } from "../../units/unit-kind-types";

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
};

export type PendingEditFocus = { unitId: number; tab: PendingTab };

/**
 * One roster section's edit session (design 0.28 §5.3): forms, the add form and its immediate
 * create, dismissals, queued purchases, Save and Cancel. Replaces the nine per-kind hooks.
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
  }: UnitSectionEditorOptions<K>
) {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [pendingEditFocus, setPendingEditFocus] = useState<PendingEditFocus | null>(null);
  const [warbandForm, setWarbandForm] = useState<WarbandUpdatePayload>({ name: "", faction: "" });
  const sessionInitialIdsRef = useRef<number[]>([]);
  const updateWarbandCache = useWarbandCacheUpdate();
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

  const appendFormAsync = useCallback(
    async (formEntry: UnitForm<K>) => {
      const created = await unitApi(kind.key).create(
        warbandId,
        kind.editor.creation.buildPayload(formEntry)
      );
      const createdForm = kind.editor.creation.formAfterCreate(formEntry, created);
      forms.appendForm(createdForm);
      forms.originalFormsRef.current?.set(created.id, JSON.stringify(createdForm));
      onUnitsChange([...units, created]);
      forms.setExpandedId(created.id);
      updateWarbandCache(warbandId, { [kind.listKey]: [created] });
    },
    [forms, kind, onUnitsChange, units, updateWarbandCache, warbandId]
  );

  const creation = useUnitCreationForm(kind, {
    isCreateBlocked: (newForm) => limitsFor(newForm).isCreateBlocked,
    appendForm: appendFormAsync,
  });
  const limits = limitsFor(creation.newForm);

  const finishSession = () => {
    forms.resetForms();
    creation.resetCreationForm();
    setIsEditing(false);
    setPendingEditFocus(null);
    purchases.setPendingPurchases([]);
    sessionInitialIdsRef.current = [];
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
    sessionInitialIds: sessionInitialIdsRef.current,
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

  const startEditing = async () => {
    if (!canEdit || !warbandId) return;
    save.setSaveError("");
    save.setHasAttemptedSave(false);
    purchases.setPendingPurchases([]);
    if (warband) {
      setWarbandForm({ name: warband.name, faction: warband.faction });
    }
    extras.onStartEditing?.();
    setIsLoadingDetails(true);
    try {
      const detailed = await unitApi(kind.key).listDetails(warbandId);
      sessionInitialIdsRef.current = detailed.map((unit) => unit.id);
      onUnitsChange(detailed);
      forms.initializeForms(detailed);
      creation.resetCreationForm();
      setIsEditing(true);
    } catch (err) {
      const fallback = kind.labels.loadDetailsError;
      save.setSaveError(err instanceof Error ? err.message || fallback : fallback);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const cancelEditing = () => {
    finishSession();
    save.setSaveError("");
    save.setHasAttemptedSave(false);
    if (warband) {
      setWarbandForm({ name: warband.name, faction: warband.faction });
    }
  };

  /** A pending "New Skill/Spell/Special" entry opens edit mode on that unit's tab. */
  const editPendingEntry = async (unitId: number, tab: PendingTab) => {
    setPendingEditFocus({ unitId, tab });
    await startEditing();
  };

  const removeForm = (index: number) => {
    const unitId = forms.forms[index]?.id;
    if (unitId) {
      purchases.dropUnitPurchases(unitId);
    }
    forms.removeForm(index);
  };

  /** The mobile top bar's jump list: each form, then the add entry while the add form is closed. */
  const navigationItems = useMemo(() => {
    const items = forms.forms.map((form, index) => {
      const value = form.id ? `${kind.labels.formIdPrefix}-${form.id}` : `draft-${index}`;
      return {
        value,
        label: form.name.trim() || kind.labels.newUnit,
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

  /** Henchmen and hired swords announce card updates (a summary refetch); heroes don't. */
  const replaceUnit = (updated: Unit<K>) => {
    onUnitsChange(units.map((unit) => (unit.id === updated.id ? updated : unit)));
    if (kind.flags.announcesUnitUpdates) {
      updateWarbandCache(warbandId, { [kind.listKey]: [updated] });
    }
  };

  /** Henchmen: Lad's Got Talent promoted the group's last member. */
  const removeUnit = (unitId: number) => {
    onUnitsChange(units.filter((unit) => unit.id !== unitId));
    updateWarbandCache(warbandId, { removedHenchmenGroupIds: [unitId] });
    forms.setExpandedId((current) => (current === unitId ? null : current));
  };

  return {
    kind,
    isEditing,
    isLoadingDetails,
    pendingEditFocus,
    forms,
    creation,
    limits,
    purchases,
    formExtras: extras.cardProps,
    save,
    startEditing,
    cancelEditing,
    editPendingEntry,
    removeForm,
    addCreatedSkill,
    replaceUnit,
    removeUnit,
    navigationItems,
    toggleExpanded: (unitId: number) =>
      forms.setExpandedId(forms.expandedId === unitId ? null : unitId),
  };
}

export type UnitSectionEditor<K extends UnitKindKey> = ReturnType<typeof useUnitSectionEditor<K>>;
