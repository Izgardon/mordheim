/**
 * The detail card behind item, skill, spell and special popups (the warband pages' DetailPopup
 * and the hired-sword detail's tooltips), on a campaign page: it takes the entry and an item's
 * property text from the campaign's cached lists when they hold them, reads them side by side
 * otherwise (the entry by id, the property list once), and shows a failed read with Retry
 * (CAT-UX-04, CAT-PERF-03).
 */
import { fireEvent, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { queryKeys } from "@/lib/query-keys";
import {
  ITEMS,
  LIST,
  PROPERTIES,
  SKILLS,
  deferred,
  rustyCleaver,
  skill,
  sword,
} from "@/test/catalogue-fixtures";
import { fakeApi } from "@/test/fake-api";
import { createTestQueryClient, renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";
import DetailCardContent from "./DetailCardContent";

import type { DetailEntry } from "./detail-types";
import type { Item } from "@/features/items/types/item-types";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const SWORD: DetailEntry = { id: 2, type: "item", name: "Sword" };

/** The card on a campaign page (it reads the campaign from the route), with its query client. */
function renderCard(entries: DetailEntry[], queryClient = createTestQueryClient()) {
  return renderWithQueryClient(
    <MemoryRouter initialEntries={["/campaigns/1/warband"]}>
      <Routes>
        <Route
          path="/campaigns/:id/*"
          element={entries.map((entry) => (
            <DetailCardContent key={`${entry.type}-${entry.id}`} entry={entry} />
          ))}
        />
      </Routes>
    </MemoryRouter>,
    { queryClient }
  );
}

/** Hovers a property's name and returns the tooltip text it opens. */
async function propertyTooltip(name: string) {
  fireEvent.mouseEnter(screen.getByText(name).parentElement!);
  return (await screen.findByRole("tooltip")).textContent;
}

beforeEach(() => {
  fakeApi.reset();
});

describe("DetailCardContent: an item", () => {
  it("takes the item and its property text from the cached lists, with no request (CAT-PERF-03)", async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.campaign.catalogue(1, "items"), ITEMS);
    queryClient.setQueryData(queryKeys.campaign.catalogue(1, "item-properties"), PROPERTIES);
    renderCard([SWORD], queryClient);

    expect(screen.getByRole("heading", { name: "Sword" })).toBeVisible();
    expect(await propertyTooltip("Parry")).toBe("Parries a blow.");
    expect(fakeApi.calls()).toEqual([]);
  });

  it("on a cold cache reads the item and the property list side by side, not one after the other (CAT-PERF-03)", async () => {
    const item = deferred<Item>();
    fakeApi.on("GET /items/2/", () => item.promise);
    fakeApi.on(LIST.properties, PROPERTIES);
    renderCard([SWORD]);

    expect(screen.getByText("Loading...")).toBeVisible();
    expect(fakeApi.calls()).toEqual(["GET /items/2/", LIST.properties]);
    item.resolve(sword);

    expect(await screen.findByRole("heading", { name: "Sword" })).toBeVisible();
    expect(await propertyTooltip("Parry")).toBe("Parries a blow.");
    expect(fakeApi.calls()).toEqual(["GET /items/2/", LIST.properties]);
  });

  it("reads the campaign's property list once for a book item and a campaign item alike", async () => {
    const cleaver = { ...rustyCleaver, properties: [{ id: 501, name: "Parry", type: "Weapon" }] };
    fakeApi.on("GET /items/2/", sword);
    fakeApi.on("GET /items/240/", cleaver);
    fakeApi.on(LIST.properties, PROPERTIES);
    renderCard([SWORD, { id: 240, type: "item", name: "Rusty Cleaver" }]);

    expect(await screen.findByRole("heading", { name: "Rusty Cleaver" })).toBeVisible();
    expect(await screen.findByRole("heading", { name: "Sword" })).toBeVisible();
    expect([...fakeApi.calls()].sort()).toEqual([
      "GET /item-properties/?campaign_id=1",
      "GET /items/2/",
      "GET /items/240/",
    ]);
  });

  it("shows a failed property read with Retry, which reads the list again and fills the tooltips (CAT-UX-04)", async () => {
    const user = setupUser();
    fakeApi.on("GET /items/2/", sword);
    fakeApi.fail(LIST.properties, new Error("Server error"));
    renderCard([SWORD]);

    expect(await screen.findByRole("heading", { name: "Sword" })).toBeVisible();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't load the property descriptions."
    );
    fakeApi.on(LIST.properties, PROPERTIES);
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await propertyTooltip("Parry")).toBe("Parries a blow.");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(fakeApi.countOf(LIST.properties)).toBe(2);
  });

  it("shows a failed item read with its message and Retry, which reads it again (CAT-UX-04)", async () => {
    const user = setupUser();
    fakeApi.fail("GET /items/2/", new Error("Item not found"));
    fakeApi.on(LIST.properties, PROPERTIES);
    renderCard([SWORD]);

    expect(await screen.findByRole("alert")).toHaveTextContent("Item not found");
    fakeApi.on("GET /items/2/", sword);
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByRole("heading", { name: "Sword" })).toBeVisible();
    expect(fakeApi.countOf("GET /items/2/")).toBe(2);
  });

  it("keeps what it read for the lists' 5 minutes: a reopened card reads nothing", async () => {
    fakeApi.on("GET /items/2/", sword);
    fakeApi.on(LIST.properties, PROPERTIES);
    const { unmount, queryClient } = renderCard([SWORD]);
    await screen.findByRole("heading", { name: "Sword" });
    unmount();

    renderCard([SWORD], queryClient);
    expect(screen.getByRole("heading", { name: "Sword" })).toBeVisible();

    expect(fakeApi.countOf("GET /items/2/")).toBe(1);
    expect(fakeApi.countOf(LIST.properties)).toBe(1);
  });
});

describe("DetailCardContent: skills, spells and specials", () => {
  it("reads a skill by id, one request, and no property list", async () => {
    fakeApi.on("GET /skills/205/", skill());
    renderCard([{ id: 205, type: "skill", name: "Strike to Injure" }]);

    expect(await screen.findByText("Add +1 to injury rolls.")).toBeVisible();
    expect(fakeApi.calls()).toEqual(["GET /skills/205/"]);
  });

  it("takes a skill from the cached skills list, with no request", () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.campaign.catalogue(1, "skills"), SKILLS);
    renderCard([{ id: 205, type: "skill", name: "Strike to Injure" }], queryClient);

    expect(screen.getByText("Add +1 to injury rolls.")).toBeVisible();
    expect(fakeApi.calls()).toEqual([]);
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
    renderCard([
      { id: 301, type: "spell", name: "Fires of U'Zhul" },
      { id: 401, type: "special", name: "Leader" },
    ]);

    expect(await screen.findByText("DC 7")).toBeVisible();
    expect(await screen.findByText("Leads.")).toBeVisible();
    expect([...fakeApi.calls()].sort()).toEqual(["GET /special/401/", "GET /spells/301/"]);
  });
});
