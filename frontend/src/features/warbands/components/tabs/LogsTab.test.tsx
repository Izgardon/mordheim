/**
 * The Logs tab: it reads the log a server page of 12 at a time, follows the cursor, filters on
 * the server (ECON-PERF-06) and keeps the pages it read while hidden (ECON-PERF-08).
 * `apiRequest` is answered by a fake server.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LogsTab from "./LogsTab";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import type { Warband, WarbandLog } from "@/features/warbands/types/warband-types";

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

const log = (id: number, overrides: Partial<WarbandLog> = {}): WarbandLog => ({
  id,
  warband_id: 9,
  parent_id: null,
  feature: "loadout",
  entry_type: "hero_item",
  payload: { hero: "Aldric", item: `Item ${id}`, price: 5 },
  created_at: "2026-10-01T10:00:00Z",
  ...overrides,
});

/** 26 entries, newest first: 20 loadout, 5 rarity rolls and a battle with one child entry. */
const logs: WarbandLog[] = [
  ...Array.from({ length: 20 }, (_, index) => log(100 - index)),
  ...Array.from({ length: 5 }, (_, index) =>
    log(50 - index, {
      feature: "trading_action",
      entry_type: "rarity roll",
      payload: { hero: "Aldric", item: `Charm ${index}`, rarity: "9", roll: 7, success: false },
    })
  ),
  log(10, {
    feature: "loadout",
    entry_type: "hero_item",
    parent_id: 9,
    payload: { hero: "Aldric", item: "Lucky Charm", price: 40, quantity: 3 },
  }),
];

/** The tab as the page mounts it: only while Logs is the active tab. */
function LogsPanel() {
  const [shown, setShown] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setShown((value) => !value)}>
        Switch tab
      </button>
      {shown ? <LogsTab warband={warband} /> : null}
    </>
  );
}

const itemLines = () => screen.getAllByText(/^Aldric received: /).map((line) => line.textContent);

const FIRST = "GET /warbands/9/logs/?limit=12";
const FEATURES = ["trading_action", "loadout"];
const page = (results: WarbandLog[], next_cursor: string | null, first = false) => ({
  results,
  next_cursor,
  ...(first ? { features: FEATURES } : {}),
});

beforeEach(() => {
  fakeApi.reset();
  fakeApi.on(FIRST, page(logs.slice(0, 12), "c2", true));
  fakeApi.on(`${FIRST}&cursor=c2`, page(logs.slice(12, 24), "c3"));
  fakeApi.on(`${FIRST}&cursor=c3`, page(logs.slice(24), null));
});

