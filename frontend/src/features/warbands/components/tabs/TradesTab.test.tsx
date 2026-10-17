/**
 * Characterisation of the Treasury tab (`TradesTab`) before pass 2: the ledger it loads, how
 * rows and group headers are signed and coloured, and what adding a manual entry sends.
 * `apiRequest` is answered by a fake server.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import TradesTab from "./TradesTab";
import { queryKeys } from "@/lib/query-keys";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { chooseOption, selectNear } from "@/test/select-option";
import { setupUser } from "@/test/user-event";

import type { Warband, WarbandTrade } from "@/features/warbands/types/warband-types";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const warband: Warband = {
  id: 9,
  name: "The Black Wolves",
  faction: "Mercenaries",
  campaign_id: 7,
  user_id: 1,
  created_at: "",
  updated_at: "",
};

const row = (overrides: Partial<WarbandTrade>): WarbandTrade => ({
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

const child = (id: number, action: string, description: string, price: number) => ({
  id,
  action,
  description,
  price,
  notes: "",
  created_at: "2026-10-02T10:00:00Z",
});

/** Newest first, as the server lists them. */
const ledger: WarbandTrade[] = [
  row({
    id: 4,
    action: "Group",
    description: "Recruited Black Knives (2)",
    price: 0,
    children: [child(5, "Recruited", "Blade One", -60), child(6, "Recruited", "Blade Two", -60)],
  }),
  row({ id: 3, action: "Bought", description: "Rope", price: 5 }),
  row({ id: 2, action: "Sold", description: "Sword", price: 5, notes: "Half price" }),
  row({ id: 1 }),
];

/** The ledger row holding `text`. */
const rowOf = (text: string) => {
  let node: HTMLElement | null = screen.getByText(text);
  while (node && !node.className.includes("border-b")) node = node.parentElement;
  return node as HTMLElement;
};

/** The page's sheet query, so a write's summary refresh has an observer to update. */
function SheetObserver() {
  useQuery({
    queryKey: queryKeys.campaign.warbandSheet(7, 9),
    queryFn: () => new Promise<never>(() => undefined),
    initialData: { summary: { gold: 435 } },
    staleTime: Infinity,
  });
  return null;
}

/** The tab as the page mounts it: only while Treasury is the active tab. */
function TreasuryTab({
  canEdit,
  onTradeCreated,
}: {
  canEdit: boolean;
  onTradeCreated: () => void;
}) {
  const [shown, setShown] = useState(true);
  return (
    <>
      <SheetObserver />
      <button type="button" onClick={() => setShown((value) => !value)}>
        Switch tab
      </button>
      {shown ? (
        <TradesTab warband={warband} canEdit={canEdit} onTradeCreated={onTradeCreated} />
      ) : null}
    </>
  );
}

const renderTab = (canEdit = true) => {
  const onTradeCreated = vi.fn();
  return {
    ...renderWithQueryClient(<TreasuryTab canEdit={canEdit} onTradeCreated={onTradeCreated} />),
    onTradeCreated,
  };
};

beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.releasePointerCapture = vi.fn();
});

beforeEach(() => {
  fakeApi.reset();
  fakeApi.on("GET /warbands/9/trades/", ledger);
});

