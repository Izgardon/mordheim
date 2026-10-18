/**
 * Taking a copy off a unit's edit card in roster edit mode takes its queued purchase with it, so
 * Save neither charges for it nor adds it back: for a saved unit (by id) and for a queued recruit
 * (by the draft key its purchases are filed under).
 */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useUnitLoadout } from "./useUnitLoadout";
import { useHenchmenLoadoutEditing } from "../../components/units/kinds/henchmen/useHenchmenLoadoutEditing";
import { mapHeroToForm } from "@/features/warbands/units/kinds/hero";
import { mapHenchmenGroupToForm } from "@/features/warbands/units/kinds/henchmen";
import { makeVeteranHenchmenGroup, makeVeteranHero } from "@/test/warband-fixtures";

import type { UnitFormSlotProps } from "../../components/units/forms/form-types";
import type { HenchmenGroupFormEntry, HeroFormEntry } from "../../types/warband-types";

const removeFromHero = (unit: HeroFormEntry) => {
  const onPendingPurchaseRemove = vi.fn();
  const { result } = renderHook(() =>
    useUnitLoadout({
      unit,
      index: 0,
      campaignId: 1,
      availableItems: [],
      availableSkills: [],
      availableSpells: [],
      availableSpecials: [],
      unitType: "heroes",
      deferItemCommit: true,
      onPendingPurchaseRemove,
      onUpdate: vi.fn(),
      onSkillCreated: vi.fn(),
    })
  );
  // The veteran hero's second item is a Dagger (id 102).
  act(() => result.current.handleRemoveItem(1));
  return onPendingPurchaseRemove;
};

const removeFromGroup = (form: HenchmenGroupFormEntry) => {
  const onPendingPurchaseRemove = vi.fn();
  const props = {
    form,
    index: 0,
    onUpdate: vi.fn(),
    onSkillCreated: vi.fn(),
    deferItemCommit: true,
    onPendingPurchaseRemove,
  } as Partial<UnitFormSlotProps<"henchmen_group">> as UnitFormSlotProps<"henchmen_group">;
  const { result } = renderHook(() => useHenchmenLoadoutEditing(props, vi.fn()));
  // The veteran group's first item is a Club (id 104).
  act(() => result.current.handleRemoveItem(0));
  return onPendingPurchaseRemove;
};

describe("removing a bought copy in roster edit mode", () => {
  it("drops a saved hero's queued purchase of that item", () => {
    expect(removeFromHero(mapHeroToForm(makeVeteranHero()))).toHaveBeenCalledWith({
      unitType: "heroes",
      unitId: "11",
      itemId: 102,
    });
  });

  it("drops a queued recruit's queued purchase, filed under its draft key", () => {
    const recruit = {
      ...mapHeroToForm(makeVeteranHero()),
      id: undefined,
      draftKey: "draft-heroes-7",
    };

    expect(removeFromHero(recruit)).toHaveBeenCalledWith({
      unitType: "heroes",
      unitId: "draft-heroes-7",
      itemId: 102,
    });
  });

  it("drops a queued henchmen group's queued purchase, filed under its draft key", () => {
    const group = {
      ...mapHenchmenGroupToForm(makeVeteranHenchmenGroup()),
      id: undefined,
      draftKey: "draft-henchmen-3",
    };

    expect(removeFromGroup(group)).toHaveBeenCalledWith({
      unitType: "henchmen",
      unitId: "draft-henchmen-3",
      itemId: 104,
    });
  });
});
