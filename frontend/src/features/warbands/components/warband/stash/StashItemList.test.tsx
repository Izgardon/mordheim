/**
 * The stash's item menu (Sell, Move, Buy again): the requests each action sends, what the page's
 * cache holds afterwards, and where Move targets and Buy again come from (the warband on screen,
 * BUG-107). The stash is wired as the warband page wires it (the warchest query, reloaded after
 * every change, inside the page's shown warband); `apiRequest` is answered by a fake server.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { useEffect } from "react";
import { useQuery, type QueryClient } from "@tanstack/react-query";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import StashItemList from "./StashItemList";
import { ShownWarbandProvider } from "../shown-warband-context";
import { AppToaster } from "@/components/ui/toaster";
import { useWarbandWarchest } from "@/features/warbands/hooks/warband/useWarbandWarchest";
import { ApiError } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { TestDiceProvider } from "@/test/dice";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { chooseOption, selectNear } from "@/test/select-option";
import { setupUser } from "@/test/user-event";
import {
  makeItem,
  makeStashItem,
  makeVeteranHenchmenGroup,
  makeVeteranHero,
} from "@/test/warband-fixtures";

import type { WarbandSheet } from "@/features/warbands/types/warband-sheet";
import type { WarbandHero } from "@/features/warbands/types/warband-types";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const store = vi.hoisted(() => ({ warband: null as unknown }));
vi.mock("@/stores/app-store", () => ({
  useAppStore: () => ({ warband: store.warband, diceColor: "#2e8555" }),
}));

const MY_WARBAND = 9;
const THEIR_WARBAND = 12;

const aldric = makeVeteranHero();
const zorn = makeVeteranHero({ id: 41, warband_id: THEIR_WARBAND, name: "Zorn", is_leader: true });
const myGroup = makeVeteranHenchmenGroup();

/** The app store's warband: always the signed-in player's own, summary rows without items. */
const myStoreWarband = {
  id: MY_WARBAND,
  name: "The Black Wolves",
  faction: "Mercenaries",
  campaign_id: 7,
  user_id: 1,
  created_at: "",
  updated_at: "",
  gold: 500,
  resources: [],
  heroes: [{ id: 11, warband_id: MY_WARBAND, name: aldric.name, unit_type: "Captain", xp: 7 }],
  hired_swords: [],
};

const sword = makeStashItem({ id: 101, name: "Sword", cost: 10, quantity: 2 });
const rope = makeStashItem({ id: 120, name: "Rope", cost: 5, quantity: 1 });

/** A unit as the summary lists it (no items). */
const summaryRow = ({ id, warband_id, name, unit_type, xp, large }: WarbandHero) => ({
  id,
  warband_id,
  name,
  unit_type,
  xp,
  large,
});

const sheetOf = (warbandId: number, heroes: WarbandHero[], gold = 500): WarbandSheet => ({
  warband: { ...myStoreWarband, id: warbandId, heroes: undefined, hired_swords: undefined },
  summary: {
    gold,
    rating: 99,
    heroes: heroes.map(summaryRow) as WarbandHero[],
    hired_swords: [],
    henchmen_groups: warbandId === MY_WARBAND ? [myGroup] : [],
  },
  capabilities: {
    edit: true,
    level_up: true,
    manage_items: true,
    edit_backstory: true,
    delete: true,
    add_custom: true,
  },
  heroes,
  henchmen_groups: [],
  hired_swords: [],
});

/** The page's header gold, read from the cached sheet as the page shows it. */
function SheetGold({ warbandId }: { warbandId: number }) {
  const sheet = useQuery<WarbandSheet>({
    queryKey: queryKeys.campaign.warbandSheet(7, warbandId),
    queryFn: () => new Promise<never>(() => undefined),
    staleTime: Infinity,
  });
  return <p>Header gold: {sheet.data?.summary.gold}</p>;
}

/** The stash as the warband page shows it: opened, reloaded after every change, on its warband. */
function PageStash({
  warbandId,
  canEdit = true,
  onHeroUpdated,
}: {
  warbandId: number;
  canEdit?: boolean;
  onHeroUpdated?: (hero: WarbandHero) => void;
}) {
  const warchest = useWarbandWarchest(7, warbandId);
  const { setIsWarchestOpen } = warchest;
  useEffect(() => setIsWarchestOpen(true), [setIsWarchestOpen]);
  return (
    <ShownWarbandProvider campaignId={7} warbandId={warbandId}>
      <TestDiceProvider>
        <AppToaster />
        <SheetGold warbandId={warbandId} />
        <StashItemList
          items={warchest.warchestItems}
          isLoading={warchest.isWarchestLoading}
          error={warchest.warchestError}
          onItemsChanged={warchest.loadWarchestItems}
          onHeroUpdated={onHeroUpdated}
          warbandId={warbandId}
          canEdit={canEdit}
          onClose={() => undefined}
        />
      </TestDiceProvider>
    </ShownWarbandProvider>
  );
}

