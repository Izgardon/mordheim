/**
 * Deleting a custom spell from the Spells page's form (`AddSpellForm`; the warband pages'
 * `CreateSpellDialog` creates only): the confirm's copy, the one DELETE it sends with no usage
 * check, and what a refused delete looks like. The server removes the spell from every unit that
 * knows it (BUG-16); PR A answers 409 `in_use` instead, and PR C asks `usage/` first.
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

function renderForm() {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(SPELLS_KEY, SPELLS);
  const onDeleted = vi.fn();
  renderWithQueryClient(
    <AddSpellForm
      campaignId={1}
      editingSpell={gutterHex}
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

  // Characterises current behaviour (BUG-16, BUG-148, pinned; flips in PR A)
  it("leaves the confirm open after a refused delete and writes the error into the form behind it (BUG-148, pinned; flips in PR A)", async () => {
    const user = setupUser();
    fakeApi.fail(DELETE, new ApiError("Gutter Hex is known by 1 hero.", 409, { code: "in_use" }));
    const { onDeleted, cachedNames } = renderForm();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Delete spell" })
    );

    expect(await screen.findByText("Gutter Hex is known by 1 hero.")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).not.toHaveTextContent("known by 1 hero");
    expect(onDeleted).not.toHaveBeenCalled();
    expect(cachedNames()).toContain("Gutter Hex");
  });
});
