/**
 * The detail card behind item, skill, spell and special popups (the warband pages' DetailPopup
 * and the hired-sword detail's tooltips): it reads the entry by id on every open, and for an item
 * then reads the type's whole property list for the descriptions, one request after the other,
 * with a failure of the second turned into "No description available yet." (CAT-UX-04,
 * CAT-PERF-03). PR A shows the error with Retry; PR B reads both from the cached lists.
 */
import { act, fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PROPERTIES, deferred, rustyCleaver, skill, sword } from "@/test/catalogue-fixtures";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import DetailCardContent from "./DetailCardContent";

import type { Item } from "@/features/items/types/item-types";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const BOOK_PROPERTIES = "GET /item-properties/?type=Weapon";
const CAMPAIGN_PROPERTIES = "GET /item-properties/?type=Weapon&campaign_id=1";

/** Hovers a property's name and returns the tooltip text it opens. */
async function propertyTooltip(name: string) {
  fireEvent.mouseEnter(screen.getByText(name).parentElement!);
  return (await screen.findByRole("tooltip")).textContent;
}

beforeEach(() => {
  fakeApi.reset();
});

describe("DetailCardContent: an item", () => {
  // Characterises current behaviour (CAT-UX-04, CAT-PERF-03, pinned; flips in PR B)
  it("reads the item, and only once it answers reads the type's properties (CAT-UX-04, CAT-PERF-03, pinned; flips in PR B)", async () => {
    const item = deferred<Item>();
    fakeApi.on("GET /items/2/", () => item.promise);
    fakeApi.on(BOOK_PROPERTIES, PROPERTIES);
    renderWithQueryClient(<DetailCardContent entry={{ id: 2, type: "item", name: "Sword" }} />);

    expect(screen.getByText("Loading...")).toBeVisible();
    expect(fakeApi.calls()).toEqual(["GET /items/2/"]);
    await act(async () => item.resolve(sword));

    expect(await screen.findByRole("heading", { name: "Sword" })).toBeVisible();
    expect(fakeApi.calls()).toEqual(["GET /items/2/", BOOK_PROPERTIES]);
    expect(await propertyTooltip("Parry")).toBe("Parries a blow.");
  });

  it("asks a campaign item's properties with its campaign, a book item's without one", async () => {
    const cleaver = { ...rustyCleaver, properties: [{ id: 501, name: "Parry", type: "Weapon" }] };
    fakeApi.on("GET /items/240/", cleaver);
    fakeApi.on(CAMPAIGN_PROPERTIES, PROPERTIES);
    renderWithQueryClient(
      <DetailCardContent entry={{ id: 240, type: "item", name: "Rusty Cleaver" }} />
    );

    expect(await screen.findByRole("heading", { name: "Rusty Cleaver" })).toBeVisible();
    expect(await propertyTooltip("Parry")).toBe("Parries a blow.");
    expect(fakeApi.calls()).toEqual(["GET /items/240/", CAMPAIGN_PROPERTIES]);
  });

  // Characterises current behaviour (CAT-UX-04, pinned; flips in PR A)
  it('hides a failed property read: the tooltip says "No description available yet." with no error (CAT-UX-04, pinned; flips in PR A)', async () => {
    fakeApi.on("GET /items/2/", sword);
    fakeApi.fail(BOOK_PROPERTIES, new Error("Server error"));
    renderWithQueryClient(<DetailCardContent entry={{ id: 2, type: "item", name: "Sword" }} />);

    expect(await screen.findByRole("heading", { name: "Sword" })).toBeVisible();
    expect(await propertyTooltip("Parry")).toBe("No description available yet.");
    expect(screen.queryByText("Server error")).toBeNull();
  });

  it("shows a failed item read as the error's message", async () => {
    fakeApi.fail("GET /items/2/", new Error("Item not found"));
    renderWithQueryClient(<DetailCardContent entry={{ id: 2, type: "item", name: "Sword" }} />);

    expect(await screen.findByText("Item not found")).toBeVisible();
    expect(fakeApi.calls()).toEqual(["GET /items/2/"]);
  });

  it("reads the item again on every mount: nothing is cached", async () => {
    fakeApi.on("GET /items/2/", sword);
    fakeApi.on(BOOK_PROPERTIES, PROPERTIES);
    const entry = { id: 2, type: "item", name: "Sword" } as const;
    const { unmount, queryClient } = renderWithQueryClient(<DetailCardContent entry={entry} />);
    await screen.findByRole("heading", { name: "Sword" });
    unmount();

    renderWithQueryClient(<DetailCardContent entry={entry} />, { queryClient });
    await screen.findByRole("heading", { name: "Sword" });

    expect(fakeApi.countOf("GET /items/2/")).toBe(2);
    expect(fakeApi.countOf(BOOK_PROPERTIES)).toBe(2);
  });
});

describe("DetailCardContent: skills, spells and specials", () => {
  it("reads a skill by id, one request", async () => {
    fakeApi.on("GET /skills/205/", skill());
    renderWithQueryClient(
      <DetailCardContent entry={{ id: 205, type: "skill", name: "Strike to Injure" }} />
    );

    expect(await screen.findByText("Add +1 to injury rolls.")).toBeVisible();
    expect(fakeApi.calls()).toEqual(["GET /skills/205/"]);
  });

  it("reads a spell and a special by id", async () => {
    fakeApi.on("GET /spells/301/", {
      id: 301,
      name: "Fires of U'Zhul",
      type: "Lesser Magic",
      dc: 7,
    });
    fakeApi.on("GET /special/401/", {
      id: 401,
      name: "Leader",
      type: "Trait",
      description: "Leads.",
    });
    renderWithQueryClient(
      <>
        <DetailCardContent entry={{ id: 301, type: "spell", name: "Fires of U'Zhul" }} />
        <DetailCardContent entry={{ id: 401, type: "special", name: "Leader" }} />
      </>
    );

    expect(await screen.findByText("DC 7")).toBeVisible();
    expect(await screen.findByText("Leads.")).toBeVisible();
    expect([...fakeApi.calls()].sort()).toEqual(["GET /special/401/", "GET /spells/301/"]);
  });
});
