/**
 * Where the warband page's sections sit (William, 20 Nov 2026: "the tab system should sit at the
 * top of the warband page under the warband name"). The stats, the resources, the plot and the
 * warband rules used to sit above the tab bar, so every tab opened under them; they are now the
 * top of the Roster tab, and Treasury, Backstory and Log open with nothing above them.
 */
import { screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";
import { makeHero } from "@/test/warband-fixtures";

import { readCapabilities } from "../../types/warband-sheet";
import type { Warband } from "../../types/warband-types";
import WarbandSections from "./WarbandSections";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));

const warband = {
  id: 9,
  name: "Iron Vultures",
  campaign_id: 7,
  gold: 120,
  campaign_points: 4,
  resources: [{ id: 1, warband_id: 9, name: "Wyrdstone shards", amount: 3, is_default: true }],
} as unknown as Warband;

const sheet = {
  warband,
  capabilities: readCapabilities({ edit: true }),
  heroes: [makeHero({ id: 5, name: "Konrad Adler" })],
  henchmenGroups: [],
  hirelings: [],
  rules: [{ id: 2, title: "5 CP: Rung 5", description: "What 5 gives." }],
  encampments: [{ id: 8, name: "Old Fort", fortified: true }],
  plot: {
    id: 4,
    name: "Drowning the Witch",
    rungs: [5, 10],
    summary: "",
    scoring: [],
    achievements: [],
  },
  isLoading: false,
  error: "",
  setUnits: { hero: vi.fn(), henchmen_group: vi.fn(), hireling: vi.fn() },
  mergeWarband: vi.fn(),
  showCreated: vi.fn(),
} as unknown as Parameters<typeof WarbandSections>[0]["sheet"];

const show = (shown = sheet) =>
  renderWithQueryClient(
    <MemoryRouter initialEntries={["/campaigns/7/warband"]}>
      <WarbandSections
        campaignId={7}
        campaign={{ id: 7, enable_campaign_points: true } as never}
        warband={warband}
        sheet={shown}
        canEdit
        breakdownOpen={false}
        setBreakdownOpen={vi.fn()}
        onLoadout={vi.fn()}
        onHire={vi.fn()}
        onAdvance={vi.fn()}
        onBuyAgain={vi.fn()}
      />
    </MemoryRouter>
  );

describe("the warband page's sections", () => {
  beforeEach(() => {
    fakeApi.reset();
    fakeApi.on("GET /warbands/9/template/", {
      template: null,
      variant: "",
      list_prices_open: true,
    });
    fakeApi.on("GET /campaigns/7/plots/", []);
  });

  it("holds the stats, resources, plot and rules at the top of the Roster tab alone", async () => {
    const user = setupUser();
    show();

    const bar = screen.getByRole("tablist", { name: "Warband" });
    expect(screen.getByRole("region", { name: "Resources" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Campaign points" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Warband rules" })).toBeVisible();
    // what it holds, each opening the encampment on the Encampments page
    expect(
      within(screen.getByRole("region", { name: "Encampments" })).getByRole("button", {
        name: /Old Fort/,
      })
    ).toHaveTextContent("Fortified");
    // the tab bar comes first: nothing of the Roster tab's is above it
    expect(bar.compareDocumentPosition(screen.getByRole("region", { name: "Resources" }))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );

    await user.click(screen.getByRole("tab", { name: "Backstory" }));

    expect(screen.queryByRole("region", { name: "Resources" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Campaign points" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Warband rules" })).toBeNull();
  });

  it("shows a workshop's warband as its roster and backstory, with its cost and no gold, record, resources, plot or encampments", () => {
    show({
      ...sheet,
      capabilities: readCapabilities({ edit: true, workshop: true }),
      workshop: { cost: 620, budget: 500, share_code: "WAGN2345" },
    } as typeof sheet);

    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Roster",
      "Backstory",
    ]);
    expect(screen.getByText("/ 500 gc").parentElement).toHaveClass("text-danger");
    expect(screen.getByText("/ 500 gc").parentElement).toHaveTextContent(/^620 \/ 500 gc$/);
    expect(screen.queryByText("Gold")).toBeNull();
    expect(screen.queryByText("Record")).toBeNull();
    expect(screen.queryByRole("region", { name: "Resources" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Campaign points" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Encampments" })).toBeNull();
    expect(screen.getByRole("region", { name: "Warband rules" })).toBeVisible();
  });
});
