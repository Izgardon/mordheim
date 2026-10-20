/**
 * The bodies the bestiary pages' Add dialogs send, as the server receives them:
 * `BestiaryEntryFormDialog` and `HiredSwordProfileFormDialog` (create only: nothing edits an
 * entry or a hired sword, CAT-UX-02), plus the special each can create on the spot. Their pickers
 * read the shared catalogue lists. The baseline for PR A's scoped ids and validated costs.
 */
import { fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { queryKeys } from "@/lib/query-keys";
import {
  BESTIARY,
  HIRED_SWORDS,
  bestiaryDetail,
  hiredSwordDetail,
  pitFighter,
  routeCatalogue,
  sewerRat,
} from "@/test/catalogue-fixtures";
import { fakeApi } from "@/test/fake-api";
import { createTestQueryClient, renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";
import BestiaryEntryFormDialog from "./BestiaryEntryFormDialog";
import HiredSwordProfileFormDialog from "./HiredSwordProfileFormDialog";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const BESTIARY_KEY = queryKeys.campaign.catalogue(1, "bestiary");
const HIRED_SWORDS_KEY = queryKeys.campaign.catalogue(1, "hired-swords");

/** A client holding the bestiary and hired-sword lists, as the pages leave them. */
function clientWithLists() {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(BESTIARY_KEY, BESTIARY);
  queryClient.setQueryData(HIRED_SWORDS_KEY, HIRED_SWORDS);
  return queryClient;
}

/** Picks `name` from the picker whose search box reads `placeholder`. */
async function pick(user: ReturnType<typeof setupUser>, placeholder: string, name: string) {
  await user.click(screen.getByPlaceholderText(placeholder));
  await user.click(await screen.findByRole("button", { name: new RegExp(`^${name}`) }));
}

/** Replaces the value of the stat input at `index` (M, WS, BS, S, T, W, I, A, Ld). */
async function setStat(user: ReturnType<typeof setupUser>, index: number, value: string) {
  const input = within(screen.getByRole("dialog"))
    .getAllByRole("spinbutton")
    .filter((element) => element.getAttribute("max") === "10")[index];
  await user.clear(input);
  await user.type(input, value);
}

beforeEach(() => {
  fakeApi.reset();
  routeCatalogue();
  fakeApi.on("POST /bestiary/", bestiaryDetail(sewerRat));
  fakeApi.on("POST /hired-swords/", hiredSwordDetail(pitFighter));
});

describe("BestiaryEntryFormDialog: create", () => {
  it("POSTs the stat line as numbers with the picked skill, special and equipment, then marks the bestiary list stale", async () => {
    const user = setupUser();
    const onOpenChange = vi.fn();
    const queryClient = clientWithLists();
    renderWithQueryClient(
      <BestiaryEntryFormDialog open onOpenChange={onOpenChange} campaignId={1} />,
      { queryClient }
    );

    await user.type(screen.getByLabelText("Name"), "Sewer Hound");
    await setStat(user, 0, "6");
    await setStat(user, 3, "4");
    await user.type(screen.getByPlaceholderText("-"), "5");
    await pick(user, "Search special rules...", "Leader");
    await pick(user, "Search skills...", "Strike to Injure");
    await pick(user, "Search items...", "Sword");
    // Clearing snaps the quantity back to 1, so set it as a pasted value would.
    fireEvent.change(screen.getByLabelText("Quantity for Sword"), { target: { value: "2" } });
    await user.click(screen.getByLabelText("Large target"));
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(fakeApi.bodyOf("POST /bestiary/")).toEqual({
      campaign_id: 1,
      name: "Sewer Hound",
      type: "Attack",
      description: "",
      movement: 6,
      weapon_skill: 0,
      ballistic_skill: 0,
      strength: 4,
      toughness: 0,
      wounds: 1,
      initiative: 0,
      attacks: 1,
      leadership: 0,
      armour_save: 5,
      large: true,
      caster: "No",
      special_ids: [401],
      skill_ids: [205],
      spell_ids: [],
      item_entries: [{ item_id: 2, quantity: 2 }],
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(queryClient.getQueryState(BESTIARY_KEY)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(HIRED_SWORDS_KEY)?.isInvalidated).toBe(false);
  });

  it('creates a special on the spot with type "Animal" and links it', async () => {
    const user = setupUser();
    fakeApi.on("POST /special/", {
      id: 450,
      campaign_id: 1,
      name: "Mange",
      type: "Animal",
      description: "Itchy.",
    });
    renderWithQueryClient(<BestiaryEntryFormDialog open onOpenChange={vi.fn()} campaignId={1} />, {
      queryClient: clientWithLists(),
    });

    await user.type(screen.getByLabelText("Name"), "Sewer Hound");
    await user.type(screen.getByPlaceholderText("Search special rules..."), "Mange");
    await user.click(screen.getByRole("button", { name: /Create new rule/ }));
    await user.type(screen.getByPlaceholderText("Description (optional)"), "Itchy.");
    await user.click(screen.getByRole("button", { name: "Add rule" }));
    await screen.findByRole("button", { name: "Remove Mange" });
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(fakeApi.bodyOf("POST /special/")).toEqual({
      campaign_id: 1,
      name: "Mange",
      type: "Animal",
      description: "Itchy.",
    });
    expect(fakeApi.bodyOf("POST /bestiary/")).toMatchObject({ special_ids: [450] });
  });
});

describe("HiredSwordProfileFormDialog: create", () => {
  // Characterises current behaviour (CAT-UX-02, BUG-53, pinned; flips in PR C)
  it("POSTs the entry, costs and skill lists with no grade, race, rating or restrictions, then marks both lists stale (CAT-UX-02, pinned; flips in PR C)", async () => {
    const user = setupUser();
    const queryClient = clientWithLists();
    renderWithQueryClient(
      <HiredSwordProfileFormDialog open onOpenChange={vi.fn()} campaignId={1} />,
      { queryClient }
    );

    await user.type(screen.getByLabelText("Name"), "Pit Fighter");
    await user.type(screen.getByLabelText("Hire Cost (gc)"), "35");
    await user.type(screen.getByPlaceholderText("e.g. D6x5"), "D6x5");
    await user.click(screen.getByRole("checkbox", { name: "Combat" }));
    await user.click(screen.getByRole("checkbox", { name: "Strength" }));
    await setStat(user, 1, "4");
    await pick(user, "Search items...", "Rusty Cleaver");
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(fakeApi.bodyOf("POST /hired-swords/")).toEqual({
      campaign_id: 1,
      name: "Pit Fighter",
      type: "Hired Sword",
      description: "",
      movement: 0,
      weapon_skill: 4,
      ballistic_skill: 0,
      strength: 0,
      toughness: 0,
      wounds: 1,
      initiative: 0,
      attacks: 1,
      leadership: 0,
      armour_save: null,
      large: false,
      caster: "No",
      special_ids: [],
      skill_ids: [],
      spell_ids: [],
      item_entries: [{ item_id: 240, quantity: 1 }],
      hire_cost: 35,
      hire_cost_expression: "",
      upkeep_cost: null,
      upkeep_cost_expression: "D6x5",
      available_skill_types: ["Combat", "Strength"],
    });
    expect(queryClient.getQueryState(BESTIARY_KEY)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(HIRED_SWORDS_KEY)?.isInvalidated).toBe(true);
  });

  it('creates a special on the spot with type "Hired Sword"', async () => {
    const user = setupUser();
    fakeApi.on("POST /special/", {
      id: 451,
      campaign_id: 1,
      name: "Pit Born",
      type: "Hired Sword",
      description: "",
    });
    renderWithQueryClient(
      <HiredSwordProfileFormDialog open onOpenChange={vi.fn()} campaignId={1} />,
      { queryClient: clientWithLists() }
    );

    await user.type(screen.getByPlaceholderText("Search special rules..."), "Pit Born");
    await user.click(screen.getByRole("button", { name: /Create new rule/ }));
    await user.click(screen.getByRole("button", { name: "Add rule" }));

    await screen.findByRole("button", { name: "Remove Pit Born" });
    expect(fakeApi.bodyOf("POST /special/")).toEqual({
      campaign_id: 1,
      name: "Pit Born",
      type: "Hired Sword",
      description: "",
    });
  });
});
