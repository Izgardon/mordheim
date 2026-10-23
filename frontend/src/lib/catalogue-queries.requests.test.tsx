/**
 * Requests the catalogue pages send, with the app's own cache rules (`createQueryClient` and the
 * catalogue's 5-minute stale time): each page's cold load, a tour of all five, and the warband
 * dialogs and the bestiary's Add dialog reading the lists the pages cached. The bestiary holds the
 * animals only, so the Bestiary page and the prebattle Load from Bestiary picker share one list.
 */
import { act, cleanup, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "@/lib/query-client";
import { OWNER, campaignApi, routeCampaignShell } from "@/test/campaign-fixtures";
import { FAVOURITES, LIST, routeCatalogue } from "@/test/catalogue-fixtures";
import { renderCatalogueRoute } from "@/test/catalogue-routes";
import { fakeApi } from "@/test/fake-api";
import { fakeRealtime } from "@/test/fake-realtime";
import { setupUser } from "@/test/user-event";

import type { QueryClient } from "@tanstack/react-query";

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

/** What the campaign shell reads on any campaign page. */
const SHELL = [
  "GET /notifications/",
  `GET ${campaignApi()}`,
  `GET ${campaignApi("battles/?open=1")}`,
  "GET /warbands/?campaign_id=1",
  `GET /warbands/${OWNER.warband!.id}/sheet/`,
];

/** Gives a late duplicate request the chance to start before counting. */
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 50)));

/** Each page's path and something it shows once its list has loaded. */
const PAGES = {
  Wargear: { path: "items", ready: () => screen.findByRole("button", { name: /^Rusty Cleaver/ }) },
  Skills: { path: "skills", ready: () => screen.findByRole("row", { name: /^Quick Hands/ }) },
  Spells: { path: "spells", ready: () => screen.findByRole("row", { name: /^Gutter Hex/ }) },
  Bestiary: { path: "bestiary", ready: () => screen.findByText("Sewer Rat") },
  "Hired Swords": { path: "hired-swords", ready: () => screen.findByText("Pit Fighter") },
} as const;

let queryClient: QueryClient;

async function open(page: keyof typeof PAGES) {
  queryClient = createQueryClient();
  renderCatalogueRoute(`/campaigns/1/${PAGES[page].path}`, { queryClient });
  await PAGES[page].ready();
  await settle();
}

async function visit(user: ReturnType<typeof setupUser>, page: keyof typeof PAGES) {
  await user.click(screen.getByRole("link", { name: page }));
  await PAGES[page].ready();
  await settle();
}

const sorted = (calls: string[]) => [...calls].sort();

beforeEach(() => {
  fakeApi.reset();
  fakeRealtime.reset();
  routeCampaignShell();
  routeCatalogue();
});

afterEach(() => {
  cleanup();
  queryClient?.clear();
});

describe("catalogue pages: cold loads", () => {
  it("Wargear: the shell, then the items and item-properties lists, once each", async () => {
    await open("Wargear");

    expect(sorted(fakeApi.calls())).toEqual(sorted([...SHELL, LIST.items, LIST.properties]));
  });

  it("Skills: the shell and the skills list, once (the per-row Learn dialogs read nothing closed)", async () => {
    await open("Skills");

    expect(sorted(fakeApi.calls())).toEqual(sorted([...SHELL, LIST.skills]));
  });

  it("Spells: the shell and the spells list, once", async () => {
    await open("Spells");

    expect(sorted(fakeApi.calls())).toEqual(sorted([...SHELL, LIST.spells]));
  });

  it("Bestiary: the shell, the bestiary as the server lists it (no exclude_type, with descriptions) and your favourites", async () => {
    await open("Bestiary");

    expect(sorted(fakeApi.calls())).toEqual(sorted([...SHELL, LIST.bestiary, FAVOURITES]));
    expect(fakeApi.calls().some((call) => call.includes("exclude_type"))).toBe(false);
    // The cards keep their descriptions (and search reads them).
    expect(screen.getByText("Bites ankles.")).toBeVisible();
    expect(screen.getByText("Warhorse")).toBeVisible();
  });

  it("Hired Swords: the shell and the hired-swords list, once", async () => {
    await open("Hired Swords");

    expect(sorted(fakeApi.calls())).toEqual(sorted([...SHELL, LIST.hiredSwords]));
  });
});

describe("catalogue pages: the shared 5-minute cache", () => {
  it("reads each list once over a tour of all five pages and back again", async () => {
    const user = setupUser();
    await open("Wargear");

    for (const page of ["Skills", "Spells", "Bestiary", "Hired Swords", "Wargear"] as const) {
      await visit(user, page);
    }
    for (const page of ["Skills", "Spells", "Hired Swords"] as const) {
      await visit(user, page);
    }

    // Every page's list once, and specials not at all.
    for (const list of Object.values(LIST).filter((list) => list !== LIST.specials)) {
      expect(fakeApi.countOf(list)).toBe(1);
    }
    expect(fakeApi.countOf(LIST.specials)).toBe(0);
  });

  it("lets the prebattle Load from Bestiary picker read the list the Bestiary page cached, and list just those animals", async () => {
    await open("Bestiary");
    cleanup();
    fakeApi.clearRequests();

    renderCatalogueRoute("/campaigns/1/bestiary-picker", { queryClient });
    expect(await screen.findByText("Sewer Rat")).toBeVisible();
    await settle();

    expect(fakeApi.countOf(LIST.bestiary)).toBe(0);
    const listed = screen.getAllByRole("button").map((button) => button.textContent);
    expect(listed.filter((text) => /^(Sewer Rat|Warhound|Warhorse)/.test(text ?? ""))).toHaveLength(
      3
    );
  });

  it("lets the hero's New skill and New spell dialogs read the lists Skills and Spells cached", async () => {
    const user = setupUser();
    await open("Skills");
    await visit(user, "Spells");
    fakeApi.clearRequests();

    await user.click(screen.getByRole("link", { name: "Warband" }));
    expect(await screen.findByText("Warband page")).toBeVisible();
    await settle();

    expect(fakeApi.countOf(LIST.skills)).toBe(0);
    expect(fakeApi.countOf(LIST.spells)).toBe(0);
  });

  it("has those dialogs read each list once on a cold warband page", async () => {
    queryClient = createQueryClient();
    renderCatalogueRoute("/campaigns/1/warband", { queryClient });
    expect(await screen.findByText("Warband page")).toBeVisible();
    // Waits for the reads themselves (a fixed pause raced them under a busy run), then gives a
    // duplicate the chance to start before counting.
    await waitFor(() => {
      expect(fakeApi.countOf(LIST.skills)).toBeGreaterThan(0);
      expect(fakeApi.countOf(LIST.spells)).toBeGreaterThan(0);
    });
    await settle();

    expect(fakeApi.countOf(LIST.skills)).toBe(1);
    expect(fakeApi.countOf(LIST.spells)).toBe(1);
  });

  it("lets the Bestiary's Add entry dialog read only the lists no page cached yet", async () => {
    const user = setupUser();
    await open("Wargear");
    await visit(user, "Skills");
    await visit(user, "Bestiary");
    fakeApi.clearRequests();

    await user.click(screen.getByRole("button", { name: "Add entry" }));
    expect(await screen.findByRole("dialog", { name: "Add Bestiary Entry" })).toBeVisible();
    await settle();

    expect(sorted(fakeApi.calls())).toEqual(sorted([LIST.specials, LIST.spells]));
  });
});
