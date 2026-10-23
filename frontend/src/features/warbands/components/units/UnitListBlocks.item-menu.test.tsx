/**
 * A unit card's item menu (Sell, Move, Buy again): the requests each action sends, what the
 * page's cache holds afterwards, and where Move targets and Buy again come from (the warband on
 * screen, BUG-107). The real menu hook and dialogs run; the card reads its unit from the cached
 * sheet inside the page's shown warband, and `apiRequest` is answered by a fake server.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import UnitListBlocks from "./UnitListBlocks";
import { ShownWarbandProvider } from "../warband/shown-warband-context";
import { AppToaster } from "@/components/ui/toaster";
import { ApiError } from "@/lib/api-client";
import { heroKind } from "@/features/warbands/units/kinds/hero";
import { queryKeys } from "@/lib/query-keys";
import { TestDiceProvider } from "@/test/dice";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { getFieldNear } from "@/test/roster-queries";
import { chooseOption, selectNear } from "@/test/select-option";
import { setupUser } from "@/test/user-event";
import {
  dagger,
  lightArmour,
  makeItem,
  makeStashItem,
  makeVeteranHenchmenGroup,
  makeVeteranHero,
  sword,
} from "@/test/warband-fixtures";

import type { WarbandSheet } from "@/features/warbands/types/warband-sheet";
import type { WarbandHero, WarbandItemSummary } from "@/features/warbands/types/warband-types";

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
const zorn = makeVeteranHero({ id: 41, warband_id: THEIR_WARBAND, name: "Zorn" });
const kurt = makeVeteranHero({ id: 42, warband_id: THEIR_WARBAND, name: "Kurt", is_leader: false });
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

const sheetKey = (warbandId: number) => queryKeys.campaign.warbandSheet(7, warbandId);
const stashKey = (warbandId: number) => queryKeys.campaign.warbandStash(7, warbandId);

/** A unit as the summary lists it (no items). */
const summaryRow = ({ id, warband_id, name, unit_type, xp, large }: WarbandHero) => ({
  id,
  warband_id,
  name,
  unit_type,
  xp,
  large,
});

const sheetOf = (warbandId: number, heroes: WarbandHero[]): WarbandSheet => ({
  warband: { ...myStoreWarband, id: warbandId, heroes: undefined, hired_swords: undefined },
  summary: {
    gold: 500,
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
    edit_catalogue: true,
    trade: true,
  },
  heroes,
  henchmen_groups: warbandId === MY_WARBAND ? [myGroup] : [],
  hired_swords: [],
});

/** A hero card's loadout, fed from the cached sheet and written back to it, as on the page. */
function PageHeroLoadout({ warbandId, heroId }: { warbandId: number; heroId: number }) {
  return (
    <ShownWarbandProvider campaignId={7} warbandId={warbandId}>
      <AppToaster />
      <HeroLoadout warbandId={warbandId} heroId={heroId} />
    </ShownWarbandProvider>
  );
}

function HeroLoadout({ warbandId, heroId }: { warbandId: number; heroId: number }) {
  const queryClient = useQueryClient();
  const sheet = useQuery<WarbandSheet>({
    queryKey: sheetKey(warbandId),
    queryFn: () => new Promise<never>(() => undefined),
    staleTime: Infinity,
  });
  const unit = sheet.data?.heroes.find((hero) => hero.id === heroId);
  if (!sheet.data || !unit) return null;
  return (
    <TestDiceProvider>
      <p>Header gold: {sheet.data.summary.gold}</p>
      <UnitListBlocks
        kind={heroKind}
        unit={unit}
        warbandId={warbandId}
        canEdit
        onUnitUpdated={(updated) =>
          queryClient.setQueryData<WarbandSheet>(
            sheetKey(warbandId),
            (current: WarbandSheet | undefined) =>
              current && {
                ...current,
                heroes: current.heroes.map((hero) => (hero.id === updated.id ? updated : hero)),
              }
          )
        }
      />
    </TestDiceProvider>
  );
}

