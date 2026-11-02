/**
 * The advance guides the player (William: "no information about what will be received or why, and
 * it doesnt allow things to be chosen within that modal which is the entire point"): the rolled
 * row of the table, the follow-up it asks for, the stat against his race maximum, and a skill
 * picked in the dialog, all saved as one level-up.
 */
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";
import { makeHero } from "@/test/warband-fixtures";

import AdvanceDialog from "./AdvanceDialog";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("../../api/warband-cache", () => ({ useWarbandCacheUpdate: () => () => undefined }));

const hero = makeHero({ id: 5, name: "Aldric Voss", level_up: 1, weapon_skill: 3 });

const open = () =>
  renderWithQueryClient(
    <AdvanceDialog
      entry={{ kind: "hero", unit: hero }}
      campaignId={1}
      warbandId={9}
      heroes={[hero]}
      maxHeroes={6}
      onClose={vi.fn()}
    />
  );

describe("The advance dialog", () => {
  beforeEach(() => fakeApi.reset());

  it("shows the rolled row, asks WS or BS on a 7 and saves the choice with the roll", async () => {
    fakeApi.on("POST /warbands/9/heroes/5/level-up/", hero);
    open();
    const user = setupUser();
    await user.type(screen.getByLabelText("2D6 rolled"), "7");
    const table = screen.getByRole("table", { name: "Hero advance table" });
    expect(within(table).getByRole("row", { current: true })).toHaveTextContent(
      "+1 Weapon Skill or +1 Ballistic Skill"
    );
    await user.click(screen.getByRole("button", { name: "+1 Weapon Skill" }));
    expect(screen.getAllByText("WS 3 → 4").length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(fakeApi.bodyOf("POST /warbands/9/heroes/5/level-up/")).toEqual({
      payload: {
        hero: "Aldric Voss",
        advance: { id: "WS", label: "Weapon Skill" },
        roll1: { dice: "2d6", result: { total: 7 } },
      },
    });
  });

  it("picks a new skill from his list inside the dialog", async () => {
    fakeApi.on("GET /skills/?campaign_id=1", [
      { id: 3, name: "Strike to Injure", type: "Combat", description: "Wounds harder." },
      { id: 4, name: "Sprint", type: "Speed", description: "Runs further." },
    ]);
    fakeApi.on("POST /warbands/9/heroes/5/level-up/", hero);
    open();
    const user = setupUser();
    await user.type(screen.getByLabelText("2D6 rolled"), "4");
    await user.click(await screen.findByRole("option", { name: /Strike to Injure/ }));
    expect(screen.getByText("New skill: Strike to Injure")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(fakeApi.bodyOf("POST /warbands/9/heroes/5/level-up/")).toMatchObject({
      payload: { advance: { id: "Skill" } },
      pick: { list: "skills", id: 3 },
    });
  });
});
