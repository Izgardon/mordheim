/**
 * The Treasury tab (`TreasuryTab`): the ledger it loads, rows signed as the server stores them
 * (decision 4), what a manual entry and an Adjustment send (decision 5), and editing a row
 * entered by hand (decision 6). `apiRequest` is answered by a fake server.
 */
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import TreasuryTab from "./TreasuryTab";
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
  description: "Starting Gold",
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

const will = { id: 1, name: "Will" };

/** Newest first, as the server lists them, every price signed (decision 4). */
const ledger: WarbandTrade[] = [
  row({
    id: 12,
    action: "Adjustment",
    description: "Miscounted the rope",
    price: 2,
    created_by: will,
    corrects_id: 3,
  }),
  row({ id: 11, action: "Trade", description: "Gold sent to Rats", price: -30 }),
  row({
    id: 4,
    action: "Group",
    description: "Recruited Black Knives (2)",
    price: 0,
    children: [child(5, "Recruit", "Blade One", -60), child(6, "Recruit", "Blade Two", -60)],
  }),
  row({ id: 3, action: "Buy", description: "Rope", price: -5 }),
  row({ id: 2, action: "Sell", description: "Sword", price: 5, notes: "Half price" }),
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
function TreasuryPanel({ canEdit }: { canEdit: boolean }) {
  const [shown, setShown] = useState(true);
  return (
    <>
      <SheetObserver />
      <button type="button" onClick={() => setShown((value) => !value)}>
        Switch tab
      </button>
      {shown ? <TreasuryTab warband={warband} canEdit={canEdit} /> : null}
    </>
  );
}

const renderTab = (canEdit = true) => renderWithQueryClient(<TreasuryPanel canEdit={canEdit} />);

beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.releasePointerCapture = vi.fn();
});

beforeEach(() => {
  fakeApi.reset();
  fakeApi.on("GET /warbands/9/trades/", ledger);
});

