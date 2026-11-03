/**
 * A unit's loadout: what it carries and the stash share one details panel at the foot, one item
 * at a time, and Give to and To stash work without opening it.
 */
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { catalogueListKey } from "@/lib/catalogue-queries";
import { queryKeys } from "@/lib/query-keys";
import { fakeApi } from "@/test/fake-api";
import { createTestQueryClient, renderWithQueryClient } from "@/test/query-test-utils";
import { pickOption } from "@/test/select";
import { setupUser } from "@/test/user-event";
import { makeHero, makeItem, makeStashItem } from "@/test/warband-fixtures";

import type { RosterUnit } from "../roster/unit-view";
import LoadoutPanel from "./LoadoutPanel";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const CAMPAIGN = 7;
const WARBAND = 30;
const dagger = makeItem({
  id: 102,
  name: "Dagger",
  type: "Weapon",
  subtype: "Melee",
  strength: "As user",
  rules: [
    {
      id: 4,
      rule_id: 9,
      shared: true,
      name: "Enemy armour save +1",
      summary: "",
      text: "Armour saves against a dagger are one better.",
      table: [],
    },
  ],
});
const club = makeItem({ id: 104, name: "Club", type: "Weapon", subtype: "Melee" });
const vrask: RosterUnit = {
  kind: "hero",
  unit: makeHero({ id: 1, name: "Vrask the Hidden", items: [dagger] }),
} as RosterUnit;
const krekk: RosterUnit = {
  kind: "hero",
  unit: makeHero({ id: 2, name: "Krekk Blackfur" }),
} as RosterUnit;

function renderLoadout(onMove = vi.fn()) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(queryKeys.campaign.warbandStash(CAMPAIGN, WARBAND), [
    makeStashItem({ id: 104, name: "Club", cost: 3 }),
  ]);
  queryClient.setQueryData(catalogueListKey(CAMPAIGN, "items"), [dagger, club]);
  renderWithQueryClient(
    <LoadoutPanel
      campaignId={CAMPAIGN}
      warbandId={WARBAND}
      entry={vrask}
      onOpenChange={vi.fn()}
      canEdit
      units={[vrask, krekk]}
      onMove={onMove}
      onSellFromStash={vi.fn()}
      onOpenStore={vi.fn()}
    />,
    { queryClient }
  );
  return onMove;
}

beforeEach(() => fakeApi.reset());

describe("LoadoutPanel", () => {
  it("shows a carried item's details, then a stash item's in their place", async () => {
    const user = setupUser();
    renderLoadout();

    await user.click(screen.getByRole("button", { name: /^Dagger/ }));
    const info = screen.getByRole("region", { name: "Dagger" });
    expect(within(info).getByText("Enemy armour save +1")).toBeInTheDocument();
    expect(within(info).getByText("Armour saves against a dagger are one better.")).toBeVisible();

    await user.click(screen.getByRole("button", { name: /^Club/ }));
    expect(screen.queryByRole("region", { name: "Dagger" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Club" })).toBeInTheDocument();
  });

  it("gives an item to another hero and to the stash without opening its details", async () => {
    const user = setupUser();
    const onMove = renderLoadout();

    await pickOption(
      user,
      screen.getByRole("combobox", { name: "Give Dagger to" }),
      "Krekk Blackfur"
    );
    await user.click(screen.getByRole("button", { name: "To stash" }));

    expect(onMove).toHaveBeenNthCalledWith(1, vrask, 102, { type: "hero", id: 2 });
    expect(onMove).toHaveBeenNthCalledWith(2, vrask, 102, { type: "stash" });
    expect(screen.queryByRole("region", { name: "Dagger" })).not.toBeInTheDocument();
  });
});
