/**
 * The bodies the Bestiary's Add dialog sends, as the server receives them:
 * `BestiaryEntryFormDialog` (create only: nothing edits an entry yet, CAT-UX-02), plus the special
 * it can create on the spot. Its pickers read the shared catalogue lists. The hired-sword and
 * dramatis-persona forms are tested in features/hirelings.
 */
import { fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { queryKeys } from "@/lib/query-keys";
import { BESTIARY, bestiaryDetail, routeCatalogue, sewerRat } from "@/test/catalogue-fixtures";
import { fakeApi } from "@/test/fake-api";
import { createTestQueryClient, renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";
import BestiaryEntryFormDialog from "./BestiaryEntryFormDialog";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const BESTIARY_KEY = queryKeys.campaign.catalogue(1, "bestiary");

/** A client holding the bestiary list, as the page leaves it. */
function clientWithLists() {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(BESTIARY_KEY, BESTIARY);
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