type User = ReturnType<typeof setupUser>;

const renderStash = (
  warbandId: number,
  options: { canEdit?: boolean; heroes?: WarbandHero[]; gold?: number } = {}
) => {
  const onHeroUpdated = vi.fn();
  const utils = renderWithQueryClient(
    <PageStash warbandId={warbandId} canEdit={options.canEdit} onHeroUpdated={onHeroUpdated} />
  );
  utils.queryClient.setQueryData(
    queryKeys.campaign.warbandSheet(7, warbandId),
    sheetOf(warbandId, options.heroes ?? [aldric], options.gold)
  );
  return { ...utils, onHeroUpdated };
};

/** The stash row's menu button, named after the row (BUG-112). */
const menuButtonOf = (label: string) =>
  screen.getByRole("button", { name: `Actions for ${label}` });

const openMenu = async (user: User, label: string, action: string) => {
  await user.click(await waitFor(() => menuButtonOf(label)));
  await user.click(screen.getByRole("button", { name: action }));
};

const sheetIn = (queryClient: QueryClient, warbandId: number) =>
  queryClient.getQueryData<WarbandSheet>(queryKeys.campaign.warbandSheet(7, warbandId));

beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.releasePointerCapture = vi.fn();
});

beforeEach(() => {
  vi.restoreAllMocks();
  fakeApi.reset();
  store.warband = myStoreWarband;
  fakeApi.on(`GET /warbands/${MY_WARBAND}/items/`, [sword, rope]);
  fakeApi.on(`GET /warbands/${THEIR_WARBAND}/items/`, [sword, rope]);
  fakeApi.on(`GET /warbands/${MY_WARBAND}/henchmen-groups/`, [myGroup]);
});

