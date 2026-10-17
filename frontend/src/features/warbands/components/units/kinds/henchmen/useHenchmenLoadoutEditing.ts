import { useState } from "react";

import { isPendingByType } from "../../../heroes/utils/pending-entries";

import type { Item } from "@/features/items/types/item-types";
import type { Skill } from "@/features/skills/types/skill-types";
import type { Special } from "@/features/special/types/special-types";
import type { HenchmenGroupFormEntry } from "../../../../types/warband-types";
import type { UnitFormSlotProps } from "../../forms/form-types";

/** Open/close and query state of one "+ Add" search, as AssignedEntries takes it. */
function useEntrySearch() {
  const [isAdding, setIsAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const stop = () => {
    setIsAdding(false);
    setQuery("");
  };
  return {
    query,
    setQuery,
    isDialogOpen,
    setIsDialogOpen,
    stop,
    search: {
      isAdding,
      onStartAdding: () => setIsAdding(true),
      onStopAdding: stop,
      query,
      onQueryChange: setQuery,
      onCreateClick: () => setIsDialogOpen(true),
    },
  };
}

/** Removes the first pending placeholder ("New Skill"/"New Special") when an entry is added. */
const withoutFirstPending = <T extends { type?: string | null }>(entries: T[]) => {
  const pendingIdx = entries.findIndex((entry) => isPendingByType(entry));
  return pendingIdx !== -1 ? entries.filter((_, i) => i !== pendingIdx) : entries;
};

const isLarge = (entry: { name: string }) => entry.name.trim().toLowerCase() === "large";

/** Adding and removing the group's items, skills and specials on its edit card. */
export function useHenchmenLoadoutEditing(
  {
    form: group,
    index,
    onUpdate,
    onSkillCreated,
    deferItemCommit,
    onPendingPurchaseRemove,
  }: UnitFormSlotProps<"henchmen_group">,
  openBuyDialog: (item: Item) => void
) {
  const items = useEntrySearch();
  const skills = useEntrySearch();
  const specials = useEntrySearch();
  const update = (updater: (current: HenchmenGroupFormEntry) => HenchmenGroupFormEntry) =>
    onUpdate(index, updater);

  const handleAddSpecial = (entry: Special) => {
    update((current) => ({
      ...current,
      ...(isLarge(entry) ? { large: true } : {}),
      specials: [...withoutFirstPending(current.specials), entry],
    }));
    specials.stop();
  };

  return {
    items,
    skills,
    specials,
    handleAddItem: (item: Item) =>
      update((current) => ({ ...current, items: [...current.items, item] })),
    handleSelectItem: (item: Item) => {
      openBuyDialog(item);
      items.stop();
    },
    handleCreatedItem: (item: Item) => {
      items.stop();
      openBuyDialog(item);
    },
    handleRemoveItem: (itemIndex: number) => {
      const removed = group.items[itemIndex];
      update((current) => ({
        ...current,
        items: current.items.filter((_, i) => i !== itemIndex),
      }));
      if (deferItemCommit && removed && group.id && onPendingPurchaseRemove) {
        onPendingPurchaseRemove({
          unitType: "henchmen",
          unitId: String(group.id),
          itemId: removed.id,
        });
      }
    },
    handleAddSkill: (skill: Skill) => {
      update((current) => ({
        ...current,
        skills: [...withoutFirstPending(current.skills), skill],
      }));
      skills.stop();
    },
    // Kept as is: the index is into the visible (non-pending) list but removes from the full one.
    handleRemoveSkill: (skillIndex: number) =>
      update((current) => ({
        ...current,
        skills: current.skills.filter((_, i) => i !== skillIndex),
      })),
    handleCreatedSkill: (skill: Skill) => {
      onSkillCreated(index, skill);
      skills.setQuery("");
    },
    handleAddSpecial,
    handleRemoveSpecial: (specialIndex: number) =>
      update((current) => {
        const removed = current.specials[specialIndex];
        return {
          ...current,
          ...(removed && isLarge(removed) ? { large: false } : {}),
          specials: current.specials.filter((_, i) => i !== specialIndex),
        };
      }),
    handleCreatedSpecial: (entry: Special) => {
      handleAddSpecial(entry);
      specials.setQuery("");
    },
  };
}
