/**
 * `useWarbandTradeSession`: how a trade session is restored from `?trade=` (one read of the
 * request, BUG-113), what each realtime event triggers (ECON-PERF-02), and how closing and expiry
 * behave (BUG-69). The real app store and router run; the trade channel is replaced by a hook
 * that hands the test its handler, and `apiRequest` is answered by a fake server.
 */
import { act, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useWarbandTradeSession } from "./useWarbandTradeSession";
import { AppToaster } from "@/components/ui/toaster";
import { AppStoreProvider, useAppStore } from "@/stores/app-store";
import { queryKeys } from "@/lib/query-keys";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import type { TradeEventMessage } from "@/lib/realtime";
import type { TradeRequest } from "@/features/warbands/types/trade-request-types";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: 1, email: "ann@example.com" } }),
}));

/** The trade channel: the request id it listens to, and the handler of the last render. */
const channel = vi.hoisted(() => ({
  requestId: null as string | null,
  handler: (_message: TradeEventMessage) => undefined as void,
}));
vi.mock("@/lib/realtime", () => ({
  useTradeEvents: (requestId: string | null, handler: (message: TradeEventMessage) => void) => {
    channel.requestId = requestId;
    channel.handler = handler;
  },
}));

const TRADE = "7b5c0d2e-trade";
const GET_TRADE = `GET /campaigns/7/trade-requests/${TRADE}/`;

const inFiveMinutes = () => new Date(Date.now() + 5 * 60_000).toISOString();

const request = (overrides: Partial<TradeRequest> = {}): TradeRequest => ({
  id: TRADE,
  campaign_id: 7,
  status: "accepted",
  created_at: new Date().toISOString(),
  expires_at: inFiveMinutes(),
  from_offer: { trader_id: null, gold: 0, items: [] },
  to_offer: { trader_id: null, gold: 0, items: [] },
  from_accepted: false,
  to_accepted: false,
  from_user: { id: 1, label: "Ann" },
  to_user: { id: 2, label: "Bob" },
  from_warband: { id: 9, name: "The Black Wolves" },
  to_warband: { id: 12, name: "Reikland Rats" },
  channel: `private-trade-${TRADE}`,
  ...overrides,
});

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

/** The warband page's use of the hook, with what it shows written out. */
function WarbandPageTrade({ loadWarchestItems }: { loadWarchestItems: () => void }) {
  const trade = useWarbandTradeSession({
    campaignId: 7,
    hasCampaignId: true,
    warbandId: 9,
    loadWarchestItems,
  });
  const { tradeSession } = useAppStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  return (
    <>
      <SheetObserver />
      <p>Session: {tradeSession ? `${tradeSession.status} (${tradeSession.role})` : "none"}</p>
      <p>
        Bob offers: {trade.tradeRequest ? `${trade.tradeRequest.to_offer?.gold} gc` : "nothing"}
      </p>
      <p>URL: {location.search || "(none)"}</p>
      <button
        type="button"
        onClick={() => {
          const next = new URLSearchParams(searchParams);
          next.set("tab", "logs");
          setSearchParams(next);
        }}
      >
        Logs tab
      </button>
      <button type="button" onClick={trade.handleTradeSessionClose}>
        Close trade
      </button>
      <button type="button" onClick={() => void trade.handleTradeRequestCreated(2)}>
        Trade with Bob
      </button>
    </>
  );
}

const renderPage = (url = `/campaigns/7/warband?trade=${TRADE}`) => {
  const loadWarchestItems = vi.fn();
  renderWithQueryClient(
    <AppStoreProvider>
      <AppToaster />
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route
            path="/campaigns/:id/warband"
            element={<WarbandPageTrade loadWarchestItems={loadWarchestItems} />}
          />
        </Routes>
      </MemoryRouter>
    </AppStoreProvider>
  );
  return { loadWarchestItems };
};

/** Opens the page on an accepted trade (one read of the request). */
const openOnTrade = async () => {
  const page = renderPage();
  await screen.findByText("Session: active (initiator)");
  return page;
};

const deliver = (message: TradeEventMessage) => act(() => channel.handler(message));

beforeEach(() => {
  fakeApi.reset();
  channel.requestId = null;
  fakeApi.on(GET_TRADE, () => request());
  fakeApi.on("GET /warbands/9/summary/", { gold: 120 });
});