describe("TradesTab: the ledger", () => {
  it("signs each row by its action: expenses negative, everything else positive", async () => {
    renderTab();

    expect(await screen.findByText("Rope")).toBeInTheDocument();
    expect(within(rowOf("Rope")).getByText("-5 gc")).toBeInTheDocument();
    expect(within(rowOf("Rope")).getByText("Bought")).toBeInTheDocument();
    expect(within(rowOf("Sword")).getByText("+5 gc")).toBeInTheDocument();
    expect(within(rowOf("Sword")).getByText("Half price")).toBeInTheDocument();
    expect(within(rowOf("Starting gold")).getByText("+500 gc")).toBeInTheDocument();
    expect(within(rowOf("Starting gold")).getByText("Starting Gold")).toBeInTheDocument();
    expect(fakeApi.calls()).toEqual(["GET /warbands/9/trades/"]);
  });

  it("shows a group of purchases as income: +120 gc on a green badge (BUG-38, pinned; flips in PR A)", async () => {
    const user = setupUser();
    renderTab();

    await screen.findByText("Recruited Black Knives (2)");
    const header = rowOf("Recruited Black Knives (2)");
    expect(within(header).getByText("+120 gc")).toBeInTheDocument();
    // The income style (the expense badge is red).
    expect(within(header).getByText("Group").className).toContain("emerald");

    await user.click(within(header).getByRole("button", { expanded: false }));

    expect(within(header).getAllByText("-60 gc")).toHaveLength(2);
    expect(within(header).getByText("Blade One")).toBeInTheDocument();
  });

  it("loads the whole ledger again every time the tab is shown (ECON-PERF-08)", async () => {
    const user = setupUser();
    renderTab();
    await screen.findByText("Rope");

    await user.click(screen.getByRole("button", { name: "Switch tab" }));
    await user.click(screen.getByRole("button", { name: "Switch tab" }));

    await screen.findByText("Rope");
    expect(fakeApi.calls()).toEqual(["GET /warbands/9/trades/", "GET /warbands/9/trades/"]);
  });

  it("shows the server's message when the ledger can't be loaded", async () => {
    fakeApi.fail("GET /warbands/9/trades/", new Error("Server error"));
    renderTab();

    expect(await screen.findByText("Server error")).toBeInTheDocument();
  });
});

describe("TradesTab: a manual entry", () => {
  it("POSTs the entry, puts it on top, re-reads the summary and hands it to the page's gold total", async () => {
    const user = setupUser();
    const created = row({ id: 7, action: "Buy", description: "Lantern", price: 10 });
    fakeApi.on("POST /warbands/9/trades/", created);
    fakeApi.on("GET /warbands/9/summary/", { gold: 425 });
    const { onTradeCreated } = renderTab();
    await screen.findByText("Rope");

    await user.click(screen.getByRole("button", { name: "Add Trade Entry" }));
    await chooseOption(user, selectNear("Action", document.body), "Buy");
    await user.type(screen.getByPlaceholderText("0"), "10");
    await user.type(screen.getByPlaceholderText("What was bought?"), "Lantern");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(fakeApi.countOf("GET /warbands/9/summary/")).toBe(1));
    expect(fakeApi.calls()).toEqual([
      "GET /warbands/9/trades/",
      "POST /warbands/9/trades/",
      "GET /warbands/9/summary/",
    ]);
    expect(fakeApi.bodyOf("POST /warbands/9/trades/")).toEqual({
      action: "Buy",
      description: "Lantern",
      price: 10,
      notes: "",
    });
    expect(onTradeCreated).toHaveBeenCalledWith(created);
    expect(screen.getAllByText(/^(Lantern|Recruited Black Knives \(2\))$/)[0]).toHaveTextContent(
      "Lantern"
    );
    expect(within(rowOf("Lantern")).getByText("-10 gc")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  });

  it("asks for an action, then a description, before sending anything", async () => {
    const user = setupUser();
    renderTab();
    await screen.findByText("Rope");

    await user.click(screen.getByRole("button", { name: "Add Trade Entry" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Action is required.")).toBeInTheDocument();

    await chooseOption(user, selectNear("Action", document.body), "Reward");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Description is required.")).toBeInTheDocument();
    expect(fakeApi.countOf("POST /warbands/9/trades/")).toBe(0);
  });

  it("keeps the form open with the server's message when the entry is refused", async () => {
    const user = setupUser();
    fakeApi.fail("POST /warbands/9/trades/", new Error("Price must be a number."));
    renderTab();
    await screen.findByText("Rope");

    await user.click(screen.getByRole("button", { name: "Add Trade Entry" }));
    await chooseOption(user, selectNear("Action", document.body), "Reward");
    await user.type(screen.getByPlaceholderText("What reward was gained?"), "Bounty");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Price must be a number.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("offers no entry form to a viewer", async () => {
    renderTab(false);

    await screen.findByText("Rope");
    expect(screen.queryByRole("button", { name: "Add Trade Entry" })).not.toBeInTheDocument();
  });
});
