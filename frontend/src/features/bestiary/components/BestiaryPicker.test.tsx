/**
 * The battle's Load from Bestiary picker (prebattle's temporary units): it lists the creatures
 * only (mounts and pets go with a unit, never on their own), from the bestiary list the pages
 * share, and fills the unit from the one picked.
 */
import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { queryKeys } from "@/lib/query-keys";
import { BESTIARY, bestiaryEntry } from "@/test/catalogue-fixtures";
import { createTestQueryClient, renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";
import BestiaryPicker from "./BestiaryPicker";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

/** A creature with no profile in our data yet (Mutiny in Marienburg's Giant Rat). */
const giantRat = bestiaryEntry({
  id: 31,
  name: "Giant Rat",
  has_profile: false,
  movement: 0,
  weapon_skill: 0,
  strength: 0,
  toughness: 0,
  wounds: 0,
});

function renderPicker(onSelect = vi.fn()) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(queryKeys.campaign.catalogue(1, "bestiary"), [...BESTIARY, giantRat]);
  renderWithQueryClient(
    <BestiaryPicker campaignId={1} onSelect={onSelect} onClose={() => undefined} />,
    { queryClient }
  );
  return onSelect;
}

const rows = () =>
  screen
    .getAllByRole("button")
    .filter((button) => button.textContent !== "Close")
    .map((button) => button.textContent ?? "");

describe("Load from Bestiary", () => {
  it("lists the creatures only, each with its kind and stats, or No profile", () => {
    renderPicker();

    expect(rows().map((text) => text.split("Creature")[0])).toEqual([
      "Giant Rat",
      "Sewer Rat",
      "Warhound",
    ]);
    expect(screen.queryByText("Warhorse")).toBeNull();
    expect(screen.queryByText("Raven")).toBeNull();
    const hound = screen.getByRole("button", { name: /^Warhound/ });
    expect(within(hound).getByText("M6")).toBeVisible();
    const rat = screen.getByRole("button", { name: /^Giant Rat/ });
    expect(within(rat).getByText("No profile")).toBeVisible();
  });

  it("searches the creatures by name", async () => {
    const user = setupUser();
    renderPicker();

    await user.type(screen.getByPlaceholderText("Search creatures..."), "hound");

    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toMatch(/^Warhound/);
  });

  it("hands the picked creature to the battle", async () => {
    const user = setupUser();
    const onSelect = renderPicker();

    await user.click(screen.getByRole("button", { name: /^Warhound/ }));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 5, kind: "creature" }));
  });
});
