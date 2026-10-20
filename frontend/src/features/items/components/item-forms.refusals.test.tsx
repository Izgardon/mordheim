/**
 * What the item forms do with the server's refusals (backend PR A): a taken name (400
 * `duplicate_entry`) shows on the name field and keeps the form open.
 */
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LIST, PROPERTIES } from "@/test/catalogue-fixtures";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { duplicateEntry, expectFieldError } from "@/test/refusals";
import { chooseOption } from "@/test/select-option";
import { setupUser } from "@/test/user-event";
import AddItemForm from "./AddItemForm";
import ItemFormDialog from "./ItemFormDialog";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const taken = duplicateEntry("an item with this name and type");

beforeEach(() => {
  fakeApi.reset();
  fakeApi.on(LIST.properties, PROPERTIES);
});

describe("AddItemForm: refusals", () => {
  function renderForm() {
    const onCreated = vi.fn();
    renderWithQueryClient(<AddItemForm campaignId={1} onCreated={onCreated} onCancel={vi.fn()} />);
    return { onCreated };
  }

  /** Fills in a Rusty Cleaver weapon at `price` gc, rarity `rarity`, and saves. */
  async function saveWeapon(user: ReturnType<typeof setupUser>, price = "7", rarity = "2") {
    await user.type(screen.getByPlaceholderText("Gutterblade"), "Rusty Cleaver");
    await chooseOption(user, screen.getByText("Select a type").closest("button")!, "Weapon");
    await user.type(screen.getByPlaceholderText("25"), price);
    await user.type(screen.getByPlaceholderText("2"), rarity);
    await user.click(screen.getByRole("button", { name: "Save" }));
  }

  it("shows a taken name on the name field and keeps the form open (duplicate_entry)", async () => {
    const user = setupUser();
    fakeApi.fail("POST /items/", taken.error);
    const { onCreated } = renderForm();

    await saveWeapon(user);

    await expectFieldError(screen.getByPlaceholderText("Gutterblade"), taken.detail);
    expect(screen.getByRole("button", { name: "Save" })).toBeVisible();
    expect(onCreated).not.toHaveBeenCalled();
  });
});

describe("ItemFormDialog: refusals", () => {
  it("shows a taken name on the name field and keeps the dialog open (duplicate_entry)", async () => {
    const user = setupUser();
    fakeApi.fail("POST /items/", taken.error);
    const onCreated = vi.fn();
    renderWithQueryClient(<ItemFormDialog mode="create" campaignId={1} onCreated={onCreated} />);
    await user.click(screen.getByRole("button", { name: "Add item" }));
    const dialog = screen.getByRole("dialog");

    await user.type(within(dialog).getByLabelText("Name"), "Rusty Cleaver");
    await chooseOption(user, within(dialog).getByRole("combobox", { name: "Type" }), "Weapon");
    await user.type(within(dialog).getByLabelText("Price"), "7");
    await user.type(within(dialog).getByLabelText(/^Rarity/), "2");
    await user.click(within(dialog).getByRole("button", { name: "Add item" }));

    await expectFieldError(within(dialog).getByLabelText("Name"), taken.detail);
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(onCreated).not.toHaveBeenCalled();
  });
});
