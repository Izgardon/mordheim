/**
 * Characterisation of the acquire (Buy/Give) dialog before pass 2's fixes and PR B's split of
 * `useAcquireItemDialogShared`: the requests a purchase sends for the stash and for each unit
 * kind, where the dialog reads gold, and what the player sees. The real dialog runs down to
 * `apiRequest`, which a fake server answers, so the split has to keep these requests and texts.
 */
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { useState, type ComponentProps } from "react";
import { useQuery } from "@tanstack/react-query";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import AcquireItemDialog from "./AcquireItemDialog";
import { ShownWarbandProvider } from "@/features/warbands/components/warband/shown-warband-context";
import { queryKeys } from "@/lib/query-keys";
import { TestDiceProvider } from "@/test/dice";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { chooseOption, selectNear } from "@/test/select-option";
import { setupUser } from "@/test/user-event";
import {
  makeItem,
  makeVeteranHenchmenGroup,
  makeVeteranHero,
  makeVeteranHiredSword,
} from "@/test/warband-fixtures";

import type { Item } from "@/features/items/types/item-types";
import type { WarbandTrade } from "@/features/warbands/types/warband-types";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const store = vi.hoisted(() => ({ warband: null as unknown }));
vi.mock("@/stores/app-store", () => ({
  useAppStore: () => ({ warband: store.warband, diceColor: "#2e8555" }),
}));

const hero = makeVeteranHero();
const group = makeVeteranHenchmenGroup();
const hiredSword = makeVeteranHiredSword();

/**
 * The app store's warband as the page fills it: the sheet's warband merged with its summary,
 * whose unit rows carry no items (so a unit buy GETs the unit first).
 */
const storeWarband = (overrides: Record<string, unknown> = {}) => ({
  id: 9,
  name: "The Black Wolves",
  faction: "Mercenaries",
  campaign_id: 7,
  user_id: 1,
  created_at: "",
  updated_at: "",
  gold: 500,
  rating: 99,
  resources: [],
  heroes: [{ id: 11, warband_id: 9, name: hero.name, unit_type: "Captain", xp: 7, large: false }],
  hired_swords: [
    { id: 31, warband_id: 9, name: hiredSword.name, unit_type: "Warrior Priest", xp: 4 },
  ],
  henchmen_groups: [{ id: 21, warband_id: 9, name: group.name, unit_type: "Thugs", xp: 4 }],
  ...overrides,
});

const trade = (overrides: Partial<WarbandTrade>): WarbandTrade => ({
  id: 1,
  warband_id: 9,
  parent_id: null,
  action: "Starting gold",
  description: "Starting gold",
  price: 500,
  notes: "",
  children: [],
  created_at: "2026-10-01T10:00:00Z",
  updated_at: "2026-10-01T10:00:00Z",
  ...overrides,
});

const rope: Item = makeItem({
  id: 120,
  name: "Rope",
  type: "Misc",
  cost: null,
  availabilities: [{ id: 7, cost: 5, rarity: 2, restrictions: [] }],
});

/** Common for Mercenaries at 20 gc, Rare 9 at 40 gc for everyone else. */
const luckyCharm: Item = makeItem({
  id: 55,
  name: "Lucky Charm",
  type: "Misc",
  cost: null,
  availabilities: [
    {
      id: 1,
      cost: 20,
      rarity: 2,
      restrictions: [
        {
          restriction: { id: 1, type: "Warband", restriction: "Mercenaries" },
          additional_note: "",
        },
      ],
    },
    { id: 2, cost: 40, rarity: 9, restrictions: [] },
  ],
});

/**
 * The warband page's sheet query, so a write's summary refresh has an observer to update, and
 * so the dialog can read the warband on screen (the summary carries its gold and unit rows).
 */
