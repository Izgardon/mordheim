/**
 * The lad's got talent on a group whose rules say it can't be promoted (`promotable` off, copied
 * from its template fighter) warns and still promotes.
 */
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import type { HenchmenGroup } from "../../types/warband-types";
import LadsGotTalent from "./LadsGotTalent";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const OFFER = "GET /warbands/9/henchmen-groups/4/promote/";

const zombies = {
  id: 4,
  warband_id: 9,
  name: "Zombies",
  unit_type: "Zombie",
  promotable: false,
  henchmen: [{ id: 1, name: "Shambler", dead: false }],
} as unknown as HenchmenGroup;

describe("LadsGotTalent", () => {
  beforeEach(() => {
    fakeApi.reset();
    fakeApi.on(OFFER, { skill_lists: ["Combat", "Academic"], pick: 2 });
  });

  it("offers the heroes' skill lists, and with one on offer asks for one", async () => {
    fakeApi.on(OFFER, { skill_lists: ["Combat"], pick: 1 });
    renderWithQueryClient(
      <LadsGotTalent
        group={{ ...zombies, promotable: true }}
        campaignId={1}
        warbandId={9}
        heroes={[]}
        maxHeroes={6}
        onPromoted={() => undefined}
      />
    );
    expect(await screen.findByRole("button", { name: "Combat" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Academic" })).toBeNull();
    await setupUser().click(screen.getByRole("button", { name: "Shambler" }));
    expect(screen.getByRole("button", { name: "Pick 1 skill list" })).toBeDisabled();
  });

  it("warns when the group can't be promoted in its rules, and still offers the promotion", () => {
    renderWithQueryClient(
      <LadsGotTalent
        group={zombies}
        campaignId={1}
        warbandId={9}
        heroes={[]}
        maxHeroes={6}
        onPromoted={() => undefined}
      />
    );
    expect(screen.getByText("Zombies can't be promoted in their rules.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pick who joins the heroes" })).toBeInTheDocument();
  });

  it("says nothing for a group that can be promoted", () => {
    renderWithQueryClient(
      <LadsGotTalent
        group={{ ...zombies, promotable: true }}
        campaignId={1}
        warbandId={9}
        heroes={[]}
        maxHeroes={6}
        onPromoted={() => undefined}
      />
    );
    expect(screen.queryByText(/can't be promoted/)).toBeNull();
  });
});