describe("LogsTab", () => {
  it("reads a stash purchase as a stash entry, not as a hero named Stash (BUG-110)", async () => {
    fakeApi.on(
      FIRST,
      page(
        [log(1, { entry_type: "stash_item", payload: { item: "Rope", price: 15, quantity: 3 } })],
        null,
        true
      )
    );
    renderWithQueryClient(<LogsPanel />);

    const line = await screen.findByText("Added to the stash: Rope x 3");
    expect(line.parentElement).toHaveTextContent("15");
    expect(screen.queryByText(/received:/)).not.toBeInTheDocument();
  });

  it("labels a hireling's skill, special and spell entries as a hired sword's, as the site calls the kind", async () => {
    const payload = { hero: "Brother Hal", skill: "Dodge", special: "Ward", spell: "Smite" };
    fakeApi.on(
      FIRST,
      page(
        ["hireling_skill", "hireling_special", "hireling_spell"].map((entry_type, index) =>
          log(index + 1, { entry_type, payload })
        ),
        null,
        true
      )
    );
    renderWithQueryClient(<LogsPanel />);

    expect(await screen.findByText("Loadout: Hired Sword Skill")).toBeInTheDocument();
    expect(screen.getByText("Loadout: Hired Sword Special")).toBeInTheDocument();
    expect(screen.getByText("Loadout: Hired Sword Spell")).toBeInTheDocument();
  });

  it("reads the log 12 entries a page from the server, following the cursor (ECON-PERF-06)", async () => {
    const user = setupUser();
    renderWithQueryClient(<LogsPanel />);

    expect(await screen.findByText("Page 1")).toBeInTheDocument();
    expect(itemLines()).toHaveLength(12);
    expect(itemLines()[0]).toBe("Aldric received: Item 100");
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    expect(fakeApi.calls()).toEqual([FIRST]);

    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(await screen.findByText("Page 2")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(await screen.findByText("Page 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();

    // Back to a page already read: no request.
    await user.click(screen.getByRole("button", { name: "Previous page" }));
    expect(screen.getByText("Page 2")).toBeInTheDocument();
    expect(fakeApi.calls()).toEqual([FIRST, `${FIRST}&cursor=c2`, `${FIRST}&cursor=c3`]);
  });

  it("filters on the server, with the whole log's features, and goes back to page 1 (ECON-PERF-06)", async () => {
    const user = setupUser();
    const rolls = logs.filter((entry) => entry.feature === "trading_action");
    fakeApi.on(`${FIRST}&feature=trading_action`, page(rolls, null, true));
    renderWithQueryClient(<LogsPanel />);
    await screen.findByText("Page 1");
    await user.click(screen.getByRole("button", { name: "Next page" }));
    await screen.findByText("Page 2");

    // The filter has no label (ECON-UX-04); its options are the log's features, sorted.
    const filter = screen.getByRole("combobox");
    expect(
      within(filter)
        .getAllByRole("option")
        .map((option) => option.textContent)
    ).toEqual(["All features", "Loadout", "Trading Action"]);
    await user.selectOptions(filter, "trading_action");

    await waitFor(() => expect(screen.queryByText(/^Page \d/)).not.toBeInTheDocument());
    expect(screen.getAllByText("Trading Action").length).toBeGreaterThanOrEqual(5);
    expect(screen.queryByText(/^Aldric received: /)).not.toBeInTheDocument();
    expect(fakeApi.calls()).toEqual([
      FIRST,
      `${FIRST}&cursor=c2`,
      `${FIRST}&feature=trading_action`,
    ]);

    // Back to every feature: the pages read before are still there.
    await user.selectOptions(filter, "all");
    expect(await screen.findByText("Page 1")).toBeInTheDocument();
    expect(fakeApi.countOf(FIRST)).toBe(1);
  });

  it("lists a child entry as a row of its own, with the purchase's quantity and price (ECON-UX-04, pinned; flips in PR C)", async () => {
    const user = setupUser();
    renderWithQueryClient(<LogsPanel />);
    await screen.findByText("Page 1");

    await user.click(screen.getByRole("button", { name: "Next page" }));
    await screen.findByText("Page 2");
    await user.click(screen.getByRole("button", { name: "Next page" }));
    await screen.findByText("Page 3");

    expect(screen.getByText("Aldric received: Lucky Charm x 3")).toBeInTheDocument();
    expect(screen.getByText("40 gc")).toBeInTheDocument();
  });

  it("keeps the pages it read while the tab is hidden: showing it again reads nothing (ECON-PERF-08)", async () => {
    const user = setupUser();
    renderWithQueryClient(<LogsPanel />);
    await screen.findByText("Page 1");

    await user.click(screen.getByRole("button", { name: "Switch tab" }));
    await user.click(screen.getByRole("button", { name: "Switch tab" }));

    await screen.findByText("Page 1");
    expect(fakeApi.calls()).toEqual([FIRST]);
  });

  it("shows the server's message when the logs can't be loaded", async () => {
    fakeApi.fail(FIRST, new Error("Server error"));
    renderWithQueryClient(<LogsPanel />);

    expect(await screen.findByText("Server error")).toBeInTheDocument();
  });
});
