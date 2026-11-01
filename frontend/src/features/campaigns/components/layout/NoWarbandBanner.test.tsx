/**
 * "Raise your warband" (William, 1 Nov 2026): every page of a campaign you have no warband in
 * says so, with the way to raise one, until the warband stands. Not on the raise page itself,
 * nor in an archived campaign. It reads the layout's query for your warband, so no request of
 * its own.
 */
import { screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { campaignSummary } from "@/test/campaign-fixtures";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";

import NoWarbandBanner from "./NoWarbandBanner";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const MINE = "GET /warbands/?campaign_id=1";
const campaign = campaignSummary();

function renderBanner(pathname: string, shown = campaign) {
  return renderWithQueryClient(
    <MemoryRouter>
      <NoWarbandBanner campaign={shown} pathname={pathname} />
    </MemoryRouter>
  );
}

beforeEach(() => {
  fakeApi.reset();
});

describe("NoWarbandBanner", () => {
  it("prompts a member with no warband to raise one", async () => {
    fakeApi.on(MINE, []);
    renderBanner("/campaigns/1/battles");

    expect(await screen.findByText("You have no warband in this campaign.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Raise your warband" })).toHaveAttribute(
      "href",
      "/campaigns/1/warband"
    );
    expect(screen.queryByRole("button", { name: /dismiss|close/i })).toBeNull();
    expect(fakeApi.calls()).toEqual([MINE]);
  });

  it("shows nothing while your warband loads", () => {
    renderBanner("/campaigns/1");

    expect(fakeApi.calls()).toEqual([MINE]);
    expect(screen.queryByText(/no warband/)).toBeNull();
  });

  it("shows nothing once you have a warband", async () => {
    fakeApi.on(MINE, [{ id: 9, name: "Ashen Crows" }]);
    const { queryClient } = renderBanner("/campaigns/1");

    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    expect(screen.queryByText(/no warband/)).toBeNull();
  });

  it("stays off the raise page and out of an archived campaign", async () => {
    fakeApi.on(MINE, []);
    const archived = campaignSummary({ archived_at: "2026-10-20T10:00:00Z" });
    const raise = renderBanner("/campaigns/1/warband");
    const old = renderBanner("/campaigns/1", archived);

    await waitFor(() => expect(raise.queryClient.isFetching()).toBe(0));
    await waitFor(() => expect(old.queryClient.isFetching()).toBe(0));
    expect(screen.queryByText(/no warband/)).toBeNull();
  });
});
