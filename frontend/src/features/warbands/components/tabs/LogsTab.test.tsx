/**
 * Characterisation of the Logs tab before pass 2 moves paging and the feature filter to the
 * server (ECON-PERF-06): today it GETs every log once, pages 12 at a time in the browser and
 * filters there. `apiRequest` is answered by a fake server.
 */
import { screen, within } from "@testing-library/react";
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

beforeEach(() => {
  fakeApi.reset();
  fakeApi.on("GET /warbands/9/logs/", logs);
});

describe("LogsTab", () => {
  it("GETs every log once and shows them 12 to a page", async () => {
    const user = setupUser();
    renderWithQueryClient(<LogsPanel />);

    expect(await screen.findByText("Page 1 of 3")).toBeInTheDocument();
    expect(itemLines()).toHaveLength(12);
    expect(itemLines()[0]).toBe("Aldric received: Item 100");
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Next page" }));
    await user.click(screen.getByRole("button", { name: "Next page" }));

    expect(screen.getByText("Page 3 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
    expect(fakeApi.calls()).toEqual(["GET /warbands/9/logs/"]);
  });

  it("filters by feature in the browser and goes back to page 1", async () => {
    const user = setupUser();
    renderWithQueryClient(<LogsPanel />);
    await screen.findByText("Page 1 of 3");
    await user.click(screen.getByRole("button", { name: "Next page" }));

    // The filter has no label (ECON-UX-04); its options are the features present, sorted.
    const filter = screen.getByRole("combobox");
    expect(
      within(filter)
        .getAllByRole("option")
        .map((option) => option.textContent)
    ).toEqual(["All features", "Loadout", "Trading Action"]);
    await user.selectOptions(filter, "trading_action");

    expect(screen.queryByText(/^Page \d/)).not.toBeInTheDocument();
    expect(screen.getAllByText("Trading Action").length).toBeGreaterThanOrEqual(5);
    expect(screen.queryByText(/^Aldric received: /)).not.toBeInTheDocument();
    expect(fakeApi.calls()).toEqual(["GET /warbands/9/logs/"]);

    await user.selectOptions(filter, "loadout");
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
  });

  it("lists a child entry as a row of its own, with the purchase's quantity and price", async () => {
    const user = setupUser();
    renderWithQueryClient(<LogsPanel />);
    await screen.findByText("Page 1 of 3");

    await user.click(screen.getByRole("button", { name: "Next page" }));
    await user.click(screen.getByRole("button", { name: "Next page" }));

    expect(screen.getByText("Aldric received: Lucky Charm x 3")).toBeInTheDocument();
    expect(screen.getByText("40 gc")).toBeInTheDocument();
  });

  it("GETs every log again each time the tab is shown (ECON-PERF-08)", async () => {
    const user = setupUser();
    renderWithQueryClient(<LogsPanel />);
    await screen.findByText("Page 1 of 3");

    await user.click(screen.getByRole("button", { name: "Switch tab" }));
    await user.click(screen.getByRole("button", { name: "Switch tab" }));

    await screen.findByText("Page 1 of 3");
    expect(fakeApi.calls()).toEqual(["GET /warbands/9/logs/", "GET /warbands/9/logs/"]);
  });

  it("shows the server's message when the logs can't be loaded", async () => {
    fakeApi.fail("GET /warbands/9/logs/", new Error("Server error"));
    renderWithQueryClient(<LogsPanel />);

    expect(await screen.findByText("Server error")).toBeInTheDocument();
  });
});
