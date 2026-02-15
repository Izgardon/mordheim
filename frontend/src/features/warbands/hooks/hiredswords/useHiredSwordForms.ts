import { useCallback, useRef, useState } from "react";

import type { HiredSwordFormEntry, WarbandHiredSword } from "@/features/warbands/types/warband-types";

type UseHiredSwordFormsParams = {
  hiredSwords: WarbandHiredSword[];
  mapHiredSwordToForm: (hiredSword: WarbandHiredSword) => HiredSwordFormEntry;
};

export function useHiredSwordForms({ hiredSwords, mapHiredSwordToForm }: UseHiredSwordFormsParams) {
  const [hiredSwordForms, setHiredSwordForms] = useState<HiredSwordFormEntry[]>([]);
  const [removedHiredSwordIds, setRemovedHiredSwordIds] = useState<number[]>([]);
  const [expandedHiredSwordId, setExpandedHiredSwordId] = useState<number | null>(null);
  const originalFormsRef = useRef<Map<number, string>>(new Map());

  const initializeHiredSwordForms = useCallback((source?: WarbandHiredSword[]) => {
    const resolved = source ?? hiredSwords;
    const mapped = resolved.map(mapHiredSwordToForm);
    setHiredSwordForms(mapped);
    setRemovedHiredSwordIds([]);
    const snapshot = new Map<number, string>();
    for (const form of mapped) {
      if (form.id) snapshot.set(form.id, JSON.stringify(form));
    }
    originalFormsRef.current = snapshot;
  }, [hiredSwords, mapHiredSwordToForm]);

  const resetHiredSwordForms = useCallback(() => {
    setHiredSwordForms([]);
    setRemovedHiredSwordIds([]);
    setExpandedHiredSwordId(null);
    originalFormsRef.current = new Map();
  }, []);

  const updateHiredSwordForm = useCallback(
    (index: number, updater: (entry: HiredSwordFormEntry) => HiredSwordFormEntry) => {
      setHiredSwordForms((prev) => prev.map((entry, idx) => (idx === index ? updater(entry) : entry)));
    },
    []
  );

  const removeHiredSwordForm = useCallback((index: number) => {
    setHiredSwordForms((prev) => {
      const entry = prev[index];
      if (entry?.id) {
        setRemovedHiredSwordIds((current) => [...current, entry.id as number]);
      }
      return prev.filter((_, idx) => idx !== index);
    });
  }, []);

  const appendHiredSwordForm = useCallback((entry: HiredSwordFormEntry) => {
    setHiredSwordForms((prev) => [...prev, entry]);
  }, []);

  return {
    hiredSwordForms,
    setHiredSwordForms,
    removedHiredSwordIds,
    updateHiredSwordForm,
    removeHiredSwordForm,
    appendHiredSwordForm,
    expandedHiredSwordId,
    setExpandedHiredSwordId,
    initializeHiredSwordForms,
    resetHiredSwordForms,
    originalFormsRef,
  };
}