const renderCard = (warbandId: number, hero: WarbandHero, heroes: WarbandHero[] = [hero]) => {
  const utils = renderWithQueryClient(
    <PageHeroLoadout warbandId={warbandId} heroId={hero.id} />,
    {}
  );
  utils.queryClient.setQueryData(sheetKey(warbandId), sheetOf(warbandId, heroes));
  utils.queryClient.setQueryData<WarbandItemSummary[]>(stashKey(warbandId), [
    makeStashItem({ id: 120, name: "Rope", cost: 5, quantity: 1 }),
  ]);
  return utils;
};

type User = ReturnType<typeof setupUser>;

/** The entry's menu button, named after the entry (BUG-112). */
const menuButtonOf = (label: string) =>
  screen.findByRole("button", { name: `Actions for ${label}` });

const openMenu = async (user: User, label: string, action: string) => {
  await user.click(await menuButtonOf(label));
  await user.click(screen.getByRole("button", { name: action }));
};

const heroIn = (queryClient: QueryClient, warbandId: number, heroId: number) =>
  queryClient
    .getQueryData<WarbandSheet>(sheetKey(warbandId))
    ?.heroes.find((hero) => hero.id === heroId);

/** Aldric after one dagger left him. */
const aldricWithOneDagger = { ...aldric, items: [sword, dagger, lightArmour] };

beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.releasePointerCapture = vi.fn();
});

beforeEach(() => {
  vi.restoreAllMocks();
  fakeApi.reset();
  store.warband = myStoreWarband;
  fakeApi.on(`GET /warbands/${MY_WARBAND}/henchmen-groups/`, [myGroup]);
});

