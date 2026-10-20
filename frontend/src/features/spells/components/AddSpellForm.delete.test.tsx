/**
 * Deleting a custom spell from the Spells page's form (`AddSpellForm`; the warband pages'
 * `CreateSpellDialog` creates only): the confirm's copy, the one DELETE it sends with no usage
 * check, and a refused delete's reason shown in the confirm (BUG-148). The server removes the
 * spell from every unit that knows it (BUG-16); PR A answers 409 `in_use` instead, and PR C asks
 * `usage/` first.
 */
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { SPELLS, gutterHex } from "@/test/catalogue-fixtures";
import { fakeApi } from "@/test/fake-api";
import { createTestQueryClient, renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";
import AddSpellForm from "./AddSpellForm";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const SPELLS_KEY = queryKeys.campaign.catalogue(1, "spells");
const DELETE = "DELETE /spells/950/";

function renderForm(canDelete = true) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(SPELLS_KEY, SPELLS);
  const onDeleted = vi.fn();
  renderWithQueryClient(
    <AddSpellForm
      campaignId={1}
      editingSpell={gutterHex}
      canDelete={canDelete}
      typeOptions={["Lesser Magic"]}
      onCreated={vi.fn()}
      onDeleted={onDeleted}
      onCancel={vi.fn()}
    />,
    { queryClient }
  );
  const cachedNames = () =>
    (queryClient.getQueryData<typeof SPELLS>(SPELLS_KEY) ?? []).map((entry) => entry.name);
  return { onDeleted, queryClient, cachedNames };
}

beforeEach(() => {
  fakeApi.reset();
});

describe("AddSpellForm: Delete", () => {
  it("offers no Delete to someone without delete_catalogue (decision 5)", async () => {
    renderForm(false);

    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeVisible();
  });

  // Characterises current behaviour (BUG-16, CAT-TWEAK-04, pinned; flips in PR C)
  it('says only "This action cannot be undone", then sends one DELETE with no usage check (BUG-16, pinned; flips in PR C)', async () => {
    const user = setupUser();
    fakeApi.on(DELETE, undefined);
    const { onDeleted, queryClient, cachedNames } = renderForm();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const confirm = screen.getByRole("dialog", { name: "Delete spell" });
    expect(confirm).toHaveTextContent("Delete Gutter Hex? This action cannot be undone.");
    await user.click(within(confirm).getByRole("button", { name: "Delete spell" }));

    expect(fakeApi.calls()).toEqual([DELETE]);
    expect(onDeleted).toHaveBeenCalledWith(950);
    expect(cachedNames()).toEqual(["Fires of U'Zhul"]);
    expect(queryClient.getQueryState(SPELLS_KEY)?.isInvalidated).toBe(true);
  });

  it("sends nothing when the confirm is cancelled", async () => {
    const user = setupUser();
    renderForm();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));

    expect(fakeApi.calls()).toEqual([]);
  });

  it("shows what holds an entry in use in the confirm, which stays open with the entry still listed, and nothing in the form behind it (BUG-148, BUG-16)", async () => {
    const user = setupUser();
    const detail = "This spell is in use, so nothing was deleted.";
    const usage = { units: 1, warbands: 1, stashes: 0, bestiary_entries: 0 };
    fakeApi.fail(DELETE, new ApiError(detail, 409, { detail, code: "in_use", fields: {}, usage }));
    const counts = "Used by 1 unit in 1 warband; nothing was deleted.";
    const { onDeleted, cachedNames } = renderForm();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Delete spell" })
    );

    const reason = await screen.findByRole("alert");
    expect(reason).toHaveTextContent(counts);
    expect(screen.getByRole("dialog", { name: "Delete spell" })).toContainElement(reason);
    expect(screen.getAllByText(counts)).toHaveLength(1);
    expect(onDeleted).not.toHaveBeenCalled();
    expect(cachedNames()).toContain("Gutter Hex");
  });
});
