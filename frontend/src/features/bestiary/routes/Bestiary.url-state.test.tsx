/**
 * What the Bestiary and Hired Swords pages keep in the URL: only the open entry (`?entry=`,
 * `?profile=`). Search, type filter and page live in component state: they outlast opening an
 * entry and Back only because the page stays mounted, and a visit to another page clears them
 * (CAT-UX-05). Back is `navigate(-1)`, so on a link opened fresh it goes nowhere (BUG-150).
 * PR C keeps `type`, `q` and `archived` in the query string (CAT-NEW-02).
 */
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { routeCampaignShell } from "@/test/campaign-fixtures";
import {
  LIST,
  bestiaryDetail,
  bestiaryEntry,
  hiredSwordDetail,
  pitFighter,
  routeCatalogue,
} from "@/test/catalogue-fixtures";
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

const currentPath = () => screen.getByLabelText("Current path");
const card = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name}`) });
const searchBox = () => screen.getByRole("searchbox", { name: "Search bestiary" });

/** Leaves for Wargear and comes back to the Bestiary by the rail. */
async function revisitBestiary(user: ReturnType<typeof setupUser>) {
  await user.click(screen.getByRole("link", { name: "Wargear" }));
  await screen.findByRole("button", { name: /^Rusty Cleaver/ });
  await user.click(screen.getByRole("link", { name: "Bestiary" }));
}

beforeEach(() => {
  fakeApi.reset();
  fakeRealtime.reset();
  routeCampaignShell();
  routeCatalogue();
  fakeApi.on("GET /bestiary/5/", bestiaryDetail(bestiaryEntry()));
  fakeApi.on("GET /hired-swords/40/", hiredSwordDetail(pitFighter));
});

describe("Bestiary: search, type filter and page", () => {
  // Characterises current behaviour (CAT-UX-05, CAT-NEW-02, pinned; flips in PR C)
  it("puts only ?entry= in the URL; the search and type outlast Back because the page stays mounted (CAT-UX-05, pinned; flips in PR C)", async () => {
    const user = setupUser();
    renderCatalogueRoute("/campaigns/1/bestiary");
    await screen.findByText("Sewer Rat");

    await chooseOption(user, screen.getByText("All types").closest("button")!, "Attack");
    await user.type(searchBox(), "war");
    expect(currentPath()).toHaveTextContent(/^\/campaigns\/1\/bestiary$/);
    await user.click(card("Warhound"));

    expect(currentPath()).toHaveTextContent(/^\/campaigns\/1\/bestiary\?entry=5$/);
    expect(await screen.findByRole("heading", { name: "Warhound" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(await screen.findByRole("button", { name: /^Warhound/ })).toBeVisible();
    expect(searchBox()).toHaveValue("war");
    expect(screen.queryByText("Warhorse")).toBeNull();
    expect(screen.queryByText("Sewer Rat")).toBeNull();
  });

  // Characterises current behaviour (CAT-UX-05, CAT-NEW-02, pinned; flips in PR C)
  it("forgets the search, type and page after a visit to another page (CAT-UX-05, pinned; flips in PR C)", async () => {
    const user = setupUser();
    const many = Array.from({ length: 13 }, (_, index) =>
      bestiaryEntry({ id: 600 + index, name: `Rat ${String(index + 1).padStart(2, "0")}` })
    );
    fakeApi.on(LIST.creatures, [
      ...many,
      bestiaryEntry({ id: 6, name: "Warhorse", type: "Mount" }),
    ]);
    renderCatalogueRoute("/campaigns/1/bestiary");
    await screen.findByText("Rat 01");
    await user.type(searchBox(), "rat");
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("2 / 2")).toBeVisible();

    await revisitBestiary(user);

    expect(await screen.findByText("Rat 01")).toBeVisible();
    expect(searchBox()).toHaveValue("");
    expect(screen.getByText("1 / 2")).toBeVisible();
  });

  it("keeps the page an entry was opened from: Back returns to page 2", async () => {
    const user = setupUser();
    const many = Array.from({ length: 13 }, (_, index) =>
      bestiaryEntry({ id: 600 + index, name: `Rat ${String(index + 1).padStart(2, "0")}` })
    );
    fakeApi.on(LIST.creatures, many);
    fakeApi.on("GET /bestiary/612/", bestiaryDetail(many[12]));
    renderCatalogueRoute("/campaigns/1/bestiary");
    await screen.findByText("Rat 01");

    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(card("Rat 13"));
    await screen.findByRole("heading", { name: "Rat 13" });
    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(await screen.findByText("Rat 13")).toBeVisible();
    expect(screen.getByText("2 / 2")).toBeVisible();
  });

  // Characterises current behaviour (BUG-150, pinned; flips in PR C)
  it("goes nowhere on Back when the ?entry= link was opened fresh: Back is navigate(-1) (BUG-150, pinned; flips in PR C)", async () => {
    const user = setupUser();
    renderCatalogueRoute("/campaigns/1/bestiary?entry=5");
    await screen.findByRole("heading", { name: "Warhound" });

    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(currentPath()).toHaveTextContent(/^\/campaigns\/1\/bestiary\?entry=5$/);
    expect(screen.getByRole("heading", { name: "Warhound" })).toBeVisible();
  });

  it("lists the entries again after Back from the cached list, with no request", async () => {
    const user = setupUser();
    renderCatalogueRoute("/campaigns/1/bestiary");
    await screen.findByText("Sewer Rat");
    await user.click(card("Warhound"));
    await screen.findByRole("heading", { name: "Warhound" });
    fakeApi.clearRequests();

    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(await screen.findByText("Warhorse")).toBeVisible();
    expect(fakeApi.countOf(LIST.creatures)).toBe(0);
  });
});

describe("Hired Swords: search", () => {
  // Characterises current behaviour (CAT-UX-05, CAT-NEW-02, pinned; flips in PR C)
  it("puts only ?profile= in the URL, keeps the search over Back and forgets it after another page (CAT-UX-05, pinned; flips in PR C)", async () => {
    const user = setupUser();
    renderCatalogueRoute("/campaigns/1/hired-swords");
    await screen.findByText("Ogre Bodyguard");
    const hiredSearch = () => screen.getByRole("searchbox", { name: "Search hired swords" });

    await user.type(hiredSearch(), "pit");
    await user.click(card("Pit Fighter"));
    expect(currentPath()).toHaveTextContent(/^\/campaigns\/1\/hired-swords\?profile=40$/);
    expect(await screen.findByRole("heading", { name: "Pit Fighter" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(await screen.findByRole("button", { name: /^Pit Fighter/ })).toBeVisible();
    expect(hiredSearch()).toHaveValue("pit");
    expect(screen.queryByText("Ogre Bodyguard")).toBeNull();

    await user.click(screen.getByRole("link", { name: "Wargear" }));
    await screen.findByRole("button", { name: /^Rusty Cleaver/ });
    await user.click(screen.getByRole("link", { name: "Hired Swords" }));

    expect(await screen.findByText("Ogre Bodyguard")).toBeVisible();
    expect(hiredSearch()).toHaveValue("");
  });
});
