/**
 * Deleting a custom spell from the Spells page's form (`AddSpellForm`; the warband pages'
 * `CreateSpellDialog` creates only): the confirm asks `usage/` first and says what will happen
 * (decision 5, CAT-TWEAK-04), and a refused delete's reason shows in the confirm (BUG-148).
 */
import { screen, waitFor, within } from "@testing-library/react";
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
const USAGE = "GET /spells/950/usage/";
const UNUSED = { units: 0, warbands: 0, stashes: 0, bestiary_entries: 0 };

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

  it("asks what uses it first; nothing does, so the confirm says it is deleted for good, then one DELETE (BUG-16, CAT-TWEAK-04)", async () => {
    const user = setupUser();
    fakeApi.on(USAGE, UNUSED);
    fakeApi.on(DELETE, null);
    const { onDeleted, queryClient, cachedNames } = renderForm();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const confirm = screen.getByRole("dialog", { name: "Delete spell" });
    expect(
      await within(confirm).findByText(
        "Delete Gutter Hex? Nothing uses it, so it is deleted for good."
      )
    ).toBeVisible();
    await user.click(within(confirm).getByRole("button", { name: "Delete spell" }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(950));
    expect(fakeApi.calls()).toEqual([USAGE, DELETE]);
    expect(cachedNames()).toEqual(["Fires of U'Zhul"]);
    expect(queryClient.getQueryState(SPELLS_KEY)?.isInvalidated).toBe(true);
  });

  it("sends nothing but the usage check when the confirm is cancelled", async () => {
    const user = setupUser();
    fakeApi.on(USAGE, UNUSED);
    renderForm();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));

    expect(fakeApi.calls()).toEqual([USAGE]);
  });

  it("shows a refused delete's reason in the confirm, which stays open with the entry still listed, and nothing in the form behind it (BUG-148)", async () => {
    const user = setupUser();
    const detail = "You do not have permission to perform this action.";
    fakeApi.on(USAGE, UNUSED);
    fakeApi.fail(DELETE, new ApiError(detail, 403, { detail }));
    const { onDeleted, cachedNames } = renderForm();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const confirm = screen.getByRole("dialog", { name: "Delete spell" });
    await within(confirm).findByText(/deleted for good/);
    await user.click(within(confirm).getByRole("button", { name: "Delete spell" }));

    const reason = await screen.findByRole("alert");
    expect(reason).toHaveTextContent(detail);
    expect(screen.getByRole("dialog", { name: "Delete spell" })).toContainElement(reason);
    expect(screen.getAllByText(detail)).toHaveLength(1);
    expect(onDeleted).not.toHaveBeenCalled();
    expect(cachedNames()).toContain("Gutter Hex");
  });
});
