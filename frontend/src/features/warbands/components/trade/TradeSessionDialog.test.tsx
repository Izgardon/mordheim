/**
 * Characterisation of the trade dialog before pass 2's fixes: what it shows, the offer autosave
 * (300 ms), what Accept and Unaccept send, and how a server copy of your offer replaces your
 * draft. The page's handling is reproduced: every answer and partner event becomes the new
 * `tradeRequest`. `apiRequest` is answered by a fake server.
 */
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
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

/** The page's sheet query, so a write's summary refresh has an observer to update. */
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
  partner.send = setTradeRequest;
  return (
    <>
      <SheetObserver />
      <TradeSessionDialog
        session={{ ...session, status: sessionStatus }}
        tradeRequest={tradeRequest}
        heroes={[aldric, gunther]}
        warbandId={9}
        warchestItems={stash}
        availableGold={120}
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

  it("POSTs the whole offer 300 ms after the last change, gold capped at what you have (ECON-PERF-02, pinned; flips in PR A)", async () => {
    fakeApi.on(OFFER, (body: unknown) => withMyOffer(body as TradeOffer));
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Sword 2/2" }));
    fireEvent.click(screen.getByRole("button", { name: "Sword 1/2" }));
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "500" } });
    expect(within(myOffer()).getByText("Total value: 140 gc")).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(299));
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

  it("drops a click made during the 300 ms wait when the partner's change arrives (BUG-42, pinned; flips in PR A)", async () => {
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Rope 1/1" }));
    expect(within(myOffer()).getByRole("button", { name: "Rope x1" })).toBeInTheDocument();
    // Bob adds gold: the event carries the server's copy of Ann's offer, still empty.
    act(() => partner.send(request({ to_offer: { ...emptyOffer, gold: 15 } })));
    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(within(myOffer()).getByText("No items added.")).toBeInTheDocument();
    expect(fakeApi.calls()).toEqual([]);
  });

  it("drops a click made while the save is in flight when the save's answer arrives (BUG-42, pinned; flips in PR A)", async () => {
    let answer!: (value: TradeRequest) => void;
    fakeApi.on(OFFER, () => new Promise<TradeRequest>((resolve) => (answer = resolve)));
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Sword 2/2" }));
    await act(() => vi.advanceTimersByTimeAsync(300));
    fireEvent.click(screen.getByRole("button", { name: "Sword 1/2" }));
    expect(within(myOffer()).getByRole("button", { name: "Sword x2" })).toBeInTheDocument();
    await act(async () => {
      answer(withMyOffer({ gold: 0, items: [{ id: 101, name: "Sword", quantity: 1, cost: 10 }] }));
    });
    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(within(myOffer()).getByRole("button", { name: "Sword x1" })).toBeInTheDocument();
    expect(fakeApi.countOf(OFFER)).toBe(1);
  });
});

describe("TradeSessionDialog: Accept and Unaccept", () => {
  it("locks with no record of the offer it showed, then re-reads the summary (BUG-35, ECON-PERF-02, pinned; flips in PR A)", async () => {
    const user = setupUser();
    fakeApi.on(LOCK, request({ from_accepted: true }));
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Accept" }));

    await waitFor(() => expect(fakeApi.countOf("GET /warbands/9/summary/")).toBe(1));
    expect(fakeApi.requests()).toEqual([
      { method: "POST", path: `/campaigns/7/trade-requests/${TRADE}/lock/` },
      { method: "GET", path: "/warbands/9/summary/" },
    ]);
    expect(screen.getByText("Waiting for Bob...")).toBeInTheDocument();
    expect(within(myOffer()).getByText("Accepted")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rope 1/1" })).toBeDisabled();
  });

  it("unlocks, then re-reads the summary again (ECON-PERF-02, pinned; flips in PR A)", async () => {
    const user = setupUser();
    fakeApi.on(UNLOCK, request());
    renderDialog(request({ from_accepted: true }));

    await user.click(screen.getByRole("button", { name: "Unaccept" }));

    await waitFor(() => expect(fakeApi.countOf("GET /warbands/9/summary/")).toBe(1));
    expect(fakeApi.calls()).toEqual([UNLOCK, "GET /warbands/9/summary/"]);
    expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument();
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
