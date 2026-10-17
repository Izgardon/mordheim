/**
 * The trade dialog: what it shows, the offer autosave (600 ms after the last edit, one save at a
 * time), what Accept and Unaccept send, and when the server's copy of your offer replaces your
 * draft (only while nothing local is unsent, BUG-42). The page's handling is reproduced: every
 * answer and partner event becomes the new `tradeRequest`. `apiRequest` is answered by a fake
 * server.
 */
import { act, fireEvent, screen, within } from "@testing-library/react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import TradeSessionDialog from "./TradeSessionDialog";
import { queryKeys } from "@/lib/query-keys";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";
import { makeStashItem, makeVeteranHero } from "@/test/warband-fixtures";

import type {
  TradeOffer,
  TradeRequest,
  TradeSession,
} from "@/features/warbands/types/trade-request-types";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const TRADE = "7b5c0d2e-trade";
const OFFER = `POST /campaigns/7/trade-requests/${TRADE}/offer/`;
const LOCK = `POST /campaigns/7/trade-requests/${TRADE}/lock/`;
const UNLOCK = `POST /campaigns/7/trade-requests/${TRADE}/unlock/`;

const session: TradeSession = {
  requestId: TRADE,
  campaignId: 7,
  partner: { id: 2, label: "Bob" },
  fromWarband: { id: 9, name: "The Black Wolves" },
  toWarband: { id: 12, name: "Reikland Rats" },
  status: "active",
  expiresAt: "2026-10-17T12:05:00Z",
  role: "initiator",
};

const emptyOffer: TradeOffer = { trader_id: null, trader_name: null, gold: 0, items: [] };

const request = (overrides: Partial<TradeRequest> = {}): TradeRequest => ({
  id: TRADE,
  campaign_id: 7,
  status: "accepted",
  created_at: "2026-10-17T12:00:00Z",
  expires_at: "2026-10-17T12:05:00Z",
  from_offer: emptyOffer,
  to_offer: emptyOffer,
  from_accepted: false,
  to_accepted: false,
  from_user: { id: 1, label: "Ann" },
  to_user: { id: 2, label: "Bob" },
  from_warband: { id: 9, name: "The Black Wolves" },
  to_warband: { id: 12, name: "Reikland Rats" },
  channel: `private-trade-${TRADE}`,
  ...overrides,
});

const aldric = makeVeteranHero();
const gunther = makeVeteranHero({ id: 12, name: "Gunther", trading_action: false });
const stash = [
  makeStashItem({ id: 101, name: "Sword", cost: 10, quantity: 2 }),
  makeStashItem({ id: 120, name: "Rope", cost: 5, quantity: 1 }),
];

/** The page's sheet query: a summary refresh would show up as a GET of the summary. */
function SheetObserver() {
  useQuery({
    queryKey: queryKeys.campaign.warbandSheet(7, 9),
    queryFn: () => new Promise<never>(() => undefined),
    initialData: { summary: { gold: 120 } },
    staleTime: Infinity,
  });
  return null;
}

/** Lets a test deliver a new copy of the request, as a partner's realtime event does. */
const partner = { send: (_next: TradeRequest) => undefined as void };

/** Lets a test change the page's gold, as a summary refresh does. */
const page = { setGold: (_gold: number) => undefined as void };

/** The dialog as the page holds it: answers and events replace `tradeRequest`. */
function TradeHarness({
  initial,
  sessionStatus = "active",
  onClose,
}: {
  initial: TradeRequest;
  sessionStatus?: TradeSession["status"];
  onClose: () => void;
}) {
  const [tradeRequest, setTradeRequest] = useState<TradeRequest | null>(initial);
  const [gold, setGold] = useState(120);
  partner.send = setTradeRequest;
  page.setGold = setGold;
  return (
    <>
      <SheetObserver />
      <TradeSessionDialog
        session={{ ...session, status: sessionStatus }}
        tradeRequest={tradeRequest}
        heroes={[aldric, gunther]}
        warchestItems={stash}
        availableGold={gold}
        onRequestUpdated={setTradeRequest}
        onClose={onClose}
      />
    </>
  );
}

const renderDialog = (
  initial: TradeRequest = request(),
  sessionStatus: TradeSession["status"] = "active"
) => {
  const onClose = vi.fn();
  return {
    ...renderWithQueryClient(
      <TradeHarness initial={initial} sessionStatus={sessionStatus} onClose={onClose} />
    ),
    onClose,
  };
};