function SheetObserver({ warbandId = 9, gold = 500 }: { warbandId?: number; gold?: number }) {
  const { heroes, hired_swords, henchmen_groups } = storeWarband();
  useQuery({
    queryKey: queryKeys.campaign.warbandSheet(7, warbandId),
    queryFn: () => new Promise<never>(() => undefined),
    initialData: {
      warband: { ...storeWarband(), id: warbandId, gold: undefined },
      summary: { gold, heroes, hired_swords, henchmen_groups },
      capabilities: {},
      heroes: [],
      henchmen_groups: [],
      hired_swords: [],
    },
    staleTime: Infinity,
  });
  return null;
}

type DialogProps = Partial<ComponentProps<typeof AcquireItemDialog>>;

/** The dialog opened by a caller that unmounts it on close, as the stash and item menus do. */
function OpenDialog({ onClosed, ...props }: DialogProps & { onClosed: () => void }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <AcquireItemDialog
      item={rope}
      open
      trigger={null}
      onOpenChange={(next) => {
        if (!next) {
          setOpen(false);
          onClosed();
        }
      }}
      {...props}
    />
  );
}

/** `shown`: the warband page around the dialog, showing that warband (with that gold). */
const renderDialog = (
  props: DialogProps = {},
  shown: { warbandId: number; gold: number } | null = null
) => {
  const onAcquire = vi.fn();
  const onClosed = vi.fn();
  const dialog = <OpenDialog onAcquire={onAcquire} onClosed={onClosed} {...props} />;
  const utils = renderWithQueryClient(
    <TestDiceProvider>
      <SheetObserver />
      {shown ? (
        <ShownWarbandProvider campaignId={7} warbandId={shown.warbandId}>
          <SheetObserver warbandId={shown.warbandId} gold={shown.gold} />
          {dialog}
        </ShownWarbandProvider>
      ) : (
        dialog
      )}
    </TestDiceProvider>
  );
  return { ...utils, onAcquire, onClosed };
};

type User = ReturnType<typeof setupUser>;

const buyButton = () => screen.getByRole("button", { name: /^(Buy|Give|Buying\.\.\.)$/ });

/** Waits for the dialog's loads on open (the unit lists) to have gone out. */
const openLoadsSent = () =>
  waitFor(() => expect(fakeApi.countOf("GET /warbands/9/heroes/")).toBe(1));

/** Waits for the gold check to settle with Buy enabled, then clicks it. */
const clickBuy = async (user: User) => {
  await waitFor(() => expect(buyButton()).toBeEnabled());
  await user.click(buyButton());
};

/** The purchase's follow-up writes answer like the server. */
const answerWrites = () => {
  fakeApi.on("POST /warbands/9/trades/", (body: unknown) =>
    trade({ id: 900, ...(body as object) })
  );
  fakeApi.on("POST /warbands/9/logs/", { id: 800 });
  fakeApi.on("GET /warbands/9/summary/", { gold: 495, rating: 99 });
};

beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.releasePointerCapture = vi.fn();
});

beforeEach(() => {
  vi.restoreAllMocks();
  fakeApi.reset();
  store.warband = storeWarband();
  fakeApi.on("GET /warbands/9/henchmen-groups/", [group]);
  fakeApi.on("GET /warbands/9/heroes/", [{ ...hero, items: undefined }]);
  answerWrites();
});

