/**
 * The resource bar (`useWarbandResources`): +/- clicks are coalesced for 1 s into one PATCH of
 * the change (`delta`, added by the server, BUG-68), and Sell is one `POST resources/<id>/sell/`
 * that answers the resource and the new summary. `apiRequest` is answered by a fake server.
 */
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { notifyManager, useQuery } from "@tanstack/react-query";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import WarbandResourceBar from "./WarbandResourceBar";
import { ApiError } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { getFieldNear } from "@/test/roster-queries";
import { setupUser } from "@/test/user-event";

import type { WarbandResource } from "@/features/warbands/types/warband-types";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const treasure: WarbandResource = { id: 3, warband_id: 9, name: "Treasure", amount: 2 };
const wyrdstone: WarbandResource = { id: 4, warband_id: 9, name: "Wyrdstone", amount: 5 };
const goldCrowns: WarbandResource = { id: 5, warband_id: 9, name: "Gold Crowns", amount: 40 };

type Sheet = { warband: object; summary: { gold: number; resources: WarbandResource[] } };

/**
 * The bar as the page holds it: its resources and the header gold come from the page's cached
 * sheet, which every resource write updates.
 */
function Bar({ initial, canEdit }: { initial: WarbandResource[]; canEdit: boolean }) {
  const sheet = useQuery<Sheet>({
    queryKey: queryKeys.campaign.warbandSheet(7, 9),
    queryFn: () => new Promise<never>(() => undefined),
    initialData: { warband: {}, summary: { gold: 100, resources: initial } },
    staleTime: Infinity,
  });
  return (
    <>
      <p>Header gold: {sheet.data?.summary.gold}</p>
      <WarbandResourceBar
        warbandId={9}
        resources={sheet.data?.summary.resources ?? []}
        canEdit={canEdit}
      />
    </>
  );
}

const renderBar = (initial: WarbandResource[] = [treasure, wyrdstone], canEdit = true) =>
  renderWithQueryClient(<Bar initial={initial} canEdit={canEdit} />);

/** The amount shown under a resource's name. */
const amountOf = (name: string) => {
  const label = screen.getByText(name);
  return (label.parentElement as HTMLElement).querySelector(".surface-inline")?.textContent;
};

/** The server's treasure: what another tab may have saved meanwhile, plus each delta it gets. */
let storedTreasure = treasure.amount;

// The resources live in the query cache, which tells the bar on a timer by default; on a
// microtask it tells it at once, also under the fake clock the +/- tests run on.
beforeAll(() => notifyManager.setScheduler((callback) => queueMicrotask(callback)));
afterAll(() => notifyManager.setScheduler((callback) => setTimeout(callback, 0)));

beforeEach(() => {
  fakeApi.reset();
  storedTreasure = treasure.amount;
  fakeApi.on("PATCH /warbands/9/resources/3/", (body: unknown) => {
    storedTreasure = Math.max(0, storedTreasure + (body as { delta: number }).delta);
    return { ...treasure, amount: storedTreasure };
  });
});

describe("WarbandResourceBar: +/-", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("coalesces clicks for 1 s into one PATCH of the change, which the server adds (BUG-68)", async () => {
    renderBar();
    const increase = screen.getByRole("button", { name: "Increase Treasure" });

    fireEvent.click(increase);
    fireEvent.click(increase);
    fireEvent.click(increase);
    expect(amountOf("Treasure")).toBe("5");
    await act(() => vi.advanceTimersByTimeAsync(999));
    expect(fakeApi.calls()).toEqual([]);
    // Another tab adds 4 meanwhile.
    storedTreasure += 4;

    await act(() => vi.advanceTimersByTimeAsync(1));

    expect(fakeApi.requests()).toEqual([
      { method: "PATCH", path: "/warbands/9/resources/3/", body: { delta: 3 } },
    ]);
    // The other tab's 4 is kept: 2 + 4 + 3.
    expect(amountOf("Treasure")).toBe("9");
  });

  it("restarts the 1 s wait on every click", async () => {
    renderBar();
    const increase = screen.getByRole("button", { name: "Increase Treasure" });

    fireEvent.click(increase);
    await act(() => vi.advanceTimersByTimeAsync(800));
    fireEvent.click(increase);
    await act(() => vi.advanceTimersByTimeAsync(800));
    expect(fakeApi.calls()).toEqual([]);

    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(fakeApi.bodyOf("PATCH /warbands/9/resources/3/")).toEqual({ delta: 2 });
  });

  it("sends nothing when the clicks cancel out, or below zero", async () => {
    renderBar([{ ...treasure, amount: 0 }, wyrdstone]);

    fireEvent.click(screen.getByRole("button", { name: "Decrease Treasure" }));
    expect(amountOf("Treasure")).toBe("0");
    fireEvent.click(screen.getByRole("button", { name: "Increase Wyrdstone" }));
    fireEvent.click(screen.getByRole("button", { name: "Decrease Wyrdstone" }));
    await act(() => vi.advanceTimersByTimeAsync(2000));

    expect(fakeApi.calls()).toEqual([]);
    expect(amountOf("Wyrdstone")).toBe("5");
  });

  it("shows the server's message and the saved amount when the PATCH fails", async () => {
    fakeApi.fail("PATCH /warbands/9/resources/3/", new Error("Amount must be positive."));
    renderBar();

    fireEvent.click(screen.getByRole("button", { name: "Increase Treasure" }));
    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(screen.getByText("Amount must be positive.")).toBeInTheDocument();
    expect(amountOf("Treasure")).toBe("2");
  });

  it("hides a resource named Gold Crowns", () => {
    renderBar([treasure, goldCrowns]);

    expect(screen.getByText("Treasure")).toBeInTheDocument();
    expect(screen.queryByText("Gold Crowns")).not.toBeInTheDocument();
  });
});

