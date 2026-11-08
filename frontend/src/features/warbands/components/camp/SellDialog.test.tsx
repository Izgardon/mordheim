/**
 * Camp's Sell: the default resource is priced from the campaign's wyrdstone sell prices at the
 * warband's size band (William, 7 Nov 2026: "a table of sell prices for number of shards
 * depending on size of warband"), the band and the total changeable; other resources sell as
 * before, the price as typed. The sale is noted in camp.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import type { WarbandResource } from "../../types/warband-types";
import { BOOK_WYRDSTONE_PRICES } from "../../utils/wyrdstone-prices";
import type { OpenCamp } from "./camp-types";
import SellDialog from "./SellDialog";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));

const shards: WarbandResource = {
  id: 3,
  warband_id: 9,
  name: "Wyrdstone",
  amount: 5,
  is_default: true,
};
const amber: WarbandResource = {
  id: 4,
  warband_id: 9,
  name: "Amber",
  amount: 2,
  is_default: false,
};
const points: WarbandResource = {
  id: 5,
  warband_id: 9,
  name: "Campaign points",
  amount: 6,
  is_default: false,
  is_campaign_points: true,
};
const draft = { unit_results: {}, upkeep: { pay_upkeep: true, entries: {} }, camp: {} };
const field = (name: string) => screen.getByRole("spinbutton", { name });

const open = () => {
  const save = vi.fn().mockResolvedValue(undefined);
  const camp = {
    warbandId: 9,
    gold: 50,
    draft,
    save,
    campaign: { wyrdstone_prices: BOOK_WYRDSTONE_PRICES.map((row) => [...row]) },
    // a warband of 4-6 warriors: the server's size band 1
    postgame: { resources: [shards, points, amber], sheet: { summary: { size_band: 1 } } },
  } as unknown as OpenCamp;
  renderWithQueryClient(<SellDialog camp={camp} open onClose={vi.fn()} />);
  return save;
};

beforeEach(() => fakeApi.reset());

describe("Camp's Sell", () => {
  it("prices wyrdstone from the table, the band and the total changeable", async () => {
    const user = setupUser();
    fakeApi.on("POST /warbands/9/resources/3/sell/", {
      resource: { ...shards, amount: 3 },
      trade: { id: 1, action: "Sell", description: "Wyrdstone x 2", price: 61, children: [] },
      summary: {},
    });
    const save = open();
    const band = screen.getByRole("combobox", { name: "Warband size" });
    expect(band).toHaveDisplayValue("4-6 warriors");
    expect(field("For (gc)")).toHaveValue(40);

    await user.clear(field("How many"));
    await user.type(field("How many"), "2");
    expect(field("For (gc)")).toHaveValue(55);
    await user.selectOptions(band, "1-3 warriors");
    expect(field("For (gc)")).toHaveValue(60);
    await user.clear(field("For (gc)"));
    await user.type(field("For (gc)"), "61");
    await user.click(screen.getByRole("button", { name: "Sell" }));

    await waitFor(() =>
      expect(fakeApi.bodyOf("POST /warbands/9/resources/3/sell/")).toEqual({
        quantity: 2,
        price: 61,
      })
    );
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith({
        ...draft,
        camp: { sold: [{ name: "Wyrdstone", quantity: 2, gold: 61 }] },
      })
    );
  });

  it("sells another resource as before", async () => {
    const user = setupUser();
    open();

    await user.selectOptions(screen.getByRole("combobox", { name: "Resource" }), "Amber · 2 held");

    expect(screen.queryByRole("combobox", { name: "Warband size" })).toBeNull();
    expect(field("For (gc)")).toHaveValue(null);
  });

  // William, 8 Nov 2026: "campaign points ... isnt sellable"
  it("leaves campaign points out", () => {
    open();

    const options = within(screen.getByRole("combobox", { name: "Resource" })).getAllByRole(
      "option"
    );
    expect(options.map((option) => option.textContent)).toEqual([
      "Wyrdstone · 5 held",
      "Amber · 2 held",
    ]);
  });
});