describe("StashItemList: Sell", () => {
  it("sells at half the cost rounded up in one request and applies the answer's stash row (ECON-PERF-08)", async () => {
    const user = setupUser();
    fakeApi.on(`POST /warbands/${MY_WARBAND}/item-sales/`, {
      summary: { gold: 505, rating: 99 },
      source: { ...sword, quantity: 1 },
      target: null,
      stash_item: { ...sword, quantity: 1 },
      removed_stash_item_id: null,
    });
    renderStash(MY_WARBAND);

    await openMenu(user, "Sword x 2", "Sell");
    const dialog = screen.getByRole("dialog", { name: "Sell Sword" });
    expect(within(dialog).getByText("10 gc")).toBeInTheDocument();
    expect(within(dialog).getByDisplayValue("5")).toBeInTheDocument();
    fakeApi.clearRequests();
    await user.click(within(dialog).getByRole("button", { name: "Sell" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(fakeApi.calls()).toEqual([`POST /warbands/${MY_WARBAND}/item-sales/`]);
    expect(fakeApi.bodyOf(`POST /warbands/${MY_WARBAND}/item-sales/`)).toEqual({
      source_type: "stash",
      source_id: null,
      item_id: 101,
      quantity: 1,
      price: 5,
    });
    expect(await screen.findByText("Sword")).toBeInTheDocument();
    expect(screen.getByText("Header gold: 505")).toBeInTheDocument();
  });

  it("drops the row when the last copy is sold", async () => {
    const user = setupUser();
    fakeApi.on(`POST /warbands/${MY_WARBAND}/item-sales/`, {
      summary: { gold: 503, rating: 99 },
      source: null,
      target: null,
      stash_item: null,
      removed_stash_item_id: 120,
    });
    renderStash(MY_WARBAND);

    await openMenu(user, "Rope", "Sell");
    fakeApi.clearRequests();
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Sell" }));

    await waitFor(() => expect(screen.queryByText("Rope")).not.toBeInTheDocument());
    expect(fakeApi.calls()).toEqual([`POST /warbands/${MY_WARBAND}/item-sales/`]);
    expect(fakeApi.bodyOf(`POST /warbands/${MY_WARBAND}/item-sales/`)).toMatchObject({
      item_id: 120,
      quantity: 1,
      price: 3,
    });
    expect(screen.getByText("Header gold: 503")).toBeInTheDocument();
  });

  it("keeps the dialog open with the server's message when the sale fails", async () => {
    const user = setupUser();
    fakeApi.fail(
      `POST /warbands/${MY_WARBAND}/item-sales/`,
      new ApiError("Item not found in stash.", 400, {})
    );
    renderStash(MY_WARBAND);

    await openMenu(user, "Rope", "Sell");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Sell" }));

    expect(await screen.findByText("Item not found in stash.")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Sell Rope" })).toBeInTheDocument();
    expect(screen.getByText("Header gold: 500")).toBeInTheDocument();
  });
});

describe("StashItemList: Move", () => {
  it("moves a copy to a hero picked from the sheet in one request, applying the answer (ECON-PERF-08)", async () => {
    const user = setupUser();
    const armedAldric = {
      ...aldric,
      items: [...aldric.items, makeItem({ id: 101, name: "Sword", cost: 10 })],
    };
    fakeApi.on(`POST /warbands/${MY_WARBAND}/item-transfers/`, {
      summary: { gold: 500, rating: 99 },
      source: null,
      target: armedAldric,
      stash_item: { ...sword, quantity: 1 },
      removed_stash_item_id: null,
    });
    const { queryClient, onHeroUpdated } = renderStash(MY_WARBAND);
    await waitFor(() => menuButtonOf("Sword x 2"));
    fakeApi.clearRequests();

    await openMenu(user, "Sword x 2", "Move");
    const dialog = screen.getByRole("dialog", { name: "Move Sword" });
    await chooseOption(user, selectNear("Unit Type", dialog), "Heroes");
    await chooseOption(user, selectNear("Hero", dialog), "Aldric the Bold - Captain");
    await user.click(within(dialog).getByRole("button", { name: "Move" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(fakeApi.calls()).toEqual([`POST /warbands/${MY_WARBAND}/item-transfers/`]);
    // The stash row left in the answer replaces the cached one.
    expect(screen.getByText("Sword")).toBeInTheDocument();
    expect(fakeApi.bodyOf(`POST /warbands/${MY_WARBAND}/item-transfers/`)).toEqual({
      source_type: "stash",
      source_id: null,
      target_type: "hero",
      target_id: 11,
      item_id: 101,
      quantity: 1,
    });
    expect(onHeroUpdated).toHaveBeenCalledWith(armedAldric);
    expect(sheetIn(queryClient, MY_WARBAND)?.heroes[0].items.map((item) => item.id)).toEqual([
      101, 102, 102, 103, 101,
    ]);
  });

  it("offers the units of the warband on screen as Move targets, not your own (BUG-107)", async () => {
    const user = setupUser();
    const armedZorn = { ...zorn, items: [...zorn.items, makeItem({ id: 101, name: "Sword" })] };
    fakeApi.on(`POST /warbands/${THEIR_WARBAND}/item-transfers/`, {
      summary: { gold: 500, rating: 99 },
      source: null,
      target: armedZorn,
      stash_item: { ...sword, quantity: 1 },
      removed_stash_item_id: null,
    });
    const { queryClient } = renderStash(THEIR_WARBAND, { heroes: [zorn] });
    await waitFor(() => menuButtonOf("Sword x 2"));
    fakeApi.clearRequests();

    await openMenu(user, "Sword x 2", "Move");
    const dialog = screen.getByRole("dialog", { name: "Move Sword" });
    await chooseOption(user, selectNear("Unit Type", dialog), "Heroes");
    await user.click(selectNear("Hero", dialog));

    // The hero of the warband on screen is offered; your own hero is not.
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Zorn - Captain",
    ]);
    await user.keyboard("{Escape}");
    await chooseOption(user, selectNear("Hero", dialog), "Zorn - Captain");
    await user.click(within(dialog).getByRole("button", { name: "Move" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(fakeApi.bodyOf(`POST /warbands/${THEIR_WARBAND}/item-transfers/`)).toMatchObject({
      target_type: "hero",
      target_id: 41,
    });
    expect(fakeApi.calls().some((call) => call.includes(`/warbands/${MY_WARBAND}/`))).toBe(false);
    expect(sheetIn(queryClient, THEIR_WARBAND)?.heroes[0].items).toEqual(armedZorn.items);
  });
});

describe("StashItemList: Buy again", () => {
  it("loads the item by id and buys another copy into the stash: eight requests (ECON-PERF-01, pinned; flips in PR B)", async () => {
    const user = setupUser();
    fakeApi.on(
      "GET /items/120/",
      makeItem({
        id: 120,
        name: "Rope",
        cost: null,
        availabilities: [{ id: 7, cost: 5, rarity: 2, restrictions: [] }],
      })
    );
    fakeApi.on(`GET /warbands/${MY_WARBAND}/heroes/`, [aldric]);
    fakeApi.on(`POST /warbands/${MY_WARBAND}/items/`, { ...rope, quantity: 2 });
    fakeApi.on(`POST /warbands/${MY_WARBAND}/trades/`, { id: 900 });
    fakeApi.on(`POST /warbands/${MY_WARBAND}/logs/`, { id: 800 });
    fakeApi.on(`GET /warbands/${MY_WARBAND}/summary/`, { gold: 495, rating: 99 });
    renderStash(MY_WARBAND);
    await waitFor(() => menuButtonOf("Rope"));
    fakeApi.clearRequests();

    await openMenu(user, "Rope", "Buy again");
    const dialog = await screen.findByRole("dialog", { name: "Acquire item" });
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Buy" })).toBeEnabled());
    fakeApi.on(`GET /warbands/${MY_WARBAND}/items/`, [sword, { ...rope, quantity: 2 }]);
    await user.click(within(dialog).getByRole("button", { name: "Buy" }));

    expect(await screen.findByText("Rope x 2")).toBeInTheDocument();
    expect(await screen.findByText("Header gold: 495")).toBeInTheDocument();
    expect(fakeApi.calls()).toEqual([
      "GET /items/120/",
      `GET /warbands/${MY_WARBAND}/henchmen-groups/`,
      `GET /warbands/${MY_WARBAND}/heroes/`,
      `POST /warbands/${MY_WARBAND}/items/`,
      `GET /warbands/${MY_WARBAND}/items/`,
      `POST /warbands/${MY_WARBAND}/trades/`,
      `POST /warbands/${MY_WARBAND}/logs/`,
      `GET /warbands/${MY_WARBAND}/summary/`,
    ]);
  });

  it("buys into the stash on screen with that warband's gold, not yours (BUG-107)", async () => {
    const user = setupUser();
    fakeApi.on(
      "GET /items/120/",
      makeItem({
        id: 120,
        name: "Rope",
        cost: null,
        availabilities: [{ id: 7, cost: 5, rarity: 2, restrictions: [] }],
      })
    );
    fakeApi.on(`GET /warbands/${THEIR_WARBAND}/henchmen-groups/`, []);
    fakeApi.on(`GET /warbands/${THEIR_WARBAND}/heroes/`, [zorn]);
    fakeApi.on(`POST /warbands/${THEIR_WARBAND}/items/`, { ...rope, quantity: 2 });
    fakeApi.on(`POST /warbands/${THEIR_WARBAND}/trades/`, { id: 900 });
    fakeApi.on(`POST /warbands/${THEIR_WARBAND}/logs/`, { id: 800 });
    fakeApi.on(`GET /warbands/${THEIR_WARBAND}/summary/`, { gold: 75, rating: 40 });
    // Your own warband (the app store's) has 500 gc; the warband on screen has 30.
    renderStash(THEIR_WARBAND, { heroes: [zorn], gold: 30 });
    await waitFor(() => menuButtonOf("Rope"));
    fakeApi.clearRequests();

    await openMenu(user, "Rope", "Buy again");
    const dialog = await screen.findByRole("dialog", { name: "Acquire item" });
    await chooseOption(user, selectNear("Qty", dialog), "10");
    expect(within(dialog).getByText("Not enough gold crowns. Available: 30 gc.")).toBeVisible();
    await chooseOption(user, selectNear("Qty", dialog), "1");
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Buy" })).toBeEnabled());
    await user.click(within(dialog).getByRole("button", { name: "Buy" }));

    expect(await screen.findByText("Header gold: 75")).toBeInTheDocument();
    const writes = fakeApi.calls().filter((call) => !call.startsWith("GET"));
    expect(writes).toEqual([
      `POST /warbands/${THEIR_WARBAND}/items/`,
      `POST /warbands/${THEIR_WARBAND}/trades/`,
      `POST /warbands/${THEIR_WARBAND}/logs/`,
    ]);
    expect(fakeApi.calls().some((call) => call.includes(`/warbands/${MY_WARBAND}/`))).toBe(false);
  });

  it("says so when the item can't be loaded for Buy again (ECON-UX-05)", async () => {
    const user = setupUser();
    fakeApi.fail("GET /items/120/", new ApiError("Not found.", 404, { detail: "Not found." }));
    renderStash(MY_WARBAND);

    await openMenu(user, "Rope", "Buy again");

    expect(await screen.findByText("Couldn't load Rope.")).toBeInTheDocument();
    expect(screen.getByText("Not found.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("StashItemList: viewers", () => {
  it("shows no item menus without manage_items", async () => {
    renderStash(THEIR_WARBAND, { canEdit: false });

    expect(await screen.findByText("Sword x 2")).toBeInTheDocument();
    expect(
      within(screen.getByText("Sword x 2").parentElement as HTMLElement).queryByRole("button")
    ).toBeNull();
  });
});