describe("WarbandResourceBar: Sell", () => {
  const sell = async (user: ReturnType<typeof setupUser>, quantity: string, price: string) => {
    const sellButtons = screen.getAllByRole("button", { name: "Sell" });
    await user.click(sellButtons[0]);
    const dialog = screen.getByRole("dialog", { name: "Sell Treasure" });
    await user.clear(getFieldNear("Quantity", dialog));
    await user.type(getFieldNear("Quantity", dialog), quantity);
    await user.clear(getFieldNear("Price", dialog));
    await user.type(getFieldNear("Price", dialog), price);
    await user.click(within(dialog).getByRole("button", { name: "Sell" }));
    return dialog;
  };

  it("sells in one request and takes the answer's resource and summary, with no GET (BUG-68)", async () => {
    const user = setupUser();
    fakeApi.on("POST /warbands/9/resources/3/sell/", {
      resource: { ...treasure, amount: 0 },
      trade: { id: 900, action: "Sell", description: "Treasure x 2", price: 30 },
      summary: { gold: 130 },
    });
    renderBar();

    await sell(user, "2", "30");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(fakeApi.requests()).toEqual([
      {
        method: "POST",
        path: "/warbands/9/resources/3/sell/",
        body: { quantity: 2, price: 30 },
      },
    ]);
    expect(amountOf("Treasure")).toBe("0");
    expect(screen.getByText("Header gold: 130")).toBeInTheDocument();
  });

  it("keeps the amount and the gold and shows why when the sale is refused (BUG-68)", async () => {
    const user = setupUser();
    fakeApi.fail(
      "POST /warbands/9/resources/3/sell/",
      new ApiError("Not enough Treasure to sell.", 400, {
        detail: "Not enough Treasure to sell.",
        code: "not_enough_resource",
      })
    );
    renderBar();

    const dialog = await sell(user, "1", "15");

    expect(await within(dialog).findByText("Not enough Treasure to sell.")).toBeInTheDocument();
    expect(fakeApi.calls()).toEqual(["POST /warbands/9/resources/3/sell/"]);
    expect(amountOf("Treasure")).toBe("2");
    expect(screen.getByText("Header gold: 100")).toBeInTheDocument();
  });

  it("saves unsent +/- clicks before selling, so the sale counts them", async () => {
    const user = setupUser();
    fakeApi.on("POST /warbands/9/resources/3/sell/", {
      resource: { ...treasure, amount: 1 },
      trade: { id: 901 },
      summary: { gold: 145 },
    });
    renderBar();

    await user.click(screen.getByRole("button", { name: "Increase Treasure" }));
    await sell(user, "2", "45");

    await waitFor(() => expect(fakeApi.countOf("POST /warbands/9/resources/3/sell/")).toBe(1));
    expect(fakeApi.requests()).toEqual([
      { method: "PATCH", path: "/warbands/9/resources/3/", body: { delta: 1 } },
      {
        method: "POST",
        path: "/warbands/9/resources/3/sell/",
        body: { quantity: 2, price: 45 },
      },
    ]);
    expect(await screen.findByText("Header gold: 145")).toBeInTheDocument();
  });
});

describe("WarbandResourceBar: editing", () => {
  it("deletes a resource at once, with no confirmation (ECON-UX-03, pinned; flips in PR C)", async () => {
    const user = setupUser();
    fakeApi.on("DELETE /warbands/9/resources/4/", undefined);
    renderBar();

    await user.click(screen.getByRole("button", { name: "Edit resources" }));
    const chip = screen.getByText("Wyrdstone").parentElement as HTMLElement;
    await user.click(within(chip).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(screen.queryByText("Wyrdstone")).not.toBeInTheDocument());
    expect(fakeApi.calls()).toEqual(["DELETE /warbands/9/resources/4/"]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("adds a named resource, and asks for a name first", async () => {
    const user = setupUser();
    fakeApi.on("POST /warbands/9/resources/", { id: 6, warband_id: 9, name: "Shards", amount: 0 });
    renderBar();

    await user.click(screen.getByRole("button", { name: "Edit resources" }));
    await user.click(screen.getByRole("button", { name: "Add resource" }));
    expect(screen.getByText("Resource type is required.")).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Resource type"), "Shards");
    await user.click(screen.getByRole("button", { name: "Add resource" }));
    await user.click(await screen.findByRole("button", { name: "Done" }));

    expect(await screen.findByText("Shards")).toBeInTheDocument();
    expect(fakeApi.requests()).toEqual([
      { method: "POST", path: "/warbands/9/resources/", body: { name: "Shards" } },
    ]);
  });

  it("offers no controls to a viewer", () => {
    renderBar([treasure], false);

    expect(screen.queryByRole("button", { name: "Edit resources" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Increase Treasure" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Sell" })).toBeDisabled();
  });
});