/** "Your offer" and the partner's offer panels. */
const myOffer = () => screen.getByText("Your offer").closest(".space-y-2") as HTMLElement;
const theirOffer = () => screen.getByText("Bob's offer").closest(".space-y-2") as HTMLElement;

/** The server's copy of the request after an offer of `items` from Ann. */
const withMyOffer = (offer: TradeOffer) => request({ from_offer: offer });

beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.releasePointerCapture = vi.fn();
});

beforeEach(() => {
  fakeApi.reset();
  fakeApi.on("GET /warbands/9/summary/", { gold: 120 });
});

describe("TradeSessionDialog: what it shows", () => {
  it("stays closed while the request is pending", () => {
    renderDialog(request({ status: "pending" }), "pending");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("lists your warchest, your gold and both offers, valuing items at the cost it was sent", () => {
    renderDialog(
      request({
        to_offer: { gold: 10, items: [{ id: 300, name: "Wyrdstone", quantity: 2, cost: 0 }] },
      })
    );

    const dialog = screen.getByRole("dialog", { name: "Trading with Bob" });
    expect(dialog).toHaveAccessibleDescription(
      "Offer stash items and gold; the trade completes when you both accept."
    );
    expect(within(dialog).getByText("Available: 120 gc")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Sword 2/2" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Rope 1/1" })).toBeInTheDocument();
    expect(within(myOffer()).getByText("No items added.")).toBeInTheDocument();
    // The server sends offer items at cost 0 (BUG-40), so the value counts gold only.
    expect(within(theirOffer()).getByText("Total value: 10 gc")).toBeInTheDocument();
    expect(within(theirOffer()).getByText("Wyrdstone")).toBeInTheDocument();
  });
});

describe("TradeSessionDialog: offer autosave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("POSTs the whole offer once, 600 ms after the last change, gold capped at what you have (ECON-PERF-02)", async () => {
    fakeApi.on(OFFER, (body: unknown) => withMyOffer(body as TradeOffer));
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Sword 2/2" }));
    fireEvent.click(screen.getByRole("button", { name: "Sword 1/2" }));
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "500" } });
    expect(within(myOffer()).getByText("Total value: 140 gc")).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(599));
    expect(fakeApi.calls()).toEqual([]);

    await act(() => vi.advanceTimersByTimeAsync(1));

    expect(fakeApi.requests()).toEqual([
      {
        method: "POST",
        path: `/campaigns/7/trade-requests/${TRADE}/offer/`,
        body: { trader_id: null, gold: 120, items: [{ id: 101, name: "Sword", quantity: 2 }] },
      },
    ]);
  });

  it("keeps a click made during the wait when the partner's change arrives, then saves it (BUG-42)", async () => {
    // The server keeps Bob's 15 gc in every later copy.
    const bobsOffer = { ...emptyOffer, gold: 15 };
    fakeApi.on(OFFER, (body: unknown) =>
      request({ from_offer: body as TradeOffer, to_offer: bobsOffer })
    );
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Rope 1/1" }));
    expect(within(myOffer()).getByRole("button", { name: "Rope x1" })).toBeInTheDocument();
    // Bob adds gold: the event carries the server's copy of Ann's offer, still empty.
    act(() => partner.send(request({ to_offer: bobsOffer })));
    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(within(myOffer()).getByRole("button", { name: "Rope x1" })).toBeInTheDocument();
    expect(within(theirOffer()).getByText("15 gc")).toBeInTheDocument();
    expect(fakeApi.bodyOf(OFFER)).toEqual({
      trader_id: null,
      gold: 0,
      items: [{ id: 120, name: "Rope", quantity: 1 }],
    });
  });

  it("keeps a click made while the save is in flight when the save's answer arrives, then saves it too (BUG-42)", async () => {
    const answers: ((value: TradeRequest) => void)[] = [];
    fakeApi.on(OFFER, () => new Promise<TradeRequest>((resolve) => answers.push(resolve)));
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Sword 2/2" }));
    await act(() => vi.advanceTimersByTimeAsync(600));
    fireEvent.click(screen.getByRole("button", { name: "Sword 1/2" }));
    expect(within(myOffer()).getByRole("button", { name: "Sword x2" })).toBeInTheDocument();
    await act(async () => {
      answers[0](
        withMyOffer({ gold: 0, items: [{ id: 101, name: "Sword", quantity: 1, cost: 10 }] })
      );
    });
    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(within(myOffer()).getByRole("button", { name: "Sword x2" })).toBeInTheDocument();
    // One save at a time: the second goes out after the first answered, with the newer draft.
    expect(fakeApi.countOf(OFFER)).toBe(2);
    expect(fakeApi.bodyOf(OFFER)).toMatchObject({ items: [{ id: 101, quantity: 2 }] });
  });

  it("keeps an unsent click when the page's gold changes (BUG-42)", async () => {
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Rope 1/1" }));
    act(() => page.setGold(100));

    expect(within(myOffer()).getByRole("button", { name: "Rope x1" })).toBeInTheDocument();
    expect(screen.getByText("Available: 100 gc")).toBeInTheDocument();
  });

  it("shows the server's copy of your offer when nothing local is unsent", async () => {
    renderDialog();

    act(() =>
      partner.send(withMyOffer({ gold: 5, items: [{ id: 101, name: "Sword", quantity: 1 }] }))
    );
    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(within(myOffer()).getByRole("button", { name: "Sword x1" })).toBeInTheDocument();
    expect(fakeApi.countOf(OFFER)).toBe(0);
  });

  it("keeps Accept off until your changes are saved, since it locks the server's copy (BUG-42)", async () => {
    let answer!: (value: TradeRequest) => void;
    fakeApi.on(OFFER, () => new Promise<TradeRequest>((resolve) => (answer = resolve)));
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Rope 1/1" }));
    expect(screen.getByRole("button", { name: "Accept" })).toBeDisabled();
    await act(() => vi.advanceTimersByTimeAsync(600));
    expect(screen.getByRole("button", { name: "Accept" })).toBeDisabled();
    await act(async () => {
      answer(withMyOffer({ gold: 0, items: [{ id: 120, name: "Rope", quantity: 1, cost: 5 }] }));
    });

    expect(screen.getByRole("button", { name: "Accept" })).toBeEnabled();
  });
});

