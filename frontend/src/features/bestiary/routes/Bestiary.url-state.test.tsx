/**
 * What the Bestiary and Hired Swords pages keep in the URL (CAT-NEW-02): the search (`q`), the
 * type filter (`type`), the card page (`page`) and the open entry (`entry`, `profile`), so Back
 * from an entry, the browser's Back after another page and a shared link restore them
 * (CAT-UX-05). Back on an entry link opened fresh goes to the list, filters kept (BUG-150).
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

/** Thirteen rats: two pages of twelve. */
const many = Array.from({ length: 13 }, (_, index) =>
  bestiaryEntry({ id: 600 + index, name: `Rat ${String(index + 1).padStart(2, "0")}` })
);

beforeEach(() => {
  fakeApi.reset();
  fakeRealtime.reset();
  routeCampaignShell();
  routeCatalogue();
  fakeApi.on("GET /bestiary/5/", bestiaryDetail(bestiaryEntry()));
  fakeApi.on("GET /hired-swords/40/", hiredSwordDetail(pitFighter));
});

describe("Bestiary: search, type filter and page", () => {
  it("keeps the type, the search and the open entry in the URL; Back returns to the filtered list (CAT-UX-05, CAT-NEW-02)", async () => {
    const user = setupUser();
    renderCatalogueRoute("/campaigns/1/bestiary");
    await screen.findByText("Sewer Rat");

    await chooseOption(user, screen.getByText("All types").closest("button")!, "Attack");
    await user.type(searchBox(), "war");
    expect(currentPath()).toHaveTextContent("/campaigns/1/bestiary?type=Attack&q=war");
    await user.click(card("Warhound"));

    expect(currentPath()).toHaveTextContent("/campaigns/1/bestiary?type=Attack&q=war&entry=5");
    expect(await screen.findByRole("heading", { name: "Warhound" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(await screen.findByRole("button", { name: /^Warhound/ })).toBeVisible();
    expect(currentPath()).toHaveTextContent("/campaigns/1/bestiary?type=Attack&q=war");
    expect(searchBox()).toHaveValue("war");
    expect(screen.queryByText("Warhorse")).toBeNull();
    expect(screen.queryByText("Sewer Rat")).toBeNull();
  });

  it("restores the search and page with the browser's Back after another page, and a new search goes back to page 1 (CAT-UX-05, CAT-NEW-02)", async () => {
    const user = setupUser();
    fakeApi.on(LIST.bestiary, [...many, bestiaryEntry({ id: 6, name: "Warhorse", type: "Mount" })]);
    renderCatalogueRoute("/campaigns/1/bestiary");
    await screen.findByText("Rat 01");
    await user.type(searchBox(), "rat");
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("2 / 2")).toBeVisible();
    expect(currentPath()).toHaveTextContent("/campaigns/1/bestiary?q=rat&page=2");

    await user.click(screen.getByRole("link", { name: "Wargear" }));
    await screen.findByRole("button", { name: /^Rusty Cleaver/ });
    await user.click(screen.getByRole("button", { name: "Browser back" }));

    expect(await screen.findByText("Rat 13")).toBeVisible();
    expect(searchBox()).toHaveValue("rat");
    expect(screen.getByText("2 / 2")).toBeVisible();

    await user.type(searchBox(), " 1");
    expect(currentPath()).toHaveTextContent("/campaigns/1/bestiary?q=rat+1");
    // Rat 10 to Rat 13: one page, the first.
    expect(screen.getByText("Rat 10")).toBeVisible();
    expect(screen.queryByText("2 / 2")).toBeNull();
  });

  it("opens a shared link on its search and page", async () => {
    fakeApi.on(LIST.bestiary, many);
    renderCatalogueRoute("/campaigns/1/bestiary?q=rat&page=2");

    expect(await screen.findByText("Rat 13")).toBeVisible();
    expect(screen.getByText("2 / 2")).toBeVisible();
    expect(searchBox()).toHaveValue("rat");
  });

  it("keeps the page an entry was opened from: Back returns to page 2", async () => {
    const user = setupUser();
    fakeApi.on(LIST.bestiary, many);
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

  it("goes to the list on Back when the ?entry= link was opened fresh, keeping its filters (BUG-150)", async () => {
    const user = setupUser();
    renderCatalogueRoute("/campaigns/1/bestiary?type=Attack&entry=5");
    await screen.findByRole("heading", { name: "Warhound" });

    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(await screen.findByRole("button", { name: /^Warhound/ })).toBeVisible();
    expect(currentPath()).toHaveTextContent(/^\/campaigns\/1\/bestiary\?type=Attack$/);
    expect(screen.queryByText("Warhorse")).toBeNull();
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
    expect(fakeApi.countOf(LIST.bestiary)).toBe(0);
  });
});

describe("Hired Swords: search", () => {
  it("keeps the search and the open profile in the URL; Back and the browser's Back after another page restore it (CAT-UX-05, CAT-NEW-02)", async () => {
    const user = setupUser();
    renderCatalogueRoute("/campaigns/1/hired-swords");
    await screen.findByText("Ogre Bodyguard");
    const hiredSearch = () => screen.getByRole("searchbox", { name: "Search hired swords" });

    await user.type(hiredSearch(), "pit");
    await user.click(card("Pit Fighter"));
    expect(currentPath()).toHaveTextContent("/campaigns/1/hired-swords?q=pit&profile=40");
    expect(await screen.findByRole("heading", { name: "Pit Fighter" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(await screen.findByRole("button", { name: /^Pit Fighter/ })).toBeVisible();
    expect(hiredSearch()).toHaveValue("pit");
    expect(screen.queryByText("Ogre Bodyguard")).toBeNull();

    await user.click(screen.getByRole("link", { name: "Wargear" }));
    await screen.findByRole("button", { name: /^Rusty Cleaver/ });
    await user.click(screen.getByRole("button", { name: "Browser back" }));

    expect(await screen.findByRole("button", { name: /^Pit Fighter/ })).toBeVisible();
    expect(hiredSearch()).toHaveValue("pit");
  });

  it("goes to the list on Back when the ?profile= link was opened fresh (BUG-150)", async () => {
    const user = setupUser();
    renderCatalogueRoute("/campaigns/1/hired-swords?profile=40");
    await screen.findByRole("heading", { name: "Pit Fighter" });

    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(await screen.findByText("Ogre Bodyguard")).toBeVisible();
    expect(currentPath()).toHaveTextContent(/^\/campaigns\/1\/hired-swords$/);
  });
});
