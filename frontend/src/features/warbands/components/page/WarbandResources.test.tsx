/**
 * The warband's resources: the campaign's default resource comes first, with no icon, then its
 * campaign points; the default's ⋮ offers only Sell (the campaign names it, and it is never
 * deleted), campaign points have no ⋮ (never sold); the rest keep Rename, Sell and Delete, and a
 * Wyrdstone-named one keeps its icon. Add resource takes a name only.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import type { WarbandResource } from "../../types/warband-types";
import { BOOK_WYRDSTONE_PRICES } from "../../utils/wyrdstone-prices";
import WarbandResources from "./WarbandResources";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const resource = (
  id: number,
  name: string,
  is_default = false,
  is_campaign_points = false
): WarbandResource => ({
  id,
  warband_id: 9,
  name,
  amount: id,
  is_default,
  is_campaign_points,
});

const resources = [
  resource(1, "Amber"),
  resource(4, "Campaign points", false, true),
  resource(2, "Wyrdstone shards"),
  resource(3, "Warpstone", true),
];

// a warband of 7-9 warriors (the server's size band 2), on the book's table
const pricing = { table: BOOK_WYRDSTONE_PRICES.map((row) => [...row]), band: 2 };

const renderResources = (canEdit = true) =>
  renderWithQueryClient(
    <WarbandResources warbandId={9} resources={resources} canEdit={canEdit} pricing={pricing} />
  );

describe("WarbandResources", () => {
  it("lists the default resource first, with no icon, then campaign points", () => {
    renderResources(false);

    const names = within(screen.getByRole("region", { name: "Resources" }))
      .getAllByText(/^(Amber|Wyrdstone shards|Warpstone|Campaign points)$/)
      .map((label) => label.textContent);
    expect(names).toEqual(["Warpstone", "Campaign points", "Amber", "Wyrdstone shards"]);
    expect(screen.getByText("Warpstone").querySelector("svg")).toBeNull();
    expect(screen.getByText("Wyrdstone shards").querySelector("svg")).not.toBeNull();
  });

  it("offers only Sell on the default resource", async () => {
    const user = setupUser();
    renderResources();

    await user.click(screen.getByRole("button", { name: "Warpstone actions" }));
    const items = await screen.findAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual(["Sell"]);
  });

  // William, 8 Nov 2026: "campaign points resource when on shouldnt have any menu options as it
  // isnt sellable, just the +-"
  it("gives campaign points only − and +, with no menu", () => {
    renderResources();

    expect(screen.getByRole("button", { name: "One Campaign points less" })).toBeVisible();
    expect(screen.getByRole("button", { name: "One Campaign points more" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Campaign points actions" })).toBeNull();
  });

  it("keeps Rename, Sell and Delete on the others", async () => {
    const user = setupUser();
    renderResources();

    await user.click(screen.getByRole("button", { name: "Amber actions" }));

    const items = await screen.findAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual(["Rename", "Sell", "Delete"]);
  });
});

describe("Sell", () => {
  beforeEach(() => fakeApi.reset());

  const openSell = async (user: ReturnType<typeof setupUser>, name: string) => {
    await user.click(screen.getByRole("button", { name: `${name} actions` }));
    await user.click(await screen.findByRole("menuitem", { name: "Sell" }));
  };
  const field = (name: string) => screen.getByRole("spinbutton", { name });

  // William, 7 Nov 2026: "a table of sell prices for number of shards depending on size of warband"
  it("prices the default resource from the table at the warband's band, which can be changed", async () => {
    const user = setupUser();
    fakeApi.on("POST /warbands/9/resources/3/sell/", {
      resource: { ...resources[3], amount: 0 },
      trade: { id: 1, action: "Sell", description: "Warpstone x 3", price: 72, children: [] },
      summary: {},
    });
    renderResources();

    await openSell(user, "Warpstone");
    const band = screen.getByRole("combobox", { name: "Warband size" });
    expect(band).toHaveDisplayValue("7-9 warriors");
    expect(field("Price in gold")).toHaveValue(35);

    await user.clear(field("How many"));
    await user.type(field("How many"), "3");
    expect(field("Price in gold")).toHaveValue(65);

    await user.selectOptions(band, "4-6 warriors");
    expect(field("Price in gold")).toHaveValue(70);

    await user.clear(field("Price in gold"));
    await user.type(field("Price in gold"), "72");
    await user.click(screen.getByRole("button", { name: "Sell" }));

    await waitFor(() =>
      expect(fakeApi.bodyOf("POST /warbands/9/resources/3/sell/")).toEqual({
        quantity: 3,
        price: 72,
      })
    );
  });

  it("sells another resource as before: no band, the price as typed", async () => {
    const user = setupUser();
    renderResources();

    await openSell(user, "Amber");

    expect(screen.queryByRole("combobox", { name: "Warband size" })).toBeNull();
    expect(field("Price in gold")).toHaveValue(null);
    await user.type(field("Price in gold"), "12");
    await user.clear(field("How many"));
    await user.type(field("How many"), "1");
    expect(field("Price in gold")).toHaveValue(12);
  });
});

describe("Add resource", () => {
  beforeEach(() => fakeApi.reset());

  // William, 7 Nov 2026: "add resource should just be name not amount"
  it("asks only for a name, and the new resource starts at 0", async () => {
    const user = setupUser();
    fakeApi.on("POST /warbands/9/resources/", (body: { name: string }) => resource(7, body.name));
    renderResources();

    await user.click(screen.getByRole("button", { name: "Add resource" }));
    const form = screen.getByRole("form", { name: "Add resource" });
    expect(
      within(form)
        .getAllByRole("textbox")
        .map((field) => field.getAttribute("aria-label"))
    ).toEqual(["Resource name"]);
    expect(within(form).queryByRole("spinbutton")).toBeNull();
    await user.type(within(form).getByLabelText("Resource name"), " Amber ");
    await user.click(within(form).getByRole("button", { name: "Add" }));

    await waitFor(() => expect(screen.queryByRole("form", { name: "Add resource" })).toBeNull());
    expect(fakeApi.calls()).toEqual(["POST /warbands/9/resources/"]);
    expect(fakeApi.bodyOf("POST /warbands/9/resources/")).toEqual({ name: "Amber" });
  });
});
