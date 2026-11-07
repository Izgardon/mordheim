/**
 * The item form's fields (William, 7 Nov 2026): no Search words box (the words an item holds are
 * sent back as they were), "Rule notes" beside Flavour at the foot, and the box beside every type
 * called Subtype, a miscellaneous item's written ("miscellaneous adjacent box should be called
 * Subtype not variant").
 */
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { catalogueListKey } from "@/lib/catalogue-queries";
import { item } from "@/test/catalogue-fixtures";
import { fakeApi } from "@/test/fake-api";
import { createTestQueryClient, renderWithQueryClient } from "@/test/query-test-utils";
import { pickOption } from "@/test/select";
import { setupUser } from "@/test/user-event";

import type { Item } from "../types/item-types";
import ItemFormDialog from "./ItemFormDialog";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/features/warbands/api/warband-types-queries", () => ({
  useWarbandTypes: () => ({ data: [] }),
}));
vi.mock("@/features/items/api/who-can-queries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/items/api/who-can-queries")>()),
  useWarbandGroups: () => ({ data: [] }),
}));

const CAMPAIGN = 7;

function renderForm(editing?: Item) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(catalogueListKey(CAMPAIGN, "item-rules"), []);
  queryClient.setQueryData(catalogueListKey(CAMPAIGN, "items"), editing ? [editing] : []);
  renderWithQueryClient(
    editing ? (
      <ItemFormDialog
        mode="edit"
        item={editing}
        campaignId={CAMPAIGN}
        onUpdated={vi.fn()}
        onDeleted={vi.fn()}
      />
    ) : (
      <ItemFormDialog mode="create" campaignId={CAMPAIGN} onCreated={vi.fn()} />
    ),
    { queryClient }
  );
}

async function openForm(user: ReturnType<typeof setupUser>, editing?: Item) {
  renderForm(editing);
  await user.click(screen.getByRole("button", { name: editing ? "Edit item" : "Add item" }));
  return screen.findByRole("dialog", { name: editing ? "Edit Wargear" : "Add Wargear" });
}

beforeEach(() => {
  fakeApi.reset();
});

describe("The item form's fields", () => {
  it("has no Search words box, and Rule notes beside Flavour", async () => {
    const user = setupUser();
    const form = await openForm(user);

    expect(within(form).queryByLabelText("Search words")).toBeNull();
    expect(within(form).queryByLabelText("Notes")).toBeNull();
    const notes = within(form).getByLabelText("Rule notes");
    const flavour = within(form).getByLabelText("Flavour");
    expect(notes.closest(".grid")).toBe(flavour.closest(".grid"));
  });

  it("calls the box beside every type Subtype, and sends what a miscellaneous item writes in it", async () => {
    fakeApi.on("POST /items/", (body: object) => item({ id: 40, campaign_id: CAMPAIGN, ...body }));
    const user = setupUser();
    const form = await openForm(user);
    const type = within(form).getByRole("combobox", { name: "Type" });

    for (const picked of ["Weapon", "Armour"]) {
      await pickOption(user, type, picked);
      expect(within(form).getByRole("combobox", { name: "Subtype" })).toBeInTheDocument();
    }
    await pickOption(user, type, "Miscellaneous");
    expect(within(form).queryByLabelText(/Variant/)).toBeNull();
    await user.type(within(form).getByRole("textbox", { name: "Subtype" }), "Charm");
    await user.type(within(form).getByRole("textbox", { name: /Name/ }), "Lucky Bone");
    await user.type(within(form).getByLabelText("Cost (gc)"), "10");
    await user.click(within(form).getByRole("button", { name: "Add item" }));

    await waitFor(() =>
      expect(fakeApi.bodyOf("POST /items/")).toMatchObject({
        name: "Lucky Bone",
        type: "Miscellaneous",
        subtype: "Charm",
        variant: "",
        tags: [],
      })
    );
  });

  it("sends back the search words and variant an edited item holds", async () => {
    const poison = item({
      id: 41,
      campaign_id: CAMPAIGN,
      name: "Black Lotus",
      type: "Miscellaneous",
      subtype: "Poisons and Drugs",
      variant: "Mutiny in Marienburg",
      strength: null,
      range: null,
      tags: ["lotus", "poison"],
    });
    fakeApi.on(`PATCH /items/${poison.id}/`, (body: object) => ({ ...poison, ...body }));
    const user = setupUser();
    const form = await openForm(user, poison);

    expect(within(form).getByRole("textbox", { name: "Subtype" })).toHaveValue("Poisons and Drugs");
    await user.click(within(form).getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(fakeApi.bodyOf(`PATCH /items/${poison.id}/`)).toMatchObject({
        subtype: "Poisons and Drugs",
        variant: "Mutiny in Marienburg",
        tags: ["lotus", "poison"],
      })
    );
  });
});
