/**
 * Deleting a custom item from the Wargear page's form (`AddItemForm`) and from the warband pages'
 * dialog (`ItemFormDialog`, whose edit mode no screen opens today): the confirm's copy, the one
 * DELETE it sends with no usage check, and what a refused delete looks like. The server cascades
 * the delete into every warband's copies (BUG-16); PR A answers 409 `in_use` instead, and PR C
 * asks `usage/` first and archives what is in use.
 */
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { ITEMS, rustyCleaver } from "@/test/catalogue-fixtures";
import { fakeApi } from "@/test/fake-api";
import { createTestQueryClient, renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";
import AddItemForm from "./AddItemForm";
import ItemFormDialog from "./ItemFormDialog";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const ITEMS_KEY = queryKeys.campaign.catalogue(1, "items");
const DELETE = "DELETE /items/240/";
const IN_USE = new ApiError("Rusty Cleaver is used by 2 units.", 409, { code: "in_use" });

/** A client holding the campaign's cached item list, as the Wargear page leaves it. */
function clientWithItems() {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(ITEMS_KEY, ITEMS);
  return queryClient;
}

const cachedNames = (queryClient: ReturnType<typeof createTestQueryClient>) =>
  (queryClient.getQueryData<typeof ITEMS>(ITEMS_KEY) ?? []).map((entry) => entry.name);

beforeEach(() => {
  fakeApi.reset();
  fakeApi.on("GET /item-properties/?type=Weapon&campaign_id=1", []);
});

describe("AddItemForm: Delete", () => {
  function renderForm(queryClient = clientWithItems()) {
    const onDeleted = vi.fn();
    renderWithQueryClient(
      <AddItemForm
        campaignId={1}
        editingItem={rustyCleaver}
        onCreated={vi.fn()}
        onDeleted={onDeleted}
        onCancel={vi.fn()}
      />,
      { queryClient }
    );
    return { onDeleted, queryClient };
  }

  // Characterises current behaviour (BUG-16, CAT-TWEAK-04, pinned; flips in PR C)
  it('says only "This action cannot be undone", then sends one DELETE with no usage check (BUG-16, pinned; flips in PR C)', async () => {
    const user = setupUser();
    fakeApi.on(DELETE, undefined);
    const { onDeleted, queryClient } = renderForm();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const confirm = screen.getByRole("dialog");
    expect(confirm).toHaveTextContent("Delete Rusty Cleaver? This action cannot be undone.");
    fakeApi.clearRequests();
    await user.click(within(confirm).getByRole("button", { name: "Delete item" }));

    expect(fakeApi.calls()).toEqual([DELETE]);
    expect(onDeleted).toHaveBeenCalledWith(240);
    expect(cachedNames(queryClient)).not.toContain("Rusty Cleaver");
    expect(queryClient.getQueryState(ITEMS_KEY)?.isInvalidated).toBe(true);
  });

  it("sends nothing when the confirm is cancelled", async () => {
    const user = setupUser();
    renderForm();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    fakeApi.clearRequests();
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));

    expect(fakeApi.calls()).toEqual([]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  // Characterises current behaviour (BUG-16, BUG-148, pinned; flips in PR A)
  it("leaves the confirm open after a refused delete and writes the error into the form behind it (BUG-148, pinned; flips in PR A)", async () => {
    const user = setupUser();
    fakeApi.fail(DELETE, IN_USE);
    const { onDeleted, queryClient } = renderForm();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Delete item" })
    );

    expect(await screen.findByText("Rusty Cleaver is used by 2 units.")).toBeInTheDocument();
    const confirm = screen.getByRole("dialog");
    expect(confirm).not.toHaveTextContent("used by 2 units");
    expect(confirm).toHaveTextContent("This action cannot be undone.");
    expect(onDeleted).not.toHaveBeenCalled();
    expect(cachedNames(queryClient)).toContain("Rusty Cleaver");
  });
});

describe("ItemFormDialog (edit mode): Delete", () => {
  async function openDialog(user: ReturnType<typeof setupUser>, queryClient = clientWithItems()) {
    const onDeleted = vi.fn();
    renderWithQueryClient(
      <ItemFormDialog
        mode="edit"
        item={rustyCleaver}
        campaignId={1}
        onUpdated={vi.fn()}
        onDeleted={onDeleted}
      />,
      { queryClient }
    );
    await user.click(screen.getByRole("button", { name: "Edit item" }));
    return { onDeleted, queryClient };
  }

  // Characterises current behaviour (BUG-16, CAT-TWEAK-04, pinned; flips in PR C)
  it('says only "This action cannot be undone", then sends one DELETE with no usage check (BUG-16, pinned; flips in PR C)', async () => {
    const user = setupUser();
    fakeApi.on(DELETE, undefined);
    const { onDeleted, queryClient } = await openDialog(user);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const confirm = screen.getByRole("dialog", { name: "Delete item" });
    expect(confirm).toHaveTextContent("Delete Rusty Cleaver? This action cannot be undone.");
    fakeApi.clearRequests();
    await user.click(within(confirm).getByRole("button", { name: "Delete item" }));

    expect(fakeApi.calls()).toEqual([DELETE]);
    expect(onDeleted).toHaveBeenCalledWith(240);
    expect(cachedNames(queryClient)).not.toContain("Rusty Cleaver");
    expect(screen.queryByRole("dialog", { name: "Edit Wargear" })).toBeNull();
  });

  // Characterises current behaviour (BUG-16, BUG-148, pinned; flips in PR A)
  it("leaves the confirm open after a refused delete and writes the error into the form behind it (BUG-148, pinned; flips in PR A)", async () => {
    const user = setupUser();
    fakeApi.fail(DELETE, IN_USE);
    const { onDeleted } = await openDialog(user);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(
      within(screen.getByRole("dialog", { name: "Delete item" })).getByRole("button", {
        name: "Delete item",
      })
    );

    expect(await screen.findByText("Rusty Cleaver is used by 2 units.")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Delete item" })).not.toHaveTextContent(
      "used by 2 units"
    );
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
