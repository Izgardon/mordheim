/**
 * Deleting a custom item from the Wargear page's form (`AddItemForm`) and from the warband pages'
 * dialog (`ItemFormDialog`, whose edit mode no screen opens today): the confirm's copy, the one
 * DELETE it sends with no usage check, and a refused delete's reason shown in the confirm
 * (BUG-148). The server cascades the delete into every warband's copies (BUG-16); PR A answers
 * 409 `in_use` instead, and PR C asks `usage/` first and archives what is in use.
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
/** A refusal as apiRequest throws it: the standard body's `detail` is also the message. */
const IN_USE = new ApiError("Rusty Cleaver is used by 2 units.", 409, {
  detail: "Rusty Cleaver is used by 2 units.",
  code: "in_use",
});

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
  fakeApi.on("GET /item-properties/?campaign_id=1", []);
});

describe("AddItemForm: Delete", () => {
  function renderForm(queryClient = clientWithItems(), canDelete = true) {
    const onDeleted = vi.fn();
    renderWithQueryClient(
      <AddItemForm
        campaignId={1}
        editingItem={rustyCleaver}
        canDelete={canDelete}
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

  it("offers no Delete to someone without delete_catalogue (decision 5)", async () => {
    renderForm(clientWithItems(), false);

    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeVisible();
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

  it("shows a refused delete's reason in the confirm, which stays open, and not in the form behind it (BUG-148)", async () => {
    const user = setupUser();
    fakeApi.fail(DELETE, IN_USE);
    const { onDeleted, queryClient } = renderForm();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Delete item" })
    );

    const reason = await screen.findByRole("alert");
    expect(reason).toHaveTextContent("Rusty Cleaver is used by 2 units.");
    expect(screen.getByRole("dialog", { name: "Delete item" })).toContainElement(reason);
    expect(screen.getAllByText("Rusty Cleaver is used by 2 units.")).toHaveLength(1);
    expect(onDeleted).not.toHaveBeenCalled();
    expect(cachedNames(queryClient)).toContain("Rusty Cleaver");

    // Cancelled and reopened, the confirm starts clean.
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(within(screen.getByRole("dialog")).queryByRole("alert")).toBeNull();
  });
});

describe("ItemFormDialog (edit mode): Delete", () => {
  it("offers no Delete to someone without delete_catalogue (decision 5)", async () => {
    await openDialog(setupUser(), clientWithItems(), false);

    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeVisible();
  });

  async function openDialog(
    user: ReturnType<typeof setupUser>,
    queryClient = clientWithItems(),
    canDelete = true
  ) {
    const onDeleted = vi.fn();
    renderWithQueryClient(
      <ItemFormDialog
        mode="edit"
        canDelete={canDelete}
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

  it("shows a refused delete's reason in the confirm, which stays open, and not in the form behind it (BUG-148)", async () => {
    const user = setupUser();
    fakeApi.fail(DELETE, IN_USE);
    const { onDeleted } = await openDialog(user);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(
      within(screen.getByRole("dialog", { name: "Delete item" })).getByRole("button", {
        name: "Delete item",
      })
    );

    const reason = await screen.findByRole("alert");
    expect(reason).toHaveTextContent("Rusty Cleaver is used by 2 units.");
    expect(screen.getByRole("dialog", { name: "Delete item" })).toContainElement(reason);
    expect(screen.getAllByText("Rusty Cleaver is used by 2 units.")).toHaveLength(1);
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
