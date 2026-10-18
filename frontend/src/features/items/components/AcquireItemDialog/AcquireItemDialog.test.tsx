/**
 * The acquire (Buy/Give) dialog: the one request a purchase sends for the stash and for each unit
 * kind (BUG-07), where the dialog reads gold and how it asks before spending more than the
 * warband has (decision 2), and what the player sees. The real dialog runs down to `apiRequest`,
 * which a fake server answers.
 */
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { useState, type ComponentProps } from "react";
import { useQuery, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import AcquireItemDialog from "./AcquireItemDialog";
import { ShownWarbandProvider } from "@/features/warbands/components/warband/shown-warband-context";
import { ApiError } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { AppToaster } from "@/components/ui/toaster";
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
      <AppToaster />
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

const PURCHASE = "POST /warbands/9/purchases/";

type Answer = { target_type: string; target_id?: number | null } & Record<string, unknown>;

/** The server's answer to a purchase: the unit's items or the stash entry, gold, the Buy row. */
const purchaseAnswer = (overrides: Answer) => ({
  target_id: null,
  updated_at: null,
  items: null,
  stash_item: null,
  trade: trade({ id: 900, action: "Buy", description: "Rope", price: -5 }),
  summary: { gold: 495, rating: 99 },
  warnings: [],
  ...overrides,
});

/** The cached sheet of the warband on screen (the page reads gold and units from it). */
const cachedSheet = (queryClient: QueryClient, warbandId = 9) =>
  queryClient.getQueryData<{
    summary: { gold: number };
    heroes: { id: number; items?: unknown[]; updated_at?: string }[];
  }>(queryKeys.campaign.warbandSheet(7, warbandId));

beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.releasePointerCapture = vi.fn();
});

beforeEach(() => {
  vi.restoreAllMocks();
  toast.dismiss();
  fakeApi.reset();
  store.warband = storeWarband();
  fakeApi.on("GET /warbands/9/henchmen-groups/", [group]);
  fakeApi.on("GET /warbands/9/heroes/", [{ ...hero, items: undefined }]);
});

