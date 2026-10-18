/**
 * The warband page's gold is the server's (BUG-37): the header shows the sheet's summary, and a
 * Treasury entry changes it only through the summary the page re-reads, never through a total
 * the browser keeps. The real page, app store and router run; a fake server answers.
 */
import { screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import Warband from "./Warband";
import { AppStoreProvider } from "@/stores/app-store";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { chooseOption, selectNear } from "@/test/select-option";
import { setupUser } from "@/test/user-event";
import { makeVeteranHero } from "@/test/warband-fixtures";

import type { CampaignLayoutContext } from "@/features/campaigns/routes/CampaignLayout";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: 1, email: "ann@example.com" } }),
}));
vi.mock("@/lib/realtime", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/realtime")>()),
  useTradeEvents: () => undefined,
}));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));

const annsWarband = {
  id: 9,
  campaign_id: 7,
  user_id: 1,
  name: "The Black Wolves",
  faction: "Mercenaries",
  max_units: 15,
  created_at: "",
  updated_at: "",
};

const campaign = {
  id: 7,
  name: "Shards of the Comet",
  role: "player",
  in_progress: true,
  max_heroes: 6,
  max_hired_swords: 3,
  permissions: [],
} as unknown as CampaignLayoutContext["campaign"];

const renderTreasury = () =>
  renderWithQueryClient(
    <AppStoreProvider>
      <MemoryRouter initialEntries={["/campaigns/7/warband?tab=treasury"]}>
        <Routes>
          <Route
            path="/campaigns/:id"
            element={
              <Outlet
                context={{
                  campaign,
                  setMobileTopBar: () => undefined,
                  showRejoinBattleButton: false,
                }}
              />
            }
          >
            <Route path="warband" element={<Warband />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AppStoreProvider>
  );

const headerGold = () => screen.getByLabelText("Gold coins");

beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.releasePointerCapture = vi.fn();
});

beforeEach(() => {
  fakeApi.reset();
  fakeApi.on("GET /warbands/?campaign_id=7", [annsWarband]);
  fakeApi.on("GET /warbands/9/sheet/", {
    warband: annsWarband,
    summary: { gold: 120, rating: 99, resources: [] },
    capabilities: { edit: true, manage_items: true },
    heroes: [makeVeteranHero()],
    henchmen_groups: [],
    hired_swords: [],
  });
  fakeApi.on("GET /warbands/9/trades/?limit=25", { results: [], next_cursor: null });
});

describe("Warband page: gold after a Treasury entry (BUG-37)", () => {
  it("keeps the server's gold in the header until the re-read summary answers", async () => {
    const user = setupUser();
    let answerSummary!: (summary: { gold: number }) => void;
    fakeApi.on(
      "GET /warbands/9/summary/",
      () => new Promise((resolve) => (answerSummary = resolve))
    );
    fakeApi.on("POST /warbands/9/trades/", (body: unknown) => ({
      id: 7,
      warband_id: 9,
      parent_id: null,
      notes: "",
      children: [],
      created_at: "2026-10-17T10:00:00Z",
      updated_at: "2026-10-17T10:00:00Z",
      ...(body as object),
    }));
    renderTreasury();
    await screen.findByText("No trades recorded yet.");
    expect(headerGold()).toHaveTextContent("120");

    await user.click(screen.getByRole("button", { name: "Add Trade Entry" }));
    await chooseOption(user, selectNear("Action", document.body), "Buy");
    await user.type(screen.getByPlaceholderText("0"), "10");
    await user.type(screen.getByPlaceholderText("What was bought?"), "Lantern");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await screen.findByText("Lantern");
    await waitFor(() => expect(fakeApi.countOf("GET /warbands/9/summary/")).toBe(1));
    // No browser-side total: the header still shows what the server last said.
    expect(headerGold()).toHaveTextContent("120");

    answerSummary({ gold: 110 });

    await waitFor(() => expect(headerGold()).toHaveTextContent("110"));
  });
});
