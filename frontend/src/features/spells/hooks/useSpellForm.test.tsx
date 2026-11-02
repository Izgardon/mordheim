/**
 * A lore has one spell on each roll: a spell saved on a roll its lore already holds comes back with
 * none and a warning, which the form shows; the cached list keeps the spell without it.
 */
import { act, renderHook } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
