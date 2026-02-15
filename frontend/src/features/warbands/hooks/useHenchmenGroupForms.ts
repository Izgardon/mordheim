import { useCallback, useRef, useState } from "react";

import type { HenchmenGroup, HenchmenGroupFormEntry } from "../types/warband-types";

type UseHenchmenGroupFormsParams = {
  groups: HenchmenGroup[];
  mapGroupToForm: (group: HenchmenGroup) => HenchmenGroupFormEntry;
};

export function useHenchmenGroupForms({ groups, mapGroupToForm }: UseHenchmenGroupFormsParams) {
  const [groupForms, setGroupForms] = useState<HenchmenGroupFormEntry[]>([]);
  const [removedGroupIds, setRemovedGroupIds] = useState<number[]>([]);
  const [expandedGroupId, setExpandedGroupId] = useState<number | null>(null);
  const originalGroupFormsRef = useRef<Map<number, string>>(new Map());

  const initializeGroupForms = useCallback((sourceGroups?: HenchmenGroup[]) => {
    const resolved = sourceGroups ?? groups;
    const mapped = resolved.map(mapGroupToForm);
    setGroupForms(mapped);
    setRemovedGroupIds([]);
    const snapshot = new Map<number, string>();
    for (const form of mapped) {
      if (form.id) snapshot.set(form.id, JSON.stringify(form));
    }
    originalGroupFormsRef.current = snapshot;
  }, [groups, mapGroupToForm]);

  const resetGroupForms = useCallback(() => {
    setGroupForms([]);
    setRemovedGroupIds([]);
    setExpandedGroupId(null);
    originalGroupFormsRef.current = new Map();
  }, []);

  const updateGroupForm = useCallback(
    (index: number, updater: (group: HenchmenGroupFormEntry) => HenchmenGroupFormEntry) => {
      setGroupForms((prev) => prev.map((group, idx) => (idx === index ? updater(group) : group)));
    },
    []
  );

  const removeGroupForm = useCallback((index: number) => {
    setGroupForms((prev) => {
      const group = prev[index];
      if (group?.id) {
        setRemovedGroupIds((current) => [...current, group.id as number]);
      }
      return prev.filter((_, idx) => idx !== index);
    });
  }, []);

  const appendGroupForm = useCallback((group: HenchmenGroupFormEntry) => {
    setGroupForms((prev) => [...prev, group]);
  }, []);

  return {
    groupForms,
    setGroupForms,
    removedGroupIds,
    updateGroupForm,
    removeGroupForm,
    appendGroupForm,
    expandedGroupId,
    setExpandedGroupId,
    initializeGroupForms,
    resetGroupForms,
    originalGroupFormsRef,
  };
}
