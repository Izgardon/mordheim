/**
 * The Bestiary by kind (the bestiary rewrite, step 3), as the app mounts it (layout, fake server):
 * one list of every beast, each card saying whether it is a mount, a pet or a creature; the Kind
 * filter (`?kind=`) and the search; and a beast without a profile, most pets, saying "No profile"
 * where the others show their stat line.
 */
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { routeCampaignShell } from "@/test/campaign-fixtures";
import { LIST, bestiaryDetail, raven, routeCatalogue } from "@/test/catalogue-fixtures";
import { renderCatalogueRoute } from "@/test/catalogue-routes";
import { fakeApi } from "@/test/fake-api";
import { fakeRealtime } from "@/test/fake-realtime";
import { setupUser } from "@/test/user-event";

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

const card = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name}`) });
const cardNames = () =>
  screen
    .getAllByRole("heading", { level: 3 })
    .map((heading) => heading.textContent?.replace(/(Custom|House rule|Archived)$/, ""));
const currentPath = () => screen.getByLabelText("Current path");
const kindFilter = () => screen.getByRole("group", { name: "Kind" });

beforeEach(() => {
  fakeApi.reset();
  fakeRealtime.reset();
  routeCampaignShell();
  routeCatalogue();
});

describe("Bestiary: the three kinds", () => {
  it("lists every beast, each card saying its kind, from one read of the whole bestiary", async () => {
    renderCatalogueRoute("/campaigns/1/bestiary");
    await screen.findByText("Sewer Rat");

    expect(cardNames()).toEqual(["Raven", "Sewer Rat", "Warhorse", "Warhound"]);
    expect(within(card("Warhorse")).getByText("Mount")).toBeVisible();
    expect(within(card("Raven")).getByText("Pet")).toBeVisible();
    expect(within(card("Warhound")).getByText("Creature")).toBeVisible();
    expect(fakeApi.countOf(LIST.bestiary)).toBe(1);
  });

  it("filters by kind with the Kind buttons, keeping the kind in the URL; All shows every kind again", async () => {
    const user = setupUser();
    renderCatalogueRoute("/campaigns/1/bestiary");
    await screen.findByText("Sewer Rat");

    await user.click(within(kindFilter()).getByRole("button", { name: "Pet" }));

    expect(currentPath()).toHaveTextContent(/^\/campaigns\/1\/bestiary\?kind=pet$/);
    expect(within(kindFilter()).getByRole("button", { name: "Pet" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(cardNames()).toEqual(["Raven"]);

    await user.click(within(kindFilter()).getByRole("button", { name: "Creature" }));
    expect(cardNames()).toEqual(["Sewer Rat", "Warhound"]);

    await user.click(within(kindFilter()).getByRole("button", { name: "All" }));
    expect(currentPath()).toHaveTextContent(/^\/campaigns\/1\/bestiary$/);
    expect(cardNames()).toHaveLength(4);
    expect(fakeApi.countOf(LIST.bestiary)).toBe(1);
  });

  it("opens a shared link on its kind and search", async () => {
    renderCatalogueRoute("/campaigns/1/bestiary?kind=creature&q=war");

    expect(await screen.findByText("Warhound")).toBeVisible();
    expect(cardNames()).toEqual(["Warhound"]);
  });

  it("finds a beast by its kind's name too", async () => {
    const user = setupUser();
    renderCatalogueRoute("/campaigns/1/bestiary");
    await screen.findByText("Sewer Rat");

    await user.type(screen.getByRole("searchbox", { name: "Search bestiary" }), "mount");

    expect(cardNames()).toEqual(["Warhorse"]);
  });
});

describe("a beast without a profile", () => {
  it('says "No profile" on its card where the others show their stat line', async () => {
    renderCatalogueRoute("/campaigns/1/bestiary");
    await screen.findByText("Raven");

    expect(within(card("Raven")).getByText("No profile")).toBeVisible();
    expect(within(card("Raven")).queryByRole("table")).toBeNull();
    const horse = within(card("Warhorse")).getByRole("table");
    expect(within(horse).getAllByRole("cell")[0]).toHaveTextContent("8");
  });

  it('says "No profile" in its detail panel', async () => {
    fakeApi.on("GET /bestiary/20/", bestiaryDetail(raven));
    renderCatalogueRoute("/campaigns/1/bestiary?entry=20");

    const heading = await screen.findByRole("heading", { name: "Raven" });
    const panel = heading.closest("div.space-y-4") as HTMLElement;
    expect(within(panel).getByText("No profile")).toBeVisible();
    expect(within(panel).queryByRole("table")).toBeNull();
    expect(within(panel).getByText(/^Pet/)).toBeVisible();
  });
});
