/**
 * Where the Wargear page keeps its tab and search: in component state only, so a visit to an
 * animal's bestiary entry and Back land on Weapons with the search cleared, and nothing can be
 * shared as a link (CAT-UX-05). PR C keeps `tab`, `subtype`, `type` and `q` in the query string
 * (CAT-NEW-02).
 */
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { routeCampaignShell } from "@/test/campaign-fixtures";
import { bestiaryDetail, bestiaryEntry, routeCatalogue } from "@/test/catalogue-fixtures";
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

const row = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name}`) });
const currentPath = () => screen.getByLabelText("Current path");
const tab = (label: string) => screen.getByRole("button", { name: label });

async function openWargear() {
  renderCatalogueRoute("/campaigns/1/items");
  await screen.findByRole("button", { name: /^Rusty Cleaver/ });
}

beforeEach(() => {
  fakeApi.reset();
  fakeRealtime.reset();
  routeCampaignShell();
  routeCatalogue();
  fakeApi.on("GET /bestiary/5/", bestiaryDetail(bestiaryEntry()));
});

describe("Wargear: tab and search", () => {
  // Characterises current behaviour (CAT-UX-05, pinned; flips in PR C)
  it("forgets the Animals tab and the search after a bestiary visit and Back (CAT-UX-05, pinned; flips in PR C)", async () => {
    const user = setupUser();
    await openWargear();
    await user.click(tab("Animals"));
    await user.type(screen.getByRole("searchbox", { name: "Search items" }), "hound");
    expect(tab("Animals")).toHaveAttribute("data-active", "true");

    await user.click(within(row("Warhound")).getByRole("button", { name: "View bestiary entry" }));
    expect(currentPath()).toHaveTextContent("/campaigns/1/bestiary?entry=5");
    expect(await screen.findByRole("heading", { name: "Warhound" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(await screen.findByRole("button", { name: /^Rusty Cleaver/ })).toBeVisible();
    expect(currentPath()).toHaveTextContent(/^\/campaigns\/1\/items$/);
    expect(tab("Weapons")).toHaveAttribute("data-active", "true");
    expect(screen.getByRole("searchbox", { name: "Search items" })).toHaveValue("");
  });

  // Characterises current behaviour (CAT-UX-05, CAT-NEW-02, pinned; flips in PR C)
  it("keeps the tab, the subtype filter and the search out of the URL (CAT-UX-05, pinned; flips in PR C)", async () => {
    const user = setupUser();
    await openWargear();

    await user.click(tab("Armour"));
    await user.type(screen.getByRole("searchbox", { name: "Search items" }), "heavy");

    expect(await screen.findByRole("button", { name: /^Heavy Armour/ })).toBeVisible();
    expect(currentPath()).toHaveTextContent(/^\/campaigns\/1\/items$/);
  });

  it("clears the subtype and expanded rows on a tab change, but keeps the search", async () => {
    const user = setupUser();
    await openWargear();
    await user.type(screen.getByRole("searchbox", { name: "Search items" }), "a");
    await user.click(row("Rusty Cleaver"));
    expect(row("Rusty Cleaver")).toHaveAttribute("aria-expanded", "true");

    await user.click(tab("Armour"));
    await user.click(tab("Weapons"));

    expect(row("Rusty Cleaver")).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("searchbox", { name: "Search items" })).toHaveValue("a");
  });
});
