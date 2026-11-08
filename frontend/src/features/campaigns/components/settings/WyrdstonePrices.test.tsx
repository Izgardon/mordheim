/**
 * Settings → Warband rules' wyrdstone sell prices (William, 7 Nov 2026: "a table of sell prices for
 * number of shards depending on size of warband"): the campaign's table, the book's by default,
 * each cell edited and the whole table saved with one PATCH; Reset puts the book's back in the
 * boxes for the next Save.
 */
import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BOOK_WYRDSTONE_PRICES } from "@/features/warbands/utils/wyrdstone-prices";
import { campaignSummary } from "@/test/campaign-fixtures";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import WyrdstonePrices from "./WyrdstonePrices";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const BOOK = BOOK_WYRDSTONE_PRICES.map((row) => [...row]);
const PATCH = (id: number) => `PATCH /campaigns/${id}/`;
const cell = (label: string) => screen.getByRole("textbox", { name: label });

beforeEach(() => fakeApi.reset());

describe("Wyrdstone sell prices", () => {
  it("shows the book's table by default, named for the default resource", () => {
    renderWithQueryClient(<WyrdstonePrices campaign={campaignSummary()} />);

    expect(screen.getByText("Wyrdstone sell prices")).toBeInTheDocument();
    expect(cell("1 shards, 1-3 warriors")).toHaveValue("45");
    expect(cell("3 shards, 7-9 warriors")).toHaveValue("65");
    expect(cell("8+ shards, 16+ warriors")).toHaveValue("100");
    expect(screen.getAllByRole("textbox")).toHaveLength(48);
    expect(screen.getByRole("button", { name: "Save prices" })).toBeDisabled();
  });

  it("saves an edited cell with the rest of the table", async () => {
    const user = setupUser();
    const campaign = campaignSummary({ wyrdstone_prices: BOOK });
    fakeApi.on(PATCH(campaign.id), (body: object) => ({ ...campaign, ...body }));
    renderWithQueryClient(<WyrdstonePrices campaign={campaign} />);

    await user.clear(cell("3 shards, 7-9 warriors"));
    await user.type(cell("3 shards, 7-9 warriors"), "7x0");
    expect(cell("3 shards, 7-9 warriors")).toHaveValue("70");
    await user.click(screen.getByRole("button", { name: "Save prices" }));

    const edited = BOOK.map((row, shards) =>
      row.map((price, band) => (shards === 2 && band === 2 ? 70 : price))
    );
    await waitFor(() =>
      expect(fakeApi.bodyOf(PATCH(campaign.id))).toEqual({ wyrdstone_prices: edited })
    );
  });

  it("refuses an empty cell before sending anything", async () => {
    const user = setupUser();
    renderWithQueryClient(<WyrdstonePrices campaign={campaignSummary()} />);

    await user.clear(cell("5 shards, 13-15 warriors"));
    await user.click(screen.getByRole("button", { name: "Save prices" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Give every cell a price in whole crowns.");
    expect(fakeApi.calls()).toEqual([]);
  });

  it("resets a changed table to the book's, saved with Save", async () => {
    const user = setupUser();
    const changed = BOOK.map((row) => row.map((price) => price + 5));
    const campaign = campaignSummary({ wyrdstone_prices: changed });
    fakeApi.on(PATCH(campaign.id), (body: object) => ({ ...campaign, ...body }));
    renderWithQueryClient(<WyrdstonePrices campaign={campaign} />);
    expect(cell("1 shards, 1-3 warriors")).toHaveValue("50");

    await user.click(screen.getByRole("button", { name: "Reset" }));

    expect(cell("1 shards, 1-3 warriors")).toHaveValue("45");
    expect(fakeApi.calls()).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Save prices" }));
    await waitFor(() =>
      expect(fakeApi.bodyOf(PATCH(campaign.id))).toEqual({ wyrdstone_prices: BOOK })
    );
  });
});
