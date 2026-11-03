import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeApi } from "@/test/fake-api";
import { createQueryWrapper } from "@/test/query-test-utils";
import { makeHero } from "@/test/warband-fixtures";

import { statsPayload, useUnitEditDraft } from "./useUnitEditDraft";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("../../../api/warband-cache", () => ({ useWarbandCacheUpdate: () => () => undefined }));

describe("statsPayload", () => {
  it("saves an empty stat box as 0 and an empty save as none", () => {
    const stats = statsPayload({
      movement: "",
      weapon_skill: "4",
      ballistic_skill: null,
      strength: 3,
      armour_save: "",
    });
    expect(stats).toMatchObject({
      movement: 0,
      weapon_skill: 4,
      ballistic_skill: 0,
      strength: 3,
      toughness: 0,
      leadership: 0,
      armour_save: null,
    });
  });

  it("keeps a typed save", () => {
    expect(statsPayload({ armour_save: "5" }).armour_save).toBe(5);
  });
});

describe("statsPayload with written values", () => {
  it("sends a written stat as typed for the server to read", () => {
    const stats = statsPayload({
      attacks: "1(2)",
      weapon_skill: " D6 ",
      strength: "-",
      toughness: "3",
    });
    expect(stats).toMatchObject({
      attacks: "1(2)",
      weapon_skill: "D6",
      strength: "-",
      toughness: 3,
    });
  });
});

describe("useUnitEditDraft's save", () => {
  beforeEach(() => fakeApi.reset());

  it("edits a written stat as it shows, its number then its text, and saves it so", async () => {
    fakeApi.on("POST /warbands/9/heroes/batch/", { units: [], summary: {} });
    const hero = makeHero({ id: 5, attacks: 2, strength: 3, written_stats: { attacks: "(2)" } });
    const { result } = renderHook(() => useUnitEditDraft({ kind: "hero", unit: hero }, 1, 9), {
      wrapper: createQueryWrapper(),
    });

    expect(result.current.draft.attacks).toBe("2(2)");
    act(() => result.current.set("strength", "4"));
    await act(() => result.current.save());

    const body = fakeApi.bodyOf("POST /warbands/9/heroes/batch/") as {
      update: Record<string, unknown>[];
    };
    expect([body.update[0].strength, body.update[0].attacks]).toEqual([4, "2(2)"]);
  });
});