describe("AcquireItemDialog: one request per purchase (BUG-07, ECON-PERF-01)", () => {
  it("buys into the stash in one request after the two reads on open, and keeps the answer (ECON-PERF-01, BUG-07)", async () => {
    const user = setupUser();
    const stashRow = { id: 120, name: "Rope", cost: 5, quantity: 1 };
    fakeApi.on(PURCHASE, purchaseAnswer({ target_type: "stash", stash_item: stashRow }));
    const { onAcquire, onClosed, queryClient } = renderDialog({ presetUnitType: "stash" });

    await clickBuy(user);

    await waitFor(() => expect(onClosed).toHaveBeenCalledTimes(1));
    expect(fakeApi.calls()).toEqual([
      "GET /warbands/9/henchmen-groups/",
      "GET /warbands/9/heroes/",
      PURCHASE,
    ]);
    expect(fakeApi.bodyOf(PURCHASE)).toEqual({
      item_id: 120,
      quantity: 1,
      price: 5,
      availability_id: 7,
      is_buying: true,
      target_type: "stash",
    });
    expect(onAcquire).toHaveBeenCalledWith(rope, "stash", "", {
      isBuying: true,
      quantity: 1,
      unitPrice: 5,
      totalPrice: 5,
      reason: "",
      baseCost: 5,
    });
    // The answer's gold is the page's, with no summary read after.
    expect(cachedSheet(queryClient)?.summary.gold).toBe(495);
  });

  it("buys for a hero in one request and puts his new items in the cache, with no unit read or PATCH (ECON-PERF-01, BUG-07)", async () => {
    const user = setupUser();
    const items = [...hero.items, { ...rope, cost: 5 }];
    fakeApi.on(
      PURCHASE,
      purchaseAnswer({
        target_type: "hero",
        target_id: 11,
        items,
        updated_at: "2026-10-18T10:00:00Z",
      })
    );
    const { onAcquire, queryClient } = renderDialog({
      presetUnitType: "heroes",
      presetUnitId: 11,
      disableUnitSelection: true,
    });
    await openLoadsSent();
    fakeApi.clearRequests();

    await clickBuy(user);

    await waitFor(() => expect(onAcquire).toHaveBeenCalled());
    expect(fakeApi.requests()).toEqual([
      {
        method: "POST",
        path: "/warbands/9/purchases/",
        body: {
          item_id: 120,
          quantity: 1,
          price: 5,
          availability_id: 7,
          is_buying: true,
          target_type: "hero",
          target_id: 11,
        },
      },
    ]);
    expect(onAcquire).toHaveBeenCalledWith(rope, "heroes", "11", expect.anything());
    expect(cachedSheet(queryClient)?.heroes).toEqual([
      { id: 11, items, updated_at: "2026-10-18T10:00:00Z" },
    ]);
  });

  it("buys for a hired sword through the same request (ECON-PERF-01, BUG-07)", async () => {
    const user = setupUser();
    fakeApi.on(PURCHASE, purchaseAnswer({ target_type: "hired_sword", target_id: 31, items: [] }));
    renderDialog({ presetUnitType: "hiredswords", presetUnitId: 31, disableUnitSelection: true });

    await clickBuy(user);

    await waitFor(() => expect(fakeApi.countOf(PURCHASE)).toBe(1));
    expect(fakeApi.bodyOf(PURCHASE)).toMatchObject({ target_type: "hired_sword", target_id: 31 });
    expect(fakeApi.calls()).not.toContain("GET /warbands/9/hired-swords/31/");
    expect(fakeApi.calls()).not.toContain("PATCH /warbands/9/hired-swords/31/");
  });

  it("buys for a henchmen group with the group's id and no item list (ECON-PERF-01, BUG-07)", async () => {
    const user = setupUser();
    fakeApi.on(
      PURCHASE,
      purchaseAnswer({ target_type: "henchmen_group", target_id: 21, items: [] })
    );
    renderDialog({ presetUnitType: "henchmen", presetUnitId: 21, disableUnitSelection: true });

    await clickBuy(user);

    await waitFor(() => expect(fakeApi.countOf(PURCHASE)).toBe(1));
    expect(fakeApi.bodyOf(PURCHASE)).toMatchObject({
      target_type: "henchmen_group",
      target_id: 21,
    });
    expect(fakeApi.bodyOf(PURCHASE)).not.toHaveProperty("items");
  });

  it("buys several copies of a common item as one purchase, pricing one copy", async () => {
    const user = setupUser();
    fakeApi.on(PURCHASE, purchaseAnswer({ target_type: "stash" }));
    renderDialog({ presetUnitType: "stash" });
    await waitFor(() => expect(buyButton()).toBeEnabled());

    await chooseOption(user, selectNear("Qty"), "3");

    expect(screen.getByRole("button", { name: "Price: 5 x 3 = 15 gc" })).toBeInTheDocument();
    await clickBuy(user);
    await waitFor(() => expect(fakeApi.countOf(PURCHASE)).toBe(1));
    expect(fakeApi.bodyOf(PURCHASE)).toMatchObject({ quantity: 3, price: 5 });
  });

  it("gives an item without a charge or a gold check, with the copy's cost and the reason", async () => {
    const user = setupUser();
    fakeApi.on(PURCHASE, purchaseAnswer({ target_type: "stash", trade: null }));
    store.warband = storeWarband({
      gold: 0,
      resources: [{ id: 3, warband_id: 9, name: "Gold Crowns", amount: 0 }],
    });
    renderDialog({ presetUnitType: "stash" });

    await user.click(screen.getByRole("button", { name: "Give item" }));
    await user.type(screen.getByPlaceholderText("Optional reason"), "Found in the ruins");
    await clickBuy(user);

    await waitFor(() => expect(fakeApi.countOf(PURCHASE)).toBe(1));
    // With no catalogue cost, a given copy keeps the availability's price for resale.
    expect(fakeApi.bodyOf(PURCHASE)).toEqual({
      item_id: 120,
      quantity: 1,
      price: 5,
      availability_id: 7,
      is_buying: false,
      reason: "Found in the ruins",
      target_type: "stash",
    });
    expect(fakeApi.calls().filter((call) => !call.startsWith("GET"))).toEqual([PURCHASE]);
  });

  it("buys again at the campaign's current price: no price unless the player changes it (decision 11)", async () => {
    const user = setupUser();
    fakeApi.on(PURCHASE, purchaseAnswer({ target_type: "stash" }));
    renderDialog({ presetUnitType: "stash", variant: "buy-again" });

    await clickBuy(user);

    await waitFor(() => expect(fakeApi.countOf(PURCHASE)).toBe(1));
    expect(fakeApi.bodyOf(PURCHASE)).toEqual({
      item_id: 120,
      quantity: 1,
      is_buying: true,
      target_type: "stash",
    });
  });

  it("buys again at a price the player typed when he changes it", async () => {
    const user = setupUser();
    fakeApi.on(PURCHASE, purchaseAnswer({ target_type: "stash" }));
    renderDialog({ presetUnitType: "stash", variant: "buy-again" });
    await waitFor(() => expect(buyButton()).toBeEnabled());

    fireEvent.change(within(screen.getByRole("dialog")).getByDisplayValue("5"), {
      target: { value: "8" },
    });
    await clickBuy(user);

    await waitFor(() => expect(fakeApi.countOf(PURCHASE)).toBe(1));
    expect(fakeApi.bodyOf(PURCHASE)).toMatchObject({ price: 8 });
  });

  it("shows the server's warnings as toasts: the purchase went ahead", async () => {
    const user = setupUser();
    fakeApi.on(
      PURCHASE,
      purchaseAnswer({
        target_type: "stash",
        warnings: [
          {
            code: "trading_action_spent",
            message: "Ana already used his trading action this round.",
          },
        ],
      })
    );
    const { onClosed } = renderDialog({ presetUnitType: "stash" });

    await clickBuy(user);

    expect(
      await screen.findByText("Ana already used his trading action this round.")
    ).toBeInTheDocument();
    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it("queues a purchase without any request in roster edit mode (deferred commit)", async () => {
    const user = setupUser();
    const { onAcquire, onClosed } = renderDialog({
      presetUnitType: "heroes",
      presetUnitId: 11,
      disableUnitSelection: true,
      variant: "unit-edit",
      deferCommit: true,
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

describe("AcquireItemDialog: gold (decision 2)", () => {
  it("asks before spending more than the warband has, then buys (decision 2)", async () => {
    const user = setupUser();
    store.warband = storeWarband({ gold: 4 });
    fakeApi.on(PURCHASE, purchaseAnswer({ target_type: "stash", summary: { gold: -1 } }));
    const { onClosed } = renderDialog({ presetUnitType: "stash" });

    expect(await screen.findByText("This leaves the warband at -1 gc.")).toBeInTheDocument();
    await clickBuy(user);
    expect(fakeApi.countOf(PURCHASE)).toBe(0);
    expect(
      screen.getByText("This leaves the warband at -1 gc. Buy it anyway?")
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Buy anyway" }));

    await waitFor(() => expect(onClosed).toHaveBeenCalledTimes(1));
    expect(fakeApi.countOf(PURCHASE)).toBe(1);
  });

  it("buys nothing when the overspend isn't confirmed", async () => {
    const user = setupUser();
    store.warband = storeWarband({ gold: 4 });
    renderDialog({ presetUnitType: "stash" });

    await clickBuy(user);
    await user.click(screen.getByRole("button", { name: "Go Back" }));

    expect(screen.getByRole("dialog", { name: "Acquire item" })).toBeInTheDocument();
    expect(fakeApi.countOf(PURCHASE)).toBe(0);
  });

  it("counts the gold already reserved by queued purchases", async () => {
    renderDialog({ presetUnitType: "stash", reservedGold: 497 });

    expect(await screen.findByText("This leaves the warband at -2 gc.")).toBeInTheDocument();
    expect(buyButton()).toBeEnabled();
  });

  it("reads gold from the sheet's summary, so a group's recruits count and no ledger is loaded (BUG-37)", async () => {
    const user = setupUser();
    // The server's gold (the sheet's summary) is 200 - 75 - 75 = 50; the ledger isn't read.
    store.warband = storeWarband({ gold: 50 });
    fakeApi.on(PURCHASE, purchaseAnswer({ target_type: "stash" }));
    renderDialog({
      presetUnitType: "stash",
      item: { ...rope, availabilities: [{ id: 7, cost: 120, rarity: 2, restrictions: [] }] },
    });

    expect(await screen.findByText("This leaves the warband at -70 gc.")).toBeVisible();
    fireEvent.change(within(screen.getByRole("dialog")).getByDisplayValue("120"), {
      target: { value: "40" },
    });
    expect(screen.queryByText(/This leaves the warband/)).not.toBeInTheDocument();

    await clickBuy(user);
    await waitFor(() => expect(fakeApi.countOf(PURCHASE)).toBe(1));
    expect(fakeApi.bodyOf(PURCHASE)).toMatchObject({ price: 40 });
    expect(fakeApi.countOf("GET /warbands/9/trades/")).toBe(0);
  });

  it("ignores a Gold Crowns resource: gold is the summary's (BUG-37)", async () => {
    store.warband = storeWarband({
      gold: 500,
      resources: [{ id: 3, warband_id: 9, name: "Gold Crowns", amount: 0 }],
    });
    renderDialog({ presetUnitType: "stash" });

    await waitFor(() => expect(buyButton()).toBeEnabled());
    expect(screen.queryByText(/This leaves the warband/)).not.toBeInTheDocument();
    expect(fakeApi.countOf("GET /warbands/9/trades/")).toBe(0);
  });

  it("buys for the warband on screen without a warband of your own (BUG-107)", async () => {
    const user = setupUser();
    store.warband = null;
    fakeApi.on(PURCHASE, purchaseAnswer({ target_type: "stash" }));
    const { onClosed } = renderDialog({ presetUnitType: "stash" }, { warbandId: 9, gold: 500 });

    await clickBuy(user);

    await waitFor(() => expect(onClosed).toHaveBeenCalledTimes(1));
    expect(fakeApi.calls().filter((call) => !call.startsWith("GET"))).toEqual([PURCHASE]);
  });

  it("gives to the warband on screen without a warband of your own (BUG-107)", async () => {
    const user = setupUser();
    store.warband = null;
    fakeApi.on(PURCHASE, purchaseAnswer({ target_type: "stash", trade: null }));
    const { onClosed } = renderDialog({ presetUnitType: "stash" }, { warbandId: 9, gold: 0 });

    await user.click(screen.getByRole("button", { name: "Give item" }));
    await clickBuy(user);

    await waitFor(() => expect(onClosed).toHaveBeenCalledTimes(1));
    expect(fakeApi.bodyOf(PURCHASE)).toMatchObject({ is_buying: false });
  });

  it("charges the warband on screen with its own gold, not yours (BUG-107)", async () => {
    // Your own warband (9, the app store's) has 500 gc; warband 12 on screen has 4.
    renderDialog({ presetUnitType: "stash" }, { warbandId: 12, gold: 4 });

    expect(await screen.findByText("This leaves the warband at -1 gc.")).toBeVisible();
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
  it("shows a refused purchase in the dialog, keeps it open and changes nothing (BUG-07)", async () => {
    const user = setupUser();
    fakeApi.fail(PURCHASE, new Error("Target not found"));
    const { onAcquire, onClosed, queryClient } = renderDialog({
      presetUnitType: "heroes",
      presetUnitId: 11,
      disableUnitSelection: true,
    });

    await clickBuy(user);

    expect(await screen.findByText("Target not found")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onClosed).not.toHaveBeenCalled();
    expect(onAcquire).not.toHaveBeenCalled();
    expect(fakeApi.calls().filter((call) => !call.startsWith("GET"))).toEqual([PURCHASE]);
    expect(cachedSheet(queryClient)?.summary.gold).toBe(500);
  });

  it("closes as a success only once the purchase is saved: no separate charge can fail (BUG-07)", async () => {
    const user = setupUser();
    fakeApi.fail(
      PURCHASE,
      new ApiError("No price is known for this item; send one.", 400, {
        detail: "No price is known for this item; send one.",
        code: "invalid",
      })
    );
    const { onClosed } = renderDialog({ presetUnitType: "stash" });

    await clickBuy(user);

    expect(await screen.findByText("No price is known for this item; send one.")).toBeVisible();
    expect(onClosed).not.toHaveBeenCalled();
    expect(fakeApi.countOf("POST /warbands/9/trades/")).toBe(0);
    expect(fakeApi.countOf("POST /warbands/9/logs/")).toBe(0);
  });

  it("sends no item list for the unit, so a copy moved off him in another tab stays moved (BUG-07)", async () => {
    const user = setupUser();
    fakeApi.on(PURCHASE, purchaseAnswer({ target_type: "hero", target_id: 11, items: [] }));
    renderDialog({ presetUnitType: "heroes", presetUnitId: 11, disableUnitSelection: true });

    await clickBuy(user);

    await waitFor(() => expect(fakeApi.countOf(PURCHASE)).toBe(1));
    expect(fakeApi.calls()).not.toContain("GET /warbands/9/heroes/11/");
    expect(fakeApi.calls()).not.toContain("PATCH /warbands/9/heroes/11/");
    expect(fakeApi.bodyOf(PURCHASE)).not.toHaveProperty("items");
  });
});

describe("AcquireItemDialog: rare items", () => {
  it("charges one copy of a rare item, though quantity 3 was picked before switching to it (BUG-70)", async () => {
    const user = setupUser();
    fakeApi.on(PURCHASE, purchaseAnswer({ target_type: "stash" }));
    renderDialog({ item: luckyCharm, presetUnitType: "stash" });
    await waitFor(() => expect(buyButton()).toBeEnabled());

    await chooseOption(user, selectNear("Qty"), "3");
    expect(screen.getByRole("button", { name: "Price: 20 x 3 = 60 gc" })).toBeInTheDocument();
    await chooseOption(user, selectNear("Availability:"), /Rarity 9/);

    // One copy everywhere: the summary, the price section and the purchase.
    expect(screen.getByRole("button", { name: "Price: 40 gc" })).toBeInTheDocument();
    expect(screen.getByText("Final price")).toBeInTheDocument();
    expect(screen.queryByText("Unit price")).not.toBeInTheDocument();
    expect(screen.queryByText("120 gc")).not.toBeInTheDocument();

    await clickBuy(user);

    await waitFor(() => expect(fakeApi.countOf(PURCHASE)).toBe(1));
    expect(fakeApi.bodyOf(PURCHASE)).toMatchObject({
      item_id: 55,
      quantity: 1,
      price: 40,
      availability_id: 2,
    });
  });

  it("saves the searcher's roll with the purchase, and shows a failed roll's warning (decision 9)", async () => {
    const user = setupUser();
    fakeApi.on(
      PURCHASE,
      purchaseAnswer({
        target_type: "stash",
        warnings: [
          {
            code: "rarity_roll_failed",
            message: "Aldric the Bold's rarity roll for Lucky Charm failed.",
            hero_id: 11,
          },
        ],
      })
    );
    const { onClosed } = renderDialog({ item: luckyCharm, presetUnitType: "stash" });
    await openLoadsSent();
    await chooseOption(user, selectNear("Availability:"), /Rarity 9/);
    await chooseOption(user, selectNear("Searching hero"), "Aldric the Bold");

    await user.click(screen.getByRole("button", { name: "2d6" }));
    expect(await screen.findByText(/Rolled 7/)).toBeInTheDocument();
    // The roll is kept for the purchase: nothing is written yet.
    expect(fakeApi.calls().filter((call) => !call.startsWith("GET"))).toEqual([]);
    await clickBuy(user);

    await waitFor(() => expect(onClosed).toHaveBeenCalledTimes(1));
    expect(fakeApi.bodyOf(PURCHASE)).toMatchObject({
      price: 40,
      rarity_roll: { hero_id: 11, roll: 7, modifier: 0, rarity: "9", success: false },
    });
    expect(
      await screen.findByText("Aldric the Bold's rarity roll for Lucky Charm failed.")
    ).toBeInTheDocument();
    // Saved once, with the purchase; no log from the browser.
    expect(fakeApi.calls().filter((call) => !call.startsWith("GET"))).toEqual([PURCHASE]);
  });

  it("saves a search that ended without a purchase when the dialog closes (decision 9)", async () => {
    const user = setupUser();
    fakeApi.on("POST /warbands/9/rarity-rolls/", {
      hero_id: 11,
      trading_action: false,
      warnings: [],
    });
    const { onClosed } = renderDialog({ item: luckyCharm, presetUnitType: "stash" });
    await openLoadsSent();
    await chooseOption(user, selectNear("Availability:"), /Rarity 9/);
    await chooseOption(user, selectNear("Searching hero"), "Aldric the Bold");
    await user.click(screen.getByRole("button", { name: "2d6" }));
    await screen.findByText(/Rolled 7/);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClosed).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(fakeApi.countOf("POST /warbands/9/rarity-rolls/")).toBe(1));
    expect(fakeApi.bodyOf("POST /warbands/9/rarity-rolls/")).toEqual({
      hero_id: 11,
      roll: 7,
      modifier: 0,
      rarity: "9",
      success: false,
      item_id: 55,
    });
    expect(fakeApi.calls()).not.toContain("POST /warbands/9/logs/");
    expect(fakeApi.calls()).not.toContain("PATCH /warbands/9/heroes/11/");
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
