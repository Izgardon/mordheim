import type { PropsWithChildren } from "react";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppStoreProvider, useAppStore } from "./app-store";

import type { Item } from "@/features/items/types/item-types";
import type { Skill } from "@/features/skills/types/skill-types";
import type { Special } from "@/features/special/types/special-types";
import type { Spell } from "@/features/spells/types/spell-types";

vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({ user: null }),
}));

function createWrapper() {
  return function Wrapper({ children }: PropsWithChildren) {
    return <AppStoreProvider>{children}</AppStoreProvider>;
  };
}

describe("app-store catalog caches", () => {
  it("upserts and removes item, skill, spell, and special cache entries by id", () => {
    const { result } = renderHook(() => useAppStore(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setItemsCache("campaign:7", [{ id: 1, name: "Dagger" } as Item]);
      result.current.setSkillsCache("campaign:7", [
        { id: 10, name: "Sprint", type: "Speed" } as Skill,
      ]);
      result.current.setSpellsCache("campaign:7", [
        { id: 20, name: "Fireball", type: "Pyromancy" } as Spell,
      ]);
      result.current.setSpecialsCache("campaign:7", [
        { id: 30, name: "Large", type: "Trait" } as Special,
      ]);
    });

    act(() => {
      result.current.upsertItemCache("campaign:7", { id: 1, name: "Sword" } as Item);
      result.current.upsertSkillCache("campaign:7", {
        id: 11,
        name: "Step Aside",
        type: "Speed",
      } as Skill);
      result.current.upsertSpellCache("campaign:7", {
        id: 20,
        name: "Greater Fireball",
        type: "Pyromancy",
      } as Spell);
      result.current.upsertSpecialCache("campaign:7", {
        id: 31,
        name: "Wizard",
        type: "Trait",
      } as Special);
    });

    expect(result.current.itemsCache["campaign:7"]).toEqual({
      loaded: true,
      data: [{ id: 1, name: "Sword" }],
    });
    expect(result.current.skillsCache["campaign:7"]).toEqual({
      loaded: true,
      data: [
        { id: 11, name: "Step Aside", type: "Speed" },
        { id: 10, name: "Sprint", type: "Speed" },
      ],
    });
    expect(result.current.spellsCache["campaign:7"]).toEqual({
      loaded: true,
      data: [{ id: 20, name: "Greater Fireball", type: "Pyromancy" }],
    });
    expect(result.current.specialsCache["campaign:7"]).toEqual({
      loaded: true,
      data: [
        { id: 31, name: "Wizard", type: "Trait" },
        { id: 30, name: "Large", type: "Trait" },
      ],
    });

    act(() => {
      result.current.removeItemCache("campaign:7", 1);
      result.current.removeSkillCache("campaign:7", 10);
      result.current.removeSpellCache("campaign:7", 20);
      result.current.removeSpecialCache("campaign:7", 30);
    });

    expect(result.current.itemsCache["campaign:7"]).toEqual({ loaded: true, data: [] });
    expect(result.current.skillsCache["campaign:7"]).toEqual({
      loaded: true,
      data: [{ id: 11, name: "Step Aside", type: "Speed" }],
    });
    expect(result.current.spellsCache["campaign:7"]).toEqual({ loaded: true, data: [] });
    expect(result.current.specialsCache["campaign:7"]).toEqual({
      loaded: true,
      data: [{ id: 31, name: "Wizard", type: "Trait" }],
    });
  });

  it("keeps unloaded caches fetchable while exposing optimistic upserts", () => {
    const { result } = renderHook(() => useAppStore(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.upsertSpecialCache("campaign:9", {
        id: 99,
        name: "Blessing",
        type: "Prayer",
      } as Special);
    });

    expect(result.current.specialsCache["campaign:9"]).toEqual({
      loaded: false,
      data: [{ id: 99, name: "Blessing", type: "Prayer" }],
    });
  });
});