describe("AcquireItemDialog: requests per purchase (ECON-PERF-01)", () => {
  it("buys into the stash: two GETs on open, then the item, the Bought trade, the log and a summary GET (ECON-PERF-01, pinned; flips in PR B)", async () => {
    const user = setupUser();
    fakeApi.on("POST /warbands/9/items/", { id: 120, name: "Rope", cost: 5, quantity: 1 });
    const { onAcquire, onClosed } = renderDialog({ presetUnitType: "stash" });

    await clickBuy(user);

    await waitFor(() => expect(onClosed).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(fakeApi.countOf("GET /warbands/9/summary/")).toBe(1));
    expect(fakeApi.calls()).toEqual([
      "GET /warbands/9/henchmen-groups/",
      "GET /warbands/9/heroes/",
      "POST /warbands/9/items/",
      "POST /warbands/9/trades/",
      "POST /warbands/9/logs/",
      "GET /warbands/9/summary/",
    ]);
    expect(fakeApi.bodyOf("POST /warbands/9/items/")).toEqual({
      item_id: 120,
      quantity: 1,
      cost: 5,
    });
    expect(fakeApi.bodyOf("POST /warbands/9/trades/")).toEqual({
      action: "Bought",
      description: "Rope",
      price: 5,
    });
    // A stash purchase is logged as a stash entry, naming no hero (BUG-110).
    expect(fakeApi.bodyOf("POST /warbands/9/logs/")).toEqual({
      feature: "loadout",
      entry_type: "stash_item",
      payload: { item: "Rope", price: 5 },
    });
    expect(onAcquire).toHaveBeenCalledWith(
      rope,
      "stash",
      "",
      { isBuying: true, quantity: 1, unitPrice: 5, totalPrice: 5, reason: "", baseCost: 5 },
      undefined
    );
  });

  it("buys for a hero: GETs the hero, PATCHes his whole item list, then the trade, log and summary (ECON-PERF-01, pinned; flips in PR B)", async () => {
    const user = setupUser();
    fakeApi.on("GET /warbands/9/heroes/11/", hero);
    const saved = { ...hero, items: [...hero.items, { ...rope, cost: 5 }] };
    fakeApi.on("PATCH /warbands/9/heroes/11/", saved);
    const { onAcquire } = renderDialog({
      presetUnitType: "heroes",
      presetUnitId: 11,
      disableUnitSelection: true,
    });
    await openLoadsSent();
    fakeApi.clearRequests();

    await clickBuy(user);

    await waitFor(() => expect(fakeApi.countOf("GET /warbands/9/summary/")).toBe(1));
    expect(fakeApi.calls()).toEqual([
      "GET /warbands/9/heroes/11/",
      "PATCH /warbands/9/heroes/11/",
      "POST /warbands/9/trades/",
      "POST /warbands/9/logs/",
      "GET /warbands/9/summary/",
    ]);
    expect(fakeApi.bodyOf("PATCH /warbands/9/heroes/11/")).toEqual({
      items: [
        { id: 101, cost: 10 },
        { id: 102, cost: 2 },
        { id: 102, cost: 2 },
        { id: 103, cost: 20 },
        { id: 120, cost: 5 },
      ],
    });
    expect(fakeApi.bodyOf("POST /warbands/9/logs/")).toEqual({
      feature: "loadout",
      entry_type: "hero_item",
      payload: { hero: "Aldric the Bold", item: "Rope", price: 5 },
    });
    // The PATCH's answer goes to the caller, which writes it with no GET after.
    expect(onAcquire).toHaveBeenCalledWith(rope, "heroes", "11", expect.anything(), saved);
  });

  it("buys for a hired sword the same way, through its own endpoints (ECON-PERF-01, pinned; flips in PR B)", async () => {
    const user = setupUser();
    fakeApi.on("GET /warbands/9/hired-swords/31/", hiredSword);
    fakeApi.on("PATCH /warbands/9/hired-swords/31/", hiredSword);
    renderDialog({ presetUnitType: "hiredswords", presetUnitId: 31, disableUnitSelection: true });
    await openLoadsSent();
    fakeApi.clearRequests();

    await clickBuy(user);

    await waitFor(() => expect(fakeApi.countOf("GET /warbands/9/summary/")).toBe(1));
    expect(fakeApi.calls()).toEqual([
      "GET /warbands/9/hired-swords/31/",
      "PATCH /warbands/9/hired-swords/31/",
      "POST /warbands/9/trades/",
      "POST /warbands/9/logs/",
      "GET /warbands/9/summary/",
    ]);
    expect(fakeApi.bodyOf("PATCH /warbands/9/hired-swords/31/")).toEqual({
      items: [
        { id: 105, cost: 3 },
        { id: 103, cost: 20 },
        { id: 120, cost: 5 },
      ],
    });
    expect(fakeApi.bodyOf("POST /warbands/9/logs/")).toMatchObject({
      entry_type: "hired_sword_item",
      payload: { hero: "Brother Hal", item: "Rope", price: 5 },
    });
  });

  it("buys for a henchmen group from the group list it loaded on open, no unit GET (ECON-PERF-01, pinned; flips in PR B)", async () => {
    const user = setupUser();
    fakeApi.on("PATCH /warbands/9/henchmen-groups/21/", group);
    renderDialog({ presetUnitType: "henchmen", presetUnitId: 21, disableUnitSelection: true });
    await openLoadsSent();
    fakeApi.clearRequests();

    await clickBuy(user);

    await waitFor(() => expect(fakeApi.countOf("GET /warbands/9/summary/")).toBe(1));
    expect(fakeApi.calls()).toEqual([
      "PATCH /warbands/9/henchmen-groups/21/",
      "POST /warbands/9/trades/",
      "POST /warbands/9/logs/",
      "GET /warbands/9/summary/",
    ]);
    expect(fakeApi.bodyOf("PATCH /warbands/9/henchmen-groups/21/")).toEqual({
      items: [
        { id: 104, cost: 3 },
        { id: 104, cost: 3 },
        { id: 104, cost: 3 },
        { id: 102, cost: 2 },
        { id: 102, cost: 2 },
        { id: 102, cost: 2 },
        { id: 120, cost: 5 },
      ],
    });
    expect(fakeApi.bodyOf("POST /warbands/9/logs/")).toMatchObject({
      entry_type: "henchmen_item",
      payload: { hero: "Black Knives", item: "Rope", price: 5 },
    });
  });

  it("charges quantity x price for a common item and says so in the trade and the log", async () => {
    const user = setupUser();
    fakeApi.on("POST /warbands/9/items/", { id: 120, name: "Rope", cost: 5, quantity: 3 });
    renderDialog({ presetUnitType: "stash" });
    await waitFor(() => expect(buyButton()).toBeEnabled());

    await chooseOption(user, selectNear("Qty"), "3");

    expect(screen.getByRole("button", { name: "Price: 5 x 3 = 15 gc" })).toBeInTheDocument();
    await clickBuy(user);
    await waitFor(() => expect(fakeApi.countOf("POST /warbands/9/logs/")).toBe(1));
    expect(fakeApi.bodyOf("POST /warbands/9/items/")).toEqual({
      item_id: 120,
      quantity: 3,
      cost: 5,
    });
    expect(fakeApi.bodyOf("POST /warbands/9/trades/")).toEqual({
      action: "Bought",
      description: "Rope x 3",
      price: 15,
    });
    expect(fakeApi.bodyOf("POST /warbands/9/logs/")).toMatchObject({
      entry_type: "stash_item",
      payload: { item: "Rope", price: 15, quantity: 3 },
    });
  });

  it("gives an item without a trade or a gold check, logging the reason", async () => {
    const user = setupUser();
    fakeApi.on("POST /warbands/9/items/", { id: 120, name: "Rope", cost: null, quantity: 1 });
    store.warband = storeWarband({
      resources: [{ id: 3, warband_id: 9, name: "Gold Crowns", amount: 0 }],
    });
    renderDialog({ presetUnitType: "stash" });

    await user.click(screen.getByRole("button", { name: "Give item" }));
    await user.type(screen.getByPlaceholderText("Optional reason"), "Found in the ruins");
    await clickBuy(user);

    await waitFor(() => expect(fakeApi.countOf("POST /warbands/9/logs/")).toBe(1));
    expect(fakeApi.countOf("POST /warbands/9/trades/")).toBe(0);
    // With no catalogue cost, a given item still stores the availability's price.
    expect(fakeApi.bodyOf("POST /warbands/9/items/")).toEqual({
      item_id: 120,
      quantity: 1,
      cost: 5,
    });
    expect(fakeApi.bodyOf("POST /warbands/9/logs/")).toEqual({
      feature: "loadout",
      entry_type: "stash_item",
      payload: { item: "Rope", reason: "Found in the ruins" },
    });
  });

  it("queues a purchase without any request in roster edit mode (deferred commit)", async () => {
    const user = setupUser();
    const { onAcquire, onClosed } = renderDialog({
      presetUnitType: "heroes",
      presetUnitId: 11,
      disableUnitSelection: true,
      variant: "unit-edit",
      deferCommit: true,
      emitWarbandUpdate: false,
      reservedGold: 0,
    });
    await openLoadsSent();
    fakeApi.clearRequests();

    await clickBuy(user);

    expect(onClosed).toHaveBeenCalledTimes(1);
    expect(fakeApi.calls()).toEqual([]);
    expect(onAcquire).toHaveBeenCalledWith(rope, "heroes", "11", {
      isBuying: true,
      quantity: 1,
      unitPrice: 5,
      totalPrice: 5,
      reason: "",
      baseCost: 5,
    });
  });
});