describe("TreasuryTab: the ledger", () => {
  it("shows each row's gold as the server signs it, in the ledger's vocabulary (decision 4)", async () => {
    renderTab();

    expect(await screen.findByText("Rope")).toBeInTheDocument();
    expect(within(rowOf("Rope")).getByText("-5 gc")).toBeInTheDocument();
    expect(within(rowOf("Rope")).getByText("Buy")).toBeInTheDocument();
    expect(within(rowOf("Sword")).getByText("+5 gc")).toBeInTheDocument();
    expect(within(rowOf("Sword")).getByText("Half price")).toBeInTheDocument();
    // Gold sent in a trade is spending: once shown as income.
    expect(within(rowOf("Gold sent to Rats")).getByText("-30 gc")).toBeInTheDocument();
    expect(within(rowOf("Gold sent to Rats")).getByText("Trade").className).toContain("red");
    expect(within(rowOf("Starting Gold")).getByText("+500 gc")).toBeInTheDocument();
    expect(within(rowOf("Starting Gold")).getByText("Starting gold")).toBeInTheDocument();
    expect(fakeApi.calls()).toEqual(["GET /warbands/9/trades/"]);
  });

  it("says who entered a row by hand and which row an Adjustment corrects (decisions 5, 6)", async () => {
    renderTab();

    await screen.findByText("Miscounted the rope");
    const adjustment = rowOf("Miscounted the rope");
    expect(within(adjustment).getByText("+2 gc")).toBeInTheDocument();
    expect(within(adjustment).getByText("Corrects: Rope")).toBeInTheDocument();
    expect(within(adjustment).getByText("Entered by Will")).toBeInTheDocument();
    expect(within(rowOf("Rope")).queryByText(/Entered by/)).not.toBeInTheDocument();
  });

  it("shows a group of purchases as an expense: -120 gc on a red badge (BUG-38)", async () => {
    const user = setupUser();
    renderTab();

    await screen.findByText("Recruited Black Knives (2)");
    const header = rowOf("Recruited Black Knives (2)");
    expect(within(header).getByText("-120 gc")).toBeInTheDocument();
    // The expense style (the income badge is green).
    expect(within(header).getByText("Group").className).toContain("red");
    expect(within(header).queryByRole("button", { name: /^Edit/ })).not.toBeInTheDocument();

    await user.click(within(header).getByRole("button", { expanded: false }));

    expect(within(header).getAllByText("-60 gc")).toHaveLength(2);
    expect(within(header).getByText("Blade One")).toBeInTheDocument();
  });

  it("signs a group of sales by its total as well: +8 gc on a green badge (BUG-38)", async () => {
    fakeApi.on("GET /warbands/9/trades/", [
      row({
        id: 8,
        action: "Group",
        description: "Sold the loot (2)",
        price: 0,
        children: [child(9, "Sell", "Sword", 5), child(10, "Sell", "Dagger", 3)],
      }),
    ]);
    renderTab();

    await screen.findByText("Sold the loot (2)");
    const header = rowOf("Sold the loot (2)");
    expect(within(header).getByText("+8 gc")).toBeInTheDocument();
    expect(within(header).getByText("Group").className).toContain("emerald");
  });

  it("loads the whole ledger again every time the tab is shown (ECON-PERF-08, pinned; flips in PR C)", async () => {
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

describe("TreasuryTab: a manual entry", () => {
  it("POSTs the entry, puts it on top and re-reads the summary for the header gold, with no local total (BUG-37; the summary GET is ECON-PERF-08, pinned until the answer carries it)", async () => {
    const user = setupUser();
    const created = row({
      id: 7,
      action: "Buy",
      description: "Lantern",
      price: -10,
      created_by: will,
    });
    fakeApi.on("POST /warbands/9/trades/", created);
    fakeApi.on("GET /warbands/9/summary/", { gold: 425 });
    const { queryClient } = renderTab();
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
    // The page's gold is the sheet's summary, which the re-read replaced.
    await waitFor(() =>
      expect(
        queryClient.getQueryData<{ summary: { gold: number } }>(
          queryKeys.campaign.warbandSheet(7, 9)
        )?.summary.gold
      ).toBe(425)
    );
    expect(screen.getAllByText(/^(Lantern|Recruited Black Knives \(2\))$/)[0]).toHaveTextContent(
      "Lantern"
    );
    expect(within(rowOf("Lantern")).getByText("-10 gc")).toBeInTheDocument();
    expect(within(rowOf("Lantern")).getByText("Entered by Will")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  });

  it("adds an Adjustment that takes gold away, with its reason (decision 5)", async () => {
    const user = setupUser();
    fakeApi.on("POST /warbands/9/trades/", (body: unknown) =>
      row({ id: 20, ...(body as object), created_by: will })
    );
    fakeApi.on("GET /warbands/9/summary/", { gold: 420 });
    renderTab();
    await screen.findByText("Rope");

    await user.click(screen.getByRole("button", { name: "Add Trade Entry" }));
    await chooseOption(user, selectNear("Action", document.body), "Adjustment");
    fireEvent.change(screen.getByPlaceholderText("0"), { target: { value: "-15" } });
    expect(screen.getByText("A negative amount takes gold away.")).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText("Why is the gold changing?"), "Lost at dice");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(fakeApi.countOf("POST /warbands/9/trades/")).toBe(1));
    expect(fakeApi.bodyOf("POST /warbands/9/trades/")).toEqual({
      action: "Adjustment",
      description: "Lost at dice",
      price: -15,
      notes: "",
    });
    expect(await screen.findByText("Lost at dice")).toBeInTheDocument();
    expect(within(rowOf("Lost at dice")).getByText("-15 gc")).toBeInTheDocument();
  });

  it("asks an Adjustment for a reason and for gold to add or take away", async () => {
    const user = setupUser();
    renderTab();
    await screen.findByText("Rope");

    await user.click(screen.getByRole("button", { name: "Add Trade Entry" }));
    await chooseOption(user, selectNear("Action", document.body), "Adjustment");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("A reason is required.")).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Why is the gold changing?"), "Recount");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(
      screen.getByText("Enter the gold this adjustment adds or takes away.")
    ).toBeInTheDocument();
    expect(fakeApi.countOf("POST /warbands/9/trades/")).toBe(0);
  });

  it("corrects a row with an Adjustment linked to it, never by changing its gold (decision 5)", async () => {
    const user = setupUser();
    fakeApi.on("POST /warbands/9/trades/", (body: unknown) =>
      row({ id: 21, ...(body as object), created_by: will })
    );
    fakeApi.on("GET /warbands/9/summary/", { gold: 440 });
    renderTab();
    await screen.findByText("Rope");

    await user.click(screen.getByRole("button", { name: "Correct Rope" }));
    expect(screen.getByText(/Corrects: .*Rope \(-5 gc\)/)).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText("0"), "5");
    await user.type(screen.getByPlaceholderText("Why is the gold changing?"), "Rope was free");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(fakeApi.countOf("POST /warbands/9/trades/")).toBe(1));
    expect(fakeApi.bodyOf("POST /warbands/9/trades/")).toEqual({
      action: "Adjustment",
      description: "Rope was free",
      price: 5,
      notes: "",
      corrects_id: 3,
    });
    expect(fakeApi.calls().some((call) => call.startsWith("DELETE"))).toBe(false);
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

  it("offers no entry form, correction or edit to a viewer", async () => {
    renderTab(false);

    await screen.findByText("Rope");
    expect(screen.queryByRole("button", { name: "Add Trade Entry" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^(Correct|Edit) / })).not.toBeInTheDocument();
  });
});

describe("TreasuryTab: a row entered by hand (decision 6)", () => {
  it("edits its description and notes in place, and offers Edit only on such rows", async () => {
    const user = setupUser();
    fakeApi.on("PATCH /warbands/9/trades/12/", (body: unknown) => ({
      ...ledger[0],
      ...(body as object),
    }));
    renderTab();
    await screen.findByText("Rope");
    expect(screen.queryByRole("button", { name: "Edit Rope" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit Miscounted the rope" }));
    const notes = screen.getByLabelText("Notes");
    await user.type(notes, "Two coins short");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Two coins short")).toBeInTheDocument();
    expect(fakeApi.bodyOf("PATCH /warbands/9/trades/12/")).toEqual({
      description: "Miscounted the rope",
      notes: "Two coins short",
    });
    expect(screen.queryByLabelText("Notes")).not.toBeInTheDocument();
  });

  it("keeps the editor open with the server's message when the edit is refused", async () => {
    const user = setupUser();
    fakeApi.fail(
      "PATCH /warbands/9/trades/12/",
      new Error("Only rows entered by hand can be edited. Correct this one with an adjustment.")
    );
    renderTab();
    await screen.findByText("Rope");

    await user.click(screen.getByRole("button", { name: "Edit Miscounted the rope" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText(
        "Only rows entered by hand can be edited. Correct this one with an adjustment."
      )
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Description")).toHaveValue("Miscounted the rope");
  });
});