describe("useWarbandTradeSession: opening a trade", () => {
  it("restores an accepted trade from ?trade=, reading the request once, and loads the warchest (BUG-113)", async () => {
    const { loadWarchestItems } = await openOnTrade();

    expect(fakeApi.calls()).toEqual([GET_TRADE]);
    expect(loadWarchestItems).toHaveBeenCalledTimes(1);
    expect(channel.requestId).toBe(TRADE);
    expect(screen.getByText("Bob offers: 0 gc")).toBeInTheDocument();
  });

  it("reads nothing more on a ?tab= change: the request is read once per trade (ECON-PERF-02)", async () => {
    const user = setupUser();
    await openOnTrade();

    await user.click(screen.getByRole("button", { name: "Logs tab" }));

    expect(screen.getByText(`URL: ?trade=${TRADE}&tab=logs`)).toBeInTheDocument();
    expect(fakeApi.calls()).toEqual([GET_TRADE]);
  });

  it("creates a request: POSTs the partner, opens a pending session from the answer and puts ?trade= in the URL", async () => {
    const user = setupUser();
    fakeApi.on("POST /campaigns/7/trade-requests/", request({ status: "pending" }));
    fakeApi.on(GET_TRADE, () => request({ status: "pending" }));
    renderPage("/campaigns/7/warband");

    await user.click(screen.getByRole("button", { name: "Trade with Bob" }));

    expect(await screen.findByText("Session: pending (initiator)")).toBeInTheDocument();
    expect(screen.getByText(`URL: ?trade=${TRADE}`)).toBeInTheDocument();
    // The answer is the request: it isn't read back.
    expect(fakeApi.requests()).toEqual([
      { method: "POST", path: "/campaigns/7/trade-requests/", body: { target_user_id: 2 } },
    ]);
  });

  it.each(["declined", "expired", "completed"] as const)(
    "drops ?trade= for a %s request after one read",
    async (status) => {
      fakeApi.on(GET_TRADE, () => request({ status }));
      renderPage();

      expect(await screen.findByText("URL: (none)")).toBeInTheDocument();
      expect(screen.getByText("Session: none")).toBeInTheDocument();
      expect(fakeApi.calls()).toEqual([GET_TRADE]);
    }
  );
});

describe("useWarbandTradeSession: realtime events", () => {
  it("takes offer and lock events from their payload, reading no summary since no gold moved (ECON-PERF-02)", async () => {
    await openOnTrade();
    fakeApi.clearRequests();

    deliver({
      type: "trade.offer_updated",
      payload: request({ to_offer: { gold: 15, items: [] } }),
    });
    expect(screen.getByText("Bob offers: 15 gc")).toBeInTheDocument();
    deliver({
      type: "trade.locked",
      payload: request({ to_offer: { gold: 20, items: [] }, to_accepted: true }),
    });
    expect(screen.getByText("Bob offers: 20 gc")).toBeInTheDocument();

    // A summary read would have gone out at once (the page's sheet is observed).
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fakeApi.calls()).toEqual([]);
  });

  it("makes a pending session active when the partner accepts", async () => {
    fakeApi.on(GET_TRADE, () => request({ status: "pending" }));
    renderPage();
    await screen.findByText("Session: pending (initiator)");

    deliver({ type: "trade.accepted", payload: request() });

    expect(screen.getByText("Session: active (initiator)")).toBeInTheDocument();
  });

  it("ends the session on completion, re-reading the summary and the warchest", async () => {
    const { loadWarchestItems } = await openOnTrade();
    fakeApi.clearRequests();

    deliver({ type: "trade.completed", payload: request({ status: "completed" }) });

    expect(screen.getByText("Session: none")).toBeInTheDocument();
    expect(screen.getByText("URL: (none)")).toBeInTheDocument();
    await waitFor(() => expect(fakeApi.countOf("GET /warbands/9/summary/")).toBe(1));
    expect(loadWarchestItems).toHaveBeenCalledTimes(2);
  });

  it("ends the session when the partner cancels", async () => {
    await openOnTrade();

    deliver({ type: "trade.closed" });

    expect(screen.getByText("Session: none")).toBeInTheDocument();
    expect(screen.getByText("URL: (none)")).toBeInTheDocument();
  });
});

describe("useWarbandTradeSession: closing and expiry", () => {
  it("drops the session at once and says so when the close request fails (ECON-UX-05)", async () => {
    const user = setupUser();
    fakeApi.fail(`POST /campaigns/7/trade-requests/${TRADE}/close/`, new Error("Server error"));
    await openOnTrade();
    fakeApi.clearRequests();

    await user.click(screen.getByRole("button", { name: "Close trade" }));

    expect(screen.getByText("Session: none")).toBeInTheDocument();
    expect(screen.getByText("URL: (none)")).toBeInTheDocument();
    await waitFor(() => expect(fakeApi.countOf("GET /warbands/9/summary/")).toBe(1));
    expect(fakeApi.calls()).toEqual([
      `POST /campaigns/7/trade-requests/${TRADE}/close/`,
      "GET /warbands/9/summary/",
    ]);
    expect(await screen.findByText("Couldn't cancel the trade with Bob.")).toBeInTheDocument();
    expect(screen.getByText("Server error")).toBeInTheDocument();
  });

  it("says so when the trade in ?trade= can't be read (ECON-UX-05)", async () => {
    fakeApi.fail(GET_TRADE, new Error("Trade request not found."));
    renderPage();

    expect(await screen.findByText("Couldn't open the trade.")).toBeInTheDocument();
    expect(screen.getByText("Trade request not found.")).toBeInTheDocument();
    expect(screen.getByText("Session: none")).toBeInTheDocument();
  });

  it("stops listening once the request expires but keeps the session open (BUG-69, pinned; flips in PR A)", async () => {
    fakeApi.on(GET_TRADE, () => request({ expires_at: new Date(Date.now() - 1000).toISOString() }));
    renderPage();

    expect(await screen.findByText("Session: active (initiator)")).toBeInTheDocument();
    await waitFor(() => expect(channel.requestId).toBeNull());
    expect(screen.getByText(`URL: ?trade=${TRADE}`)).toBeInTheDocument();
  });
});