describe("AcquireItemDialog: gold", () => {
  it("blocks Buy over the available gold and names the amount", async () => {
    store.warband = storeWarband({ gold: 4 });
    renderDialog({ presetUnitType: "stash" });

    expect(await screen.findByText("Not enough gold crowns. Available: 4 gc.")).toBeInTheDocument();
    expect(buyButton()).toBeDisabled();
  });

  it("holds back the gold already reserved by queued purchases", async () => {
    renderDialog({ presetUnitType: "stash", reservedGold: 497 });

    expect(await screen.findByText("Not enough gold crowns. Available: 3 gc.")).toBeInTheDocument();
    expect(buyButton()).toBeDisabled();
  });

  it("reads gold from the sheet's summary, so a group's recruits count and no ledger is loaded (BUG-37)", async () => {
    const user = setupUser();
    // The server's gold (the sheet's summary) is 200 - 75 - 75 = 50; the ledger isn't read.
    store.warband = storeWarband({ gold: 50 });
    fakeApi.on("POST /warbands/9/items/", { id: 120, name: "Rope", cost: 40, quantity: 1 });
    renderDialog({
      presetUnitType: "stash",
      item: { ...rope, availabilities: [{ id: 7, cost: 120, rarity: 2, restrictions: [] }] },
    });

    expect(await screen.findByText("Not enough gold crowns. Available: 50 gc.")).toBeVisible();
    expect(buyButton()).toBeDisabled();
    fireEvent.change(within(screen.getByRole("dialog")).getByDisplayValue("120"), {
      target: { value: "40" },
    });

    await clickBuy(user);
    await waitFor(() => expect(fakeApi.countOf("POST /warbands/9/trades/")).toBe(1));
    expect(fakeApi.bodyOf("POST /warbands/9/trades/")).toMatchObject({ price: 40 });
    expect(fakeApi.countOf("GET /warbands/9/trades/")).toBe(0);
  });

  it("ignores a Gold Crowns resource: gold is the summary's (BUG-37)", async () => {
    store.warband = storeWarband({
      gold: 500,
      resources: [{ id: 3, warband_id: 9, name: "Gold Crowns", amount: 0 }],
    });
    renderDialog({ presetUnitType: "stash" });

    await waitFor(() => expect(buyButton()).toBeEnabled());
    expect(screen.queryByText(/Not enough gold crowns/)).not.toBeInTheDocument();
    expect(fakeApi.countOf("GET /warbands/9/trades/")).toBe(0);
  });

  it("buys for the warband on screen without a warband of your own (BUG-107)", async () => {
    const user = setupUser();
    store.warband = null;
    fakeApi.on("POST /warbands/9/items/", { id: 120, name: "Rope", cost: 5, quantity: 1 });
    const { onClosed } = renderDialog({ presetUnitType: "stash" }, { warbandId: 9, gold: 500 });

    await clickBuy(user);

    await waitFor(() => expect(onClosed).toHaveBeenCalledTimes(1));
    expect(fakeApi.calls().filter((call) => !call.startsWith("GET"))).toEqual([
      "POST /warbands/9/items/",
      "POST /warbands/9/trades/",
      "POST /warbands/9/logs/",
    ]);
  });

  it("gives to the warband on screen without a warband of your own (BUG-107)", async () => {
    const user = setupUser();
    store.warband = null;
    fakeApi.on("POST /warbands/9/items/", { id: 120, name: "Rope", cost: 5, quantity: 1 });
    const { onClosed } = renderDialog({ presetUnitType: "stash" }, { warbandId: 9, gold: 0 });

    await user.click(screen.getByRole("button", { name: "Give item" }));
    await clickBuy(user);

    await waitFor(() => expect(onClosed).toHaveBeenCalledTimes(1));
    expect(fakeApi.countOf("POST /warbands/9/items/")).toBe(1);
    expect(fakeApi.countOf("POST /warbands/9/trades/")).toBe(0);
  });

  it("charges the warband on screen with its own gold, not yours (BUG-107)", async () => {
    // Your own warband (9, the app store's) has 500 gc; warband 12 on screen has 4.
    renderDialog({ presetUnitType: "stash" }, { warbandId: 12, gold: 4 });

    expect(await screen.findByText("Not enough gold crowns. Available: 4 gc.")).toBeVisible();
    expect(buyButton()).toBeDisabled();
  });

  it("says why Buy and Give are off when there's no warband at all, not only in a tooltip (BUG-107)", async () => {
    const user = setupUser();
    store.warband = null;
    renderDialog({ presetUnitType: "stash" });

    const notice = "You need a warband in this campaign to buy or give items.";
    expect(screen.getByText(notice)).toBeVisible();
    expect(buyButton()).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Give item" }));
    expect(buyButton()).toHaveTextContent("Give");
    expect(buyButton()).toBeDisabled();
    expect(screen.getByText(notice)).toBeVisible();
    expect(fakeApi.calls()).toEqual([]);
  });
});

