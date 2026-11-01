/**
 * The Battles page's caption: while the rows load it is a skeleton like theirs, never "0 battles
 * fought" (the bounties brief); once they are in it counts them.
 */
import { screen } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CAMPAIGN_ID, campaignSummary } from "@/test/campaign-fixtures";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import Battles from "./Battles";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
// what waits on you sits above the rows and has its own tests
vi.mock("../components/overview/OverviewNotices", () => ({ default: () => null }));

const battle = (id: number) => ({
  id,
  scenario: "Street Fight",
  winners: ["Rats"],
  date: "01/11/26",
  participants: [],
  moments: [],
});

function renderBattles() {
  const context = {
    campaign: campaignSummary(),
    setBattleMenuActions: () => {},
    openTool: () => {},
  };
  return renderWithQueryClient(
    <MemoryRouter initialEntries={[`/campaigns/${CAMPAIGN_ID}/battles`]}>
      <Routes>
        <Route path="/campaigns/:id" element={<Outlet context={context} />}>
          <Route path="battles" element={<Battles />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  fakeApi.reset();
});

describe("the Battles page's caption", () => {
  it("is a skeleton while the battles load, not a count of none", () => {
    renderBattles(); // battle-history/ never answers

    expect(screen.getByRole("status", { name: "Loading the battles" })).toBeInTheDocument();
    expect(screen.queryByText(/battles fought/)).not.toBeInTheDocument();
  });

  it("counts the battles once they are in", async () => {
    fakeApi.on(`GET /campaigns/${CAMPAIGN_ID}/battle-history/`, [battle(1), battle(2)]);
    renderBattles();

    expect(await screen.findByText("2 battles fought")).toBeInTheDocument();
  });
});
