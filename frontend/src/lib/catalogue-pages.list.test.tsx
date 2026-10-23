/**
 * The catalogue lists as the five pages show them (layout, fake server). The pages render the
 * list exactly as the server merged it: a campaign "Axe" in place of the book Axe, and no merging
 * of their own (BUG-18 is server-side). Skills and Spells mark the campaign's own entries
 * "Custom" (CAT-NEW-03); the Bestiary's cards don't yet (left for step 3 of the bestiary rewrite).
 * The Hired Swords and Dramatis Personae badges are tested in features/hirelings.
 */
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { routeCampaignShell } from "@/test/campaign-fixtures";
import {
  ITEMS,
  LIST,
  campaignAxe,
  item,
  quickHands,
  routeCatalogue,
  skill,
} from "@/test/catalogue-fixtures";
import { renderCatalogueRoute } from "@/test/catalogue-routes";
import { fakeApi } from "@/test/fake-api";
import { fakeRealtime } from "@/test/fake-realtime";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/realtime/client", async () => (await import("@/test/fake-realtime")).fakeClient);
vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: 7, email: "aldric@example.com" }, signOut: () => undefined }),
}));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));
vi.mock("@/features/realtime/components/CampaignDiceRollerMenu", () => ({ default: () => null }));

const itemRows = (name: string) => screen.getAllByRole("button", { name: new RegExp(`^${name}`) });
const tableRow = (name: string) => screen.getByRole("row", { name: new RegExp(`^${name}`) });
const firstCell = (row: HTMLElement) => row.querySelector("td")!.textContent;
const card = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name}`) });

beforeEach(() => {
  fakeApi.reset();
  fakeRealtime.reset();
  routeCampaignShell();
  routeCatalogue();
});

describe("the list merge as the pages show it", () => {
  it("Wargear shows the campaign Axe at 25 gc and no book Axe, as the list returns it", async () => {
    renderCatalogueRoute("/campaigns/1/items");
    await screen.findByRole("button", { name: /^Rusty Cleaver/ });

    expect(itemRows("Axe")).toHaveLength(1);
    expect(itemRows("Axe")[0]).toHaveTextContent(/Common\s*25/);
  });

  it("Wargear merges nothing itself: a list holding both Axes shows both", async () => {
    fakeApi.on(LIST.items, [campaignAxe, item({ id: 1, name: "Axe" }), ...ITEMS.slice(1)]);
    renderCatalogueRoute("/campaigns/1/items");
    await screen.findByRole("button", { name: /^Rusty Cleaver/ });

    const [campaignRow, bookRow] = itemRows("Axe");
    expect(campaignRow).toHaveTextContent(/Common\s*25/);
    expect(bookRow).toHaveTextContent(/Common\s*5(?!\d)/);
  });

  it("Skills shows the campaign's Infiltration alone when the list hid the six book ones", async () => {
    fakeApi.on(LIST.skills, [
      skill({ id: 907, campaign_id: 1, name: "Infiltration", type: "Combat" }),
      skill(),
    ]);
    renderCatalogueRoute("/campaigns/1/skills");
    await screen.findByRole("row", { name: /^Strike to Injure/ });

    expect(screen.getAllByRole("row", { name: /^Infiltration/ })).toHaveLength(1);
  });
});

describe("the Custom and House rule badges (CAT-NEW-03)", () => {
  it("Skills: the campaign's own skill is marked Custom, a book skill is not; a version is House rule", async () => {
    fakeApi.on(LIST.skills, [
      quickHands,
      skill({ id: 908, campaign_id: 1, name: "Sprint", type: "Speed", replaces: 206 }),
      skill(),
    ]);
    renderCatalogueRoute("/campaigns/1/skills");
    await screen.findByRole("row", { name: /^Quick Hands/ });

    expect(firstCell(tableRow("Quick Hands"))).toBe("Quick HandsCustom");
    expect(firstCell(tableRow("Sprint"))).toBe("SprintHouse rule");
    expect(firstCell(tableRow("Strike to Injure"))).toBe("Strike to Injure");
  });

  it("Spells: the campaign's own spell is marked Custom, a book spell is not", async () => {
    renderCatalogueRoute("/campaigns/1/spells");
    await screen.findByRole("row", { name: /^Gutter Hex/ });

    expect(firstCell(tableRow("Gutter Hex"))).toBe("Gutter HexCustom");
    expect(firstCell(tableRow("Fires of U'Zhul"))).toBe("Fires of U'Zhul");
  });
});

describe("the Bestiary marks nothing yet", () => {
  // Characterises current behaviour (CAT-UX-01, CAT-NEW-03, pinned; left for step 3 of the bestiary rewrite)
  it("Bestiary: a campaign card and a book card carry the same heading and type line (CAT-UX-01, pinned; left for step 3 of the bestiary rewrite)", async () => {
    renderCatalogueRoute("/campaigns/1/bestiary");
    await screen.findByText("Sewer Rat");

    for (const name of ["Sewer Rat", "Warhound"]) {
      expect(within(card(name)).getByRole("heading", { level: 3 })).toHaveTextContent(name);
      expect(within(card(name)).getByText("Attack")).toBeVisible();
    }
    expect(within(card("Sewer Rat")).queryByText(/custom|house rule/i)).toBeNull();
  });
});