describe("AcquireItemDialog: failures", () => {
  it("shows a failed unit write in the dialog, keeps it open and records nothing", async () => {
    const user = setupUser();
    fakeApi.on("GET /warbands/9/heroes/11/", hero);
    fakeApi.fail("PATCH /warbands/9/heroes/11/", new Error("Hero not found."));
    const { onAcquire, onClosed } = renderDialog({
      presetUnitType: "heroes",
      presetUnitId: 11,
      disableUnitSelection: true,
    });

    await clickBuy(user);

    expect(await screen.findByText("Hero not found.")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onClosed).not.toHaveBeenCalled();
    expect(onAcquire).not.toHaveBeenCalled();
    expect(fakeApi.countOf("POST /warbands/9/trades/")).toBe(0);
    expect(fakeApi.countOf("POST /warbands/9/logs/")).toBe(0);
  });

  it("closes as a success when the Bought trade is refused, so the item is never paid for (BUG-07, pinned; flips in PR B)", async () => {
    const user = setupUser();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    fakeApi.on("GET /warbands/9/heroes/11/", hero);
    fakeApi.on("PATCH /warbands/9/heroes/11/", hero);
    fakeApi.fail("POST /warbands/9/trades/", new Error("Server error"));
    const { onAcquire, onClosed } = renderDialog({
      presetUnitType: "heroes",
      presetUnitId: 11,
      disableUnitSelection: true,
    });

    await clickBuy(user);

    await waitFor(() => expect(onClosed).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onAcquire).toHaveBeenCalledTimes(1);
    expect(fakeApi.countOf("PATCH /warbands/9/heroes/11/")).toBe(1);
    expect(fakeApi.countOf("POST /warbands/9/logs/")).toBe(1);
    // The refusal reaches the console only.
    expect(consoleError).toHaveBeenCalledWith(
      "Post-acquire action failed",
      new Error("Server error")
    );
  });

  it("PATCHes the item list it just read, so a copy moved off the hero in between comes back (BUG-07, pinned; flips in PR B)", async () => {
    const user = setupUser();
    // The detail GET still shows the dagger another tab is moving off the hero.
    fakeApi.on("GET /warbands/9/heroes/11/", { ...hero, items: [hero.items[0], hero.items[1]] });
    fakeApi.on("PATCH /warbands/9/heroes/11/", hero);
    renderDialog({ presetUnitType: "heroes", presetUnitId: 11, disableUnitSelection: true });

    await clickBuy(user);

    await waitFor(() => expect(fakeApi.countOf("PATCH /warbands/9/heroes/11/")).toBe(1));
    // The whole list is replaced, not appended to.
    expect(fakeApi.bodyOf("PATCH /warbands/9/heroes/11/")).toEqual({
      items: [
        { id: 101, cost: 10 },
        { id: 102, cost: 2 },
        { id: 120, cost: 5 },
      ],
    });
  });
});