describe("TradeSessionDialog: Accept and Unaccept", () => {
  it("locks with no record of the offer it showed (BUG-35, pinned; flips with the server's offer version) and reads no summary (ECON-PERF-02)", async () => {
    const user = setupUser();
    fakeApi.on(LOCK, request({ from_accepted: true }));
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Accept" }));

    expect(await screen.findByText("Waiting for Bob...")).toBeInTheDocument();
    expect(fakeApi.requests()).toEqual([
      { method: "POST", path: `/campaigns/7/trade-requests/${TRADE}/lock/` },
    ]);
    expect(within(myOffer()).getByText("Accepted")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rope 1/1" })).toBeDisabled();
  });

  it("unlocks with no summary read (ECON-PERF-02)", async () => {
    const user = setupUser();
    fakeApi.on(UNLOCK, request());
    renderDialog(request({ from_accepted: true }));

    await user.click(screen.getByRole("button", { name: "Unaccept" }));

    expect(await screen.findByRole("button", { name: "Accept" })).toBeInTheDocument();
    expect(fakeApi.calls()).toEqual([UNLOCK]);
  });

  it("shows the server's message when the lock is refused", async () => {
    const user = setupUser();
    fakeApi.fail(LOCK, new Error("Trader has already used his trading action."));
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Accept" }));

    expect(
      await screen.findByText("Trader has already used his trading action.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accept" })).toBeEnabled();
  });

  it("offers only heroes with their trading action as traders", async () => {
    const user = setupUser();
    renderDialog();

    act(() => screen.getByRole("combobox").focus());
    await user.keyboard("{Enter}");

    expect(screen.getByRole("option", { name: "Aldric the Bold" })).not.toHaveAttribute(
      "aria-disabled"
    );
    expect(screen.getByRole("option", { name: "Gunther (spent)" })).toHaveAttribute(
      "aria-disabled",
      "true"
    );
  });

  it("asks before Cancel ends the trade for both sides", async () => {
    const user = setupUser();
    const { onClose } = renderDialog();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(
      screen.getByText(
        "Are you sure you want to cancel this trade? Both sides will lose their offers."
      )
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel Trade" }));

    expect(onClose).toHaveBeenCalled();
  });
});