describe("unit item menu: Sell", () => {
  it("sells one copy in one request and writes the answer's unit and summary to the sheet", async () => {
    const user = setupUser();
    fakeApi.on(`POST /warbands/${MY_WARBAND}/item-sales/`, {
      summary: { gold: 501, rating: 99 },
      source: aldricWithOneDagger,
      target: null,
      stash_item: null,
      removed_stash_item_id: null,
    });
    const { queryClient } = renderCard(MY_WARBAND, aldric);

    await openMenu(user, "Dagger x 2", "Sell");
    const dialog = screen.getByRole("dialog", { name: "Sell Dagger" });
    expect(within(dialog).getByText("2 gc")).toBeInTheDocument();
    expect(getFieldNear("Quantity", dialog)).toHaveDisplayValue("1");
    expect(getFieldNear("Sell Price", dialog)).toHaveDisplayValue("1");
    await user.click(within(dialog).getByRole("button", { name: "Sell" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(fakeApi.calls()).toEqual([`POST /warbands/${MY_WARBAND}/item-sales/`]);
    expect(fakeApi.bodyOf(`POST /warbands/${MY_WARBAND}/item-sales/`)).toEqual({
      source_type: "hero",
      source_id: 11,
      item_id: 102,
      quantity: 1,
      price: 1,
    });
    expect(screen.getByRole("button", { name: "Dagger" })).toBeInTheDocument();
    expect(screen.getByText("Header gold: 501")).toBeInTheDocument();
    expect(heroIn(queryClient, MY_WARBAND, 11)?.items).toEqual(aldricWithOneDagger.items);
  });

  it("starts at the copy's suggested sale price and says where it comes from (decision 3)", async () => {
    const user = setupUser();
    const pricedDagger = {
      ...dagger,
      suggested_sale_price: 3,
      sale_price_basis: "campaign_price" as const,
    };
    renderCard(MY_WARBAND, { ...aldric, items: [pricedDagger, pricedDagger] });

    await openMenu(user, "Dagger x 2", "Sell");

    const dialog = screen.getByRole("dialog", { name: "Sell Dagger" });
    expect(getFieldNear("Sell Price", dialog)).toHaveDisplayValue("3");
    expect(within(dialog).getByText("Suggested: half the current price.")).toBeInTheDocument();
  });
});

describe("unit item menu: Move", () => {
  it("moves a copy to the stash in one request and merges the answer's stash row (ECON-PERF-08)", async () => {
    const user = setupUser();
    const daggerRow = makeStashItem({ id: 102, name: "Dagger", cost: 2, quantity: 1 });
    fakeApi.on(`POST /warbands/${MY_WARBAND}/item-transfers/`, {
      summary: { gold: 500, rating: 99 },
      source: aldricWithOneDagger,
      target: daggerRow,
      stash_item: daggerRow,
      removed_stash_item_id: null,
    });
    const { queryClient } = renderCard(MY_WARBAND, aldric);

    await openMenu(user, "Dagger x 2", "Move");
    const dialog = screen.getByRole("dialog", { name: "Move Dagger" });
    await chooseOption(user, selectNear("Unit Type", dialog), "Warband Stash");
    await user.click(within(dialog).getByRole("button", { name: "Move" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    // The targets come from the sheet: no henchmen-groups GET when Move opens.
    expect(fakeApi.calls()).toEqual([`POST /warbands/${MY_WARBAND}/item-transfers/`]);
    expect(fakeApi.bodyOf(`POST /warbands/${MY_WARBAND}/item-transfers/`)).toEqual({
      source_type: "hero",
      source_id: 11,
      target_type: "stash",
      target_id: null,
      item_id: 102,
      quantity: 1,
    });
    expect(heroIn(queryClient, MY_WARBAND, 11)?.items).toEqual(aldricWithOneDagger.items);
    expect(
      queryClient.getQueryData<WarbandItemSummary[]>(stashKey(MY_WARBAND))?.map((row) => row.name)
    ).toEqual(["Rope", "Dagger"]);
  });

  it("moves a copy to a henchmen group listed from the sheet, with no GET (ECON-PERF-08)", async () => {
    const user = setupUser();
    const armedGroup = { ...myGroup, items: [...myGroup.items, dagger] };
    fakeApi.on(`POST /warbands/${MY_WARBAND}/item-transfers/`, {
      summary: { gold: 500, rating: 99 },
      source: aldricWithOneDagger,
      target: armedGroup,
      stash_item: null,
      removed_stash_item_id: null,
    });
    const { queryClient } = renderCard(MY_WARBAND, aldric);

    await openMenu(user, "Dagger x 2", "Move");
    const dialog = screen.getByRole("dialog", { name: "Move Dagger" });
    await chooseOption(user, selectNear("Unit Type", dialog), "Henchmen");
    await chooseOption(user, selectNear("Henchmen Group", dialog), "Black Knives - Thugs");
    await user.click(within(dialog).getByRole("button", { name: "Move" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(fakeApi.calls()).toEqual([`POST /warbands/${MY_WARBAND}/item-transfers/`]);
    expect(fakeApi.bodyOf(`POST /warbands/${MY_WARBAND}/item-transfers/`)).toMatchObject({
      target_type: "henchmen_group",
      target_id: 21,
    });
    expect(
      queryClient.getQueryData<WarbandSheet>(sheetKey(MY_WARBAND))?.henchmen_groups[0].items
    ).toHaveLength(7);
  });

  it("offers the other units of the warband on screen as Move targets (BUG-107)", async () => {
    const user = setupUser();
    renderCard(THEIR_WARBAND, zorn, [zorn, kurt]);

    await openMenu(user, "Dagger x 2", "Move");
    const dialog = screen.getByRole("dialog", { name: "Move Dagger" });
    await chooseOption(user, selectNear("Unit Type", dialog), "Heroes");
    await user.click(selectNear("Hero", dialog));

    // Zorn's fellow hero, not Zorn himself and not your own Aldric.
    expect(fakeApi.calls()).toEqual([]);
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Kurt - Captain",
    ]);
  });
});

describe("unit item menu: Buy again", () => {
  const daggerItem = makeItem({
    id: 102,
    name: "Dagger",
    cost: null,
    availabilities: [{ id: 4, cost: 2, rarity: 2, restrictions: [] }],
  });

  beforeEach(() => {
    fakeApi.on("GET /items/102/", daggerItem);
    fakeApi.on(`GET /warbands/${MY_WARBAND}/heroes/`, [aldric]);
  });

  it("buys another copy for the hero in one request and shows the answer's items on the card (ECON-PERF-01, decision 11)", async () => {
    const user = setupUser();
    const rearmed = [...aldric.items, { ...dagger }];
    fakeApi.on(`POST /warbands/${MY_WARBAND}/purchases/`, {
      target_type: "hero",
      target_id: 11,
      updated_at: "2026-10-18T10:00:00Z",
      items: rearmed,
      stash_item: null,
      trade: null,
      summary: { gold: 498, rating: 99 },
      warnings: [],
    });
    renderCard(MY_WARBAND, aldric);

    await openMenu(user, "Dagger x 2", "Buy again");
    const dialog = await screen.findByRole("dialog", { name: "Acquire item" });
    expect(dialog).toHaveAccessibleDescription(
      "Buy or give Dagger to a unit or the warband stash."
    );
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Buy" })).toBeEnabled());
    await user.click(within(dialog).getByRole("button", { name: "Buy" }));

    expect(await screen.findByRole("button", { name: "Dagger x 3" })).toBeInTheDocument();
    expect(await screen.findByText("Header gold: 498")).toBeInTheDocument();
    expect(fakeApi.calls()).toEqual([
      "GET /items/102/",
      `GET /warbands/${MY_WARBAND}/henchmen-groups/`,
      `GET /warbands/${MY_WARBAND}/heroes/`,
      `POST /warbands/${MY_WARBAND}/purchases/`,
    ]);
    expect(fakeApi.bodyOf(`POST /warbands/${MY_WARBAND}/purchases/`)).toEqual({
      item_id: 102,
      quantity: 1,
      is_buying: true,
      target_type: "hero",
      target_id: 11,
    });
  });

  it("says so when the item can't be loaded for Buy again (ECON-UX-05)", async () => {
    const user = setupUser();
    fakeApi.fail("GET /items/102/", new ApiError("Not found.", 404, { detail: "Not found." }));
    renderCard(MY_WARBAND, aldric);

    await openMenu(user, "Dagger x 2", "Buy again");

    expect(await screen.findByText("Couldn't load Dagger.")).toBeInTheDocument();
    expect(screen.getByText("Not found.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("starts at the copy's current price, house rule included, rather than the item's own (decision 11)", async () => {
    const user = setupUser();
    const housePriced = {
      ...aldric,
      items: aldric.items.map((item) => (item.id === 102 ? { ...item, current_price: 5 } : item)),
    };
    renderCard(MY_WARBAND, housePriced);

    await openMenu(user, "Dagger x 2", "Buy again");

    const dialog = await screen.findByRole("dialog", { name: "Acquire item" });
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Buy" })).toBeEnabled());
    expect(within(dialog).getByDisplayValue("5")).toBeInTheDocument();
    expect(within(dialog).queryByDisplayValue("2")).not.toBeInTheDocument();
  });

  it("buys another copy for another player's hero, on his warband (BUG-107)", async () => {
    const user = setupUser();
    const rearmed = [...zorn.items, { ...dagger }];
    fakeApi.on(`GET /warbands/${THEIR_WARBAND}/henchmen-groups/`, []);
    fakeApi.on(`GET /warbands/${THEIR_WARBAND}/heroes/`, [zorn, kurt]);
    fakeApi.on(`POST /warbands/${THEIR_WARBAND}/purchases/`, {
      target_type: "hero",
      target_id: 41,
      updated_at: "2026-10-18T10:00:00Z",
      items: rearmed,
      stash_item: null,
      trade: null,
      summary: { gold: 498, rating: 99 },
      warnings: [],
    });
    renderCard(THEIR_WARBAND, zorn, [zorn, kurt]);

    await openMenu(user, "Dagger x 2", "Buy again");
    const dialog = await screen.findByRole("dialog", { name: "Acquire item" });
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Buy" })).toBeEnabled());
    await user.click(within(dialog).getByRole("button", { name: "Buy" }));

    expect(await screen.findByRole("button", { name: "Dagger x 3" })).toBeInTheDocument();
    expect(await screen.findByText("Header gold: 498")).toBeInTheDocument();
    expect(fakeApi.calls().filter((call) => !call.startsWith("GET"))).toEqual([
      `POST /warbands/${THEIR_WARBAND}/purchases/`,
    ]);
    expect(fakeApi.bodyOf(`POST /warbands/${THEIR_WARBAND}/purchases/`)).toMatchObject({
      target_type: "hero",
      target_id: 41,
    });
    expect(fakeApi.calls().some((call) => call.includes(`/warbands/${MY_WARBAND}/`))).toBe(false);
  });
});
