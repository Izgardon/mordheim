/**
 * Where the Wargear page keeps its tab, filters and search: in the query string (`tab`, `subtype`,
 * `single`, `q`; CAT-NEW-02), so a visit to an animal's bestiary entry and Back, the browser's
 * Back and a shared link all land on them (CAT-UX-05). Opened rows stay in the page.
 */
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { routeCampaignShell } from "@/test/campaign-fixtures";
import { bestiaryDetail, bestiaryEntry, routeCatalogue } from "@/test/catalogue-fixtures";
import { renderCatalogueRoute } from "@/test/catalogue-routes";
import { fakeApi } from "@/test/fake-api";
import { fakeRealtime } from "@/test/fake-realtime";
import { chooseOption } from "@/test/select-option";
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
const searchBox = () => screen.getByRole("searchbox", { name: "Search items" });

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
  it("keeps the Animals tab and the search over a bestiary visit and Back (CAT-UX-05, CAT-NEW-02)", async () => {
    const user = setupUser();
    await openWargear();
    await user.click(tab("Animals"));
    await user.type(searchBox(), "hound");
    expect(tab("Animals")).toHaveAttribute("data-active", "true");

    await user.click(within(row("Warhound")).getByRole("button", { name: "View bestiary entry" }));
    expect(currentPath()).toHaveTextContent("/campaigns/1/bestiary?entry=5");
    expect(await screen.findByRole("heading", { name: "Warhound" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(await screen.findByRole("button", { name: /^Warhound/ })).toBeVisible();
    expect(currentPath()).toHaveTextContent("/campaigns/1/items?tab=animals&q=hound");
    expect(tab("Animals")).toHaveAttribute("data-active", "true");
    expect(searchBox()).toHaveValue("hound");
    expect(screen.queryByRole("button", { name: /^Rusty Cleaver/ })).toBeNull();
  });

  it("puts the tab, the subtype filter and the search in the URL, replacing the history entry as you type (CAT-NEW-02)", async () => {
    const user = setupUser();
    renderCatalogueRoute("/campaigns/1/skills");
    await screen.findByRole("row", { name: /^Quick Hands/ });
    await user.click(screen.getByRole("link", { name: "Wargear" }));
    await screen.findByRole("button", { name: /^Rusty Cleaver/ });

    await user.click(tab("Armour"));
    await chooseOption(user, screen.getByText("All types").closest("button")!, "Armour");
    await user.type(searchBox(), "heavy");

    expect(await screen.findByRole("button", { name: /^Heavy Armour/ })).toBeVisible();
    expect(currentPath()).toHaveTextContent("/campaigns/1/items?tab=armour&subtype=Armour&q=heavy");
    // None of that added history: the browser's Back leaves Wargear.
    await user.click(screen.getByRole("button", { name: "Browser back" }));
    expect(await screen.findByRole("row", { name: /^Quick Hands/ })).toBeVisible();
  });

  it("opens a shared link on its tab, filter and search; the browser's Back after another page restores them (CAT-NEW-02)", async () => {
    const user = setupUser();
    renderCatalogueRoute("/campaigns/1/items?tab=misc&single=1&q=rope");
    expect(await screen.findByText("No gear found.")).toBeVisible();

    expect(tab("Miscellaneous")).toHaveAttribute("data-active", "true");
    expect(screen.getByText("Single use")).toBeVisible();
    expect(searchBox()).toHaveValue("rope");

    await user.click(screen.getByRole("link", { name: "Skills" }));
    await screen.findByRole("row", { name: /^Quick Hands/ });
    await user.click(screen.getByRole("button", { name: "Browser back" }));

    expect(await screen.findByRole("searchbox", { name: "Search items" })).toHaveValue("rope");
    expect(currentPath()).toHaveTextContent("/campaigns/1/items?tab=misc&single=1&q=rope");
  });

  it("clears the subtype and expanded rows on a tab change, but keeps the search", async () => {
    const user = setupUser();
    await openWargear();
    await user.type(searchBox(), "a");
    await user.click(row("Rusty Cleaver"));
    expect(row("Rusty Cleaver")).toHaveAttribute("aria-expanded", "true");

    await user.click(tab("Armour"));
    await user.click(tab("Weapons"));

    expect(row("Rusty Cleaver")).toHaveAttribute("aria-expanded", "false");
    expect(searchBox()).toHaveValue("a");
    expect(currentPath()).toHaveTextContent("/campaigns/1/items?q=a");
  });
});
