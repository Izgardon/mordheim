/**
 * A skill's pre-battle roll in its Edit dialog (William, 5 Nov 2026): the form opens on the
 * skill's dice and text, and a save sends them, so a campaign's version of a book skill keeps its
 * own (the server makes the version).
 */
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeApi } from "@/test/fake-api";
import { createQueryWrapper, createTestQueryClient } from "@/test/query-test-utils";

import type { Skill } from "../types/skill-types";
import { useSkillForm } from "./useSkillForm";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const SPY: Skill = {
  id: 7,
  campaign_id: null,
  name: "Spy",
  description: "Before the battle commences, re-deploy D3 models.",
  prebattle_roll: "D3",
  prebattle_text: "Re-deploy D3 models.",
};

const renderForm = (skill: Skill | null) =>
  renderHook(
    () =>
      useSkillForm({
        campaignId: 4,
        skill,
        groupIdsOf: () => [],
        resetKey: 0,
        onSaved: vi.fn(),
      }),
    { wrapper: createQueryWrapper(createTestQueryClient()) }
  );

describe("A skill's pre-battle roll", () => {
  beforeEach(() => {
    fakeApi.reset();
  });

  it("opens on the skill's dice and text and saves the changed ones", async () => {
    fakeApi.on("PATCH /skills/7/", { ...SPY, id: 8, campaign_id: 4, prebattle_roll: "D6" });
    const { result } = renderForm(SPY);
    expect(result.current.values).toMatchObject({
      prebattleRoll: "D3",
      prebattleText: "Re-deploy D3 models.",
    });

    act(() => result.current.setPrebattle({ prebattleRoll: "D6", prebattleText: " On a 6. " }));
    await act(() => result.current.save());

    expect(fakeApi.bodyOf("PATCH /skills/7/")).toMatchObject({
      campaign_id: 4,
      prebattle_roll: "D6",
      prebattle_text: "On a 6.",
    });
  });

  it("adds a skill with none", async () => {
    fakeApi.on("POST /skills/", { ...SPY, id: 9, campaign_id: 4, name: "Lookout" });
    const { result } = renderForm(null);
    act(() => {
      result.current.setName("Lookout");
      result.current.setDescription("Watches.");
    });
    await act(() => result.current.save());

    expect(fakeApi.bodyOf("POST /skills/")).toMatchObject({
      prebattle_roll: "",
      prebattle_text: "",
    });
  });
});