describe("AcquireItemDialog: rare items", () => {
  it("charges and records one copy of a rare item, though quantity 3 was picked before switching to it (BUG-70)", async () => {
    const user = setupUser();
    fakeApi.on("POST /warbands/9/items/", { id: 55, name: "Lucky Charm", cost: 40, quantity: 1 });
    renderDialog({ item: luckyCharm, presetUnitType: "stash" });
    await waitFor(() => expect(buyButton()).toBeEnabled());

    await chooseOption(user, selectNear("Qty"), "3");
    expect(screen.getByRole("button", { name: "Price: 20 x 3 = 60 gc" })).toBeInTheDocument();
    await chooseOption(user, selectNear("Availability:"), /Rarity 9/);

    // One copy everywhere: the summary, the price section, the item, the trade and the log.
    expect(screen.getByRole("button", { name: "Price: 40 gc" })).toBeInTheDocument();
    expect(screen.getByText("Final price")).toBeInTheDocument();
    expect(screen.queryByText("Unit price")).not.toBeInTheDocument();
    expect(screen.queryByText("120 gc")).not.toBeInTheDocument();

    await clickBuy(user);

    await waitFor(() => expect(fakeApi.countOf("POST /warbands/9/logs/")).toBe(1));
    expect(fakeApi.bodyOf("POST /warbands/9/items/")).toEqual({
      item_id: 55,
      quantity: 1,
      cost: 40,
    });
    expect(fakeApi.bodyOf("POST /warbands/9/trades/")).toEqual({
      action: "Bought",
      description: "Lucky Charm",
      price: 40,
    });
    expect(fakeApi.bodyOf("POST /warbands/9/logs/")).toMatchObject({
      payload: { item: "Lucky Charm", price: 40 },
    });
    expect(fakeApi.bodyOf("POST /warbands/9/logs/")).not.toHaveProperty("payload.quantity");
  });

  it("queues one copy of a rare item after quantity 3 in roster edit mode", async () => {
    const user = setupUser();
    const { onAcquire } = renderDialog({
      item: luckyCharm,
      presetUnitType: "heroes",
      presetUnitId: 11,
      disableUnitSelection: true,
      variant: "unit-edit",
      deferCommit: true,
      emitWarbandUpdate: false,
    });
    await waitFor(() => expect(buyButton()).toBeEnabled());

    await chooseOption(user, selectNear("Qty"), "3");
    await chooseOption(user, selectNear("Availability:"), /Rarity 9/);
    await clickBuy(user);

    expect(onAcquire).toHaveBeenCalledWith(
      luckyCharm,
      "heroes",
      "11",
      expect.objectContaining({ quantity: 1, unitPrice: 40, totalPrice: 40 })
    );
  });
});
