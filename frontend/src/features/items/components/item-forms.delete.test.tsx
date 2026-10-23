/**
 * Deleting an item from the Wargear page's form (`AddItemForm`) and from the warband pages'
 * dialog (`ItemFormDialog`, whose edit mode no screen opens today): the confirm asks `usage/`
 * first and says what will happen (decision 5, CAT-TWEAK-04, CAT-NEW-05): an unused custom item is
 * deleted, one in use is archived and its copies stay, a book item is removed from this campaign
 * only. A refused delete's reason shows in the confirm (BUG-148).
 */
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { ITEMS, rustyCleaver, sword } from "@/test/catalogue-fixtures";
import { fakeApi } from "@/test/fake-api";
import { createTestQueryClient, renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";
import AddItemForm from "./AddItemForm";
import ItemFormDialog from "./ItemFormDialog";

import type { Item } from "../types/item-types";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const ITEMS_KEY = queryKeys.campaign.catalogue(1, "items");
const DELETE = "DELETE /items/240/";
const USAGE = "GET /items/240/usage/";
const UNUSED = { units: 0, warbands: 0, stashes: 0, bestiary_entries: 0 };
const IN_USE = { units: 3, warbands: 2, stashes: 0, bestiary_entries: 0 };
/** A refusal the confirm must show: the entry became a version since the list was read. */
const USE_REVERT_DETAIL =
  "This entry is (or has) the campaign's version of a book entry: revert it instead of deleting it.";
const USE_REVERT = new ApiError(USE_REVERT_DETAIL, 409, {
  detail: USE_REVERT_DETAIL,
  code: "use_revert",
  fields: {},
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
  function renderForm(
    queryClient = clientWithItems(),
    canDelete = true,
    item: Item = rustyCleaver
  ) {
    const onDeleted = vi.fn();
    renderWithQueryClient(
      <AddItemForm
        campaignId={1}
        editingItem={item}
        canDelete={canDelete}
        onCreated={vi.fn()}
        onDeleted={onDeleted}
        onCancel={vi.fn()}
      />,
      { queryClient }
    );
    return { onDeleted, queryClient };
  }

  it("asks what uses it first; nothing does, so the confirm says it is deleted for good, then one DELETE (BUG-16, CAT-TWEAK-04)", async () => {
    const user = setupUser();
    fakeApi.on(USAGE, UNUSED);
    fakeApi.on(DELETE, null);
    const { onDeleted, queryClient } = renderForm();
    fakeApi.clearRequests();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const confirm = screen.getByRole("dialog", { name: "Delete item" });
    expect(
      await within(confirm).findByText(
        "Delete Rusty Cleaver? Nothing uses it, so it is deleted for good."
      )
    ).toBeVisible();
    await user.click(within(confirm).getByRole("button", { name: "Delete item" }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(240));
    expect(fakeApi.calls()).toEqual([USAGE, DELETE]);
    expect(cachedNames(queryClient)).not.toContain("Rusty Cleaver");
    expect(queryClient.getQueryState(ITEMS_KEY)?.isInvalidated).toBe(true);
  });

  it("archives an item in use: the confirm says what holds it and that they keep their copies, and the item leaves the list (CAT-TWEAK-04)", async () => {
    const user = setupUser();
    fakeApi.on(USAGE, IN_USE);
    fakeApi.on(DELETE, { outcome: "archived", usage: IN_USE });
    const { onDeleted, queryClient } = renderForm();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const confirm = screen.getByRole("dialog", { name: "Delete item" });
    expect(
      await within(confirm).findByText(
        "Archive Rusty Cleaver? It is used by 3 units in 2 warbands; they keep their copies. It leaves the shops and pickers, and you can restore it from Archived."
      )
    ).toBeVisible();
    await user.click(within(confirm).getByRole("button", { name: "Archive item" }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(240));
    expect(cachedNames(queryClient)).not.toContain("Rusty Cleaver");
  });

  it("removes a book item from this campaign only, naming the campaign in the usage check and the DELETE (CAT-NEW-05)", async () => {
    const user = setupUser();
    fakeApi.on("GET /items/2/usage/?campaign_id=1", { ...UNUSED, units: 1, warbands: 1 });
    fakeApi.on("DELETE /items/2/?campaign_id=1", { outcome: "removed", usage: UNUSED });
    const { onDeleted, queryClient } = renderForm(clientWithItems(), true, sword);

    await user.click(screen.getByRole("button", { name: "Remove" }));
    const confirm = screen.getByRole("dialog", { name: "Delete item" });
    expect(
      await within(confirm).findByText(
        "Remove Sword from this campaign only? The book and other campaigns keep it. It is used by 1 unit in 1 warband; they keep their copies. You can restore it from Archived."
      )
    ).toBeVisible();
    await user.click(within(confirm).getByRole("button", { name: "Remove item" }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(2));
    expect(cachedNames(queryClient)).not.toContain("Sword");
  });

  it("waits for the usage check before offering the confirm, and still offers it when the check fails", async () => {
    const user = setupUser();
    fakeApi.fail(USAGE, new ApiError("Request failed (500)", 500, null));
    renderForm();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const confirm = screen.getByRole("dialog", { name: "Delete item" });

    expect(await within(confirm).findByRole("alert")).toHaveTextContent(
      /^Couldn't check what uses it/
    );
    expect(confirm).toHaveTextContent(
      "Delete Rusty Cleaver? If anything uses it, it is archived instead, and its copies stay."
    );
    expect(within(confirm).getByRole("button", { name: "Delete item" })).toBeEnabled();
  });

  it("offers no Delete to someone without delete_catalogue (decision 5)", async () => {
    renderForm(clientWithItems(), false);

    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeVisible();
  });

  it("sends nothing but the usage check when the confirm is cancelled", async () => {
    const user = setupUser();
    fakeApi.on(USAGE, UNUSED);
    renderForm();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    fakeApi.clearRequests();
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));

    expect(fakeApi.calls()).toEqual([]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows a refused delete's reason in the confirm, which stays open with the entry still listed, and nothing in the form behind it (BUG-148)", async () => {
    const user = setupUser();
    fakeApi.on(USAGE, UNUSED);
    fakeApi.fail(DELETE, USE_REVERT);
    const { onDeleted, queryClient } = renderForm();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const confirm = screen.getByRole("dialog", { name: "Delete item" });
    await within(confirm).findByText(/deleted for good/);
    await user.click(within(confirm).getByRole("button", { name: "Delete item" }));

    const reason = await screen.findByRole("alert");
    expect(reason).toHaveTextContent(USE_REVERT_DETAIL);
    expect(screen.getByRole("dialog", { name: "Delete item" })).toContainElement(reason);
    expect(screen.getAllByText(USE_REVERT_DETAIL)).toHaveLength(1);
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

  it("asks what uses it first and says it is deleted for good, then sends one DELETE and closes (BUG-16, CAT-TWEAK-04)", async () => {
    const user = setupUser();
    fakeApi.on(USAGE, UNUSED);
    fakeApi.on(DELETE, null);
    const { onDeleted, queryClient } = await openDialog(user);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const confirm = screen.getByRole("dialog", { name: "Delete item" });
    expect(
      await within(confirm).findByText(
        "Delete Rusty Cleaver? Nothing uses it, so it is deleted for good."
      )
    ).toBeVisible();
    fakeApi.clearRequests();
    await user.click(within(confirm).getByRole("button", { name: "Delete item" }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(240));
    expect(fakeApi.calls()).toEqual([DELETE]);
    expect(cachedNames(queryClient)).not.toContain("Rusty Cleaver");
    expect(screen.queryByRole("dialog", { name: "Edit Wargear" })).toBeNull();
  });

  it("shows a refused delete's reason in the confirm, which stays open (BUG-148)", async () => {
    const user = setupUser();
    fakeApi.on(USAGE, UNUSED);
    fakeApi.fail(DELETE, USE_REVERT);
    const { onDeleted } = await openDialog(user);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const confirm = screen.getByRole("dialog", { name: "Delete item" });
    await within(confirm).findByText(/deleted for good/);
    await user.click(within(confirm).getByRole("button", { name: "Delete item" }));

    const reason = await screen.findByRole("alert");
    expect(reason).toHaveTextContent(USE_REVERT_DETAIL);
    expect(screen.getByRole("dialog", { name: "Delete item" })).toContainElement(reason);
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
