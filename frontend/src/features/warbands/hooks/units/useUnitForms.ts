import { useCallback, useRef, useState } from "react";

import type { Unit, UnitForm, UnitKindKey } from "../../types/units";
import type { UnitKindConfig } from "../../units/unit-kind-types";

/**
 * The section's edit forms: one per unit, the units marked for dismissal, the expanded card and
 * a JSON snapshot per unit so Save only PATCHes forms that changed.
 */
export function useUnitForms<K extends UnitKindKey>(kind: UnitKindConfig<K>) {
  const [forms, setForms] = useState<UnitForm<K>[]>([]);
  const [removedIds, setRemovedIds] = useState<number[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const originalFormsRef = useRef<Map<number, string>>(new Map());
  // Each unit's version when the edit began, which Save sends back (a 409 if it moved since).
  const versionsRef = useRef<Map<number, string>>(new Map());

  const initializeForms = useCallback(
    (units: Unit<K>[]) => {
      const mapped = units.map(kind.mapToForm);
      setForms(mapped);
      setRemovedIds([]);
      const snapshot = new Map<number, string>();
      for (const form of mapped) {
        if (form.id) snapshot.set(form.id, JSON.stringify(form));
      }
      originalFormsRef.current = snapshot;
      versionsRef.current = new Map(
        units.flatMap((unit) => (unit.updated_at ? [[unit.id, unit.updated_at] as const] : []))
      );
    },
    [kind]
  );

  const resetForms = useCallback(() => {
    setForms([]);
    setRemovedIds([]);
    setExpandedId(null);
    originalFormsRef.current = new Map();
    versionsRef.current = new Map();
  }, []);

  const updateForm = useCallback((index: number, updater: (form: UnitForm<K>) => UnitForm<K>) => {
    setForms((prev) => prev.map((form, idx) => (idx === index ? updater(form) : form)));
  }, []);

  const removeForm = useCallback((index: number) => {
    setForms((prev) => {
      const form = prev[index];
      if (form?.id) {
        setRemovedIds((current) => [...current, form.id as number]);
      }
      return prev.filter((_, idx) => idx !== index);
    });
  }, []);

  /** A new hero leader takes the crown from the other forms (forms only: BUG-30). */
  const appendForm = useCallback(
    (form: UnitForm<K>) => {
      setForms((prev) =>
        kind.flags.canLead && "is_leader" in form && form.is_leader
          ? [...prev.map((entry) => ({ ...entry, is_leader: false })), form]
          : [...prev, form]
      );
    },
    [kind]
  );

  /** Heroes only: one leader at a time. */
  const setLeaderForm = useCallback((index: number, isLeader: boolean) => {
    setForms((prev) => {
      if (!prev[index]) {
        return prev;
      }
      if (isLeader) {
        return prev.map((form, idx) => ({ ...form, is_leader: idx === index }));
      }
      return prev.map((form, idx) => (idx === index ? { ...form, is_leader: false } : form));
    });
  }, []);

  return {
    forms,
    removedIds,
    updateForm,
    removeForm,
    appendForm,
    setLeaderForm,
    expandedId,
    setExpandedId,
    initializeForms,
    resetForms,
    originalFormsRef,
    versionsRef,
  };
}
