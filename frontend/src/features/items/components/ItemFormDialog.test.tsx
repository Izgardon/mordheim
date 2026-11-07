/**
 * The item dialog (William, 7 Nov 2026): Simple or Advanced ("improve new item form with
 * simple/advanced"), Simple at first, the viewer's choice remembered, and an item holding what
 * only Advanced shows opening in Advanced; no Search words box (the words an item holds are sent
 * back as they were), "Rule notes" beside Flavour at the foot, and the box beside every type
 * called Subtype, a miscellaneous item's written ("miscellaneous adjacent box should be called
 * Subtype not variant").
 */
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { catalogueListKey } from "@/lib/catalogue-queries";
import { availability, item } from "@/test/catalogue-fixtures";
import { fakeApi } from "@/test/fake-api";
import { createTestQueryClient, renderWithQueryClient } from "@/test/query-test-utils";
import { pickOption } from "@/test/select";
import { setupUser } from "@/test/user-event";

import type { Item } from "../types/item-types";
import { ITEM_FORM_MODE_KEY } from "../utils/item-form-mode";
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
  localStorage.clear();
  fakeApi.reset();
});

afterEach(() => vi.restoreAllMocks());

const view = (form: HTMLElement) =>
  within(within(form).getByRole("radiogroup", { name: "Fields" }))
    .getAllByRole("radio")
    .find((radio) => radio.getAttribute("aria-checked") === "true")?.textContent;

/** What only Advanced shows. */
const ADVANCED = ["Who can buy", "Note when buying", "Source", "Link", "Rule notes", "Flavour"];

describe("The item dialog's Simple and Advanced", () => {
  it("starts in Simple: the name, type and subtype, one price and the rules", async () => {
    fakeApi.on("POST /items/", (body: object) => item({ id: 40, campaign_id: CAMPAIGN, ...body }));
    const user = setupUser();
    const form = await openForm(user);

    expect(view(form)).toBe("Simple");
    await pickOption(user, within(form).getByRole("combobox", { name: "Type" }), "Weapon");
    expect(within(form).getByRole("combobox", { name: "Subtype" })).toBeInTheDocument();
    expect(within(form).getByText("Rules")).toBeInTheDocument();
    expect(within(form).getByText("Price")).toBeInTheDocument();
    expect(within(form).getByRole("group", { name: "Dice for price 1" })).toBeInTheDocument();
    expect(within(form).getByLabelText("Rarity")).toBeInTheDocument();
    expect(within(form).queryByRole("button", { name: "Add a price" })).toBeNull();
    expect(within(form).queryByRole("button", { name: "Remove price 1" })).toBeNull();
    for (const label of ADVANCED) expect(within(form).queryByText(label)).toBeNull();

    await user.type(within(form).getByRole("textbox", { name: /Name/ }), "Hook");
    await user.type(within(form).getByLabelText("Cost (gc)"), "10");
    await user.click(within(form).getByRole("button", { name: "Add item" }));
    await waitFor(() =>
      expect(fakeApi.bodyOf("POST /items/")).toMatchObject({
        name: "Hook",
        availabilities: [{ cost: 10, rarity: null, note: "", for_everyone: true, warbands: [] }],
      })
    );
  });

  it("adds the rest in Advanced, and remembers the viewer's choice", async () => {
    const user = setupUser();
    let form = await openForm(user);

    await user.click(within(form).getByRole("radio", { name: "Advanced" }));
    expect(view(form)).toBe("Advanced");
    expect(localStorage.getItem(ITEM_FORM_MODE_KEY)).toBe("advanced");
    expect(within(form).getByRole("button", { name: "Add a price" })).toBeInTheDocument();
    for (const label of ADVANCED)
      expect(within(form).getAllByText(label).length).toBeGreaterThan(0);

    cleanup();
    form = await openForm(user);
    expect(view(form)).toBe("Advanced");
    await user.click(within(form).getByRole("radio", { name: "Simple" }));
    expect(localStorage.getItem(ITEM_FORM_MODE_KEY)).toBe("simple");
  });

  it.each([
    ["flavour", { flavour: "Sharp." }],
    ["rule notes", { notes: "Counts as a sword." }],
    ["a source", { source: "Town Cryer #6" }],
    ["a second price", { availabilities: [availability(), availability({ id: 12, cost: 9 })] }],
    ["a who-can list", { availabilities: [availability({ for_everyone: false })] }],
    ["a note when buying", { availabilities: [availability({ note: "Heroes only" })] }],
  ])("opens an item holding %s in Advanced, whatever was chosen", async (_, held) => {
    localStorage.setItem(ITEM_FORM_MODE_KEY, "simple");
    const user = setupUser();
    const form = await openForm(user, item({ id: 42, campaign_id: CAMPAIGN, ...held }));
    expect(view(form)).toBe("Advanced");
  });

  it("opens an item holding nothing more in the viewer's choice", async () => {
    localStorage.setItem(ITEM_FORM_MODE_KEY, "simple");
    const user = setupUser();
    const form = await openForm(user, item({ id: 43, campaign_id: CAMPAIGN }));
    expect(view(form)).toBe("Simple");
  });

  it("starts in Simple and still switches when storage can't be read", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const user = setupUser();
    const form = await openForm(user);

    expect(view(form)).toBe("Simple");
    await user.click(within(form).getByRole("radio", { name: "Advanced" }));
    expect(view(form)).toBe("Advanced");
  });
});

describe("The item form's fields", () => {
  beforeEach(() => localStorage.setItem(ITEM_FORM_MODE_KEY, "advanced"));

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
