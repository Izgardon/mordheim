/**
 * A lore has one spell on each roll: a spell saved on a roll its lore already holds comes back with
 * none and a warning, which the form shows; the cached list keeps the spell without it. Its Kind
 * (Spell or Prayer: William, 26 Nov 2026) is sent as `is_prayer`, a new spell taking its lore's
 * until the Kind is picked.
 */
import { act, renderHook } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { spell } from "@/test/catalogue-fixtures";
import { fakeApi } from "@/test/fake-api";
import { createQueryWrapper, createTestQueryClient } from "@/test/query-test-utils";

import { useSpellForm } from "./useSpellForm";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { warning: vi.fn(), error: vi.fn() }) }));

const WARNING = "Fires of U'Zhul already has the roll of 1 in Lesser Magic: saved with no roll";

describe("Saving a spell", () => {
  beforeEach(() => {
    fakeApi.reset();
    vi.mocked(toast.warning).mockClear();
  });

  it("shows the warning when its roll was taken, and caches the spell without it", async () => {
    fakeApi.on("POST /spells/", {
      id: 9,
      campaign_id: 4,
      name: "Ember",
      type: "Lesser Magic",
      description: "Hot.",
      dc: "7",
      roll: null,
      warnings: [WARNING],
    });
    const onSaved = vi.fn();
    const { result } = renderHook(
      () =>
        useSpellForm({
          campaignId: 4,
          spell: null,
          typeOptions: ["Lesser Magic"],
          resetKey: 0,
          onSaved,
        }),
      { wrapper: createQueryWrapper(createTestQueryClient()) }
    );
    act(() => {
      result.current.setValue("name", "Ember");
      result.current.setValue("description", "Hot.");
      result.current.setValue("roll", "1");
      result.current.typeField.select("Lesser Magic");
    });
    await act(() => result.current.save());

    expect(fakeApi.bodyOf("POST /spells/")).toMatchObject({ roll: 1, type: "Lesser Magic" });
    expect(toast.warning).toHaveBeenCalledWith(WARNING);
    expect(onSaved).toHaveBeenCalledWith(
      expect.not.objectContaining({ warnings: expect.anything() })
    );
    expect(onSaved.mock.calls[0][0]).toMatchObject({ id: 9, roll: null });
  });
});

describe("A spell's kind", () => {
  const soulfire = spell({ id: 3, name: "Soulfire", type: "Prayers of Sigmar", is_prayer: true });
  const render = (editing: ReturnType<typeof spell> | null = null) =>
    renderHook(
      () =>
        useSpellForm({
          campaignId: 4,
          spell: editing,
          typeOptions: ["Prayers of Sigmar", "Lesser Magic"],
          resetKey: 0,
          onSaved: vi.fn(),
        }),
      { wrapper: createQueryWrapper(createTestQueryClient()) }
    );
  beforeEach(() => {
    fakeApi.reset();
    fakeApi.on("GET /spells/?campaign_id=4", [soulfire]);
    fakeApi.on("POST /spells/", { ...soulfire, id: 10 });
    fakeApi.on("PATCH /spells/3/", soulfire);
  });
  const fill = (result: ReturnType<typeof render>["result"], lore: string) =>
    act(() => {
      result.current.setValue("name", "Blessing");
      result.current.setValue("description", "Holy.");
      result.current.typeField.select(lore);
    });

  it("is a new spell's lore's until it is picked, and is sent as is_prayer", async () => {
    const { result } = render();
    // the campaign's spells say which lores are prayer lists
    await vi.waitFor(() => {
      fill(result, "Prayers of Sigmar");
      expect(result.current.values.kind).toBe("prayer");
    });
    fill(result, "Lesser Magic");
    expect(result.current.values.kind).toBe("spell");
    fill(result, "Prayers of Sigmar");
    await act(() => result.current.save());
    expect(fakeApi.bodyOf("POST /spells/")).toMatchObject({ is_prayer: true });

    act(() => result.current.setKind("spell"));
    fill(result, "Prayers of Sigmar");
    expect(result.current.values.kind).toBe("spell"); // picked: the lore no longer sets it
  });

  it("is a spell's own when it is edited, whatever its lore", async () => {
    const { result } = render(soulfire);
    expect(result.current.values.kind).toBe("prayer");
    act(() => result.current.setKind("spell"));
    await act(() => result.current.save());
    expect(fakeApi.bodyOf("PATCH /spells/3/")).toMatchObject({ is_prayer: false });
  });
});
