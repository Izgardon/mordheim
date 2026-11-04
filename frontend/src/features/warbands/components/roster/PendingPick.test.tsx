/**
 * A pick an advance left, made from the card (William: "text here stays, should not mention the new
 * spell as i am selecting a skill ... i also shouldnt see skills that arent part of my campaign"):
 * the line above Confirm says only what this pick gives, and the skill picker offers only the
 * campaign's skills, "Show all" included. A boon or bane is a general rule (William: "can we not
 * show the hired swords/dramatis ones here").
 */
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";
import { skillGroup } from "@/test/catalogue-fixtures";
import { makeHero } from "@/test/warband-fixtures";

import PendingPick from "./PendingPick";
import type { PendingList } from "./unit-view";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const LORE = "Necromancy";
const hero = makeHero({
  id: 5,
  caster: "Wizard",
  available_skills: ["Combat"],
  spells: [{ id: 70, name: "Lifestealer", type: LORE, dc: "10", roll: 2 }],
});

const pick = (list: PendingList) => (
  <PendingPick
    campaignId={1}
    list={list}
    entry={{ kind: "hero", unit: hero }}
    onPick={vi.fn()}
    onClose={vi.fn()}
  />
);

describe("A pick left for later", () => {
  beforeEach(() => {
    fakeApi.reset();
    fakeApi.on("GET /spells/?campaign_id=1", [
      { id: 70, name: "Lifestealer", type: LORE, dc: "10", roll: 2 },
      { id: 71, name: "Deathly Visage", type: LORE, dc: "6", roll: 6 },
    ]);
    fakeApi.on("GET /skills/?campaign_id=1", [
      { id: 3, name: "Strike to Injure", description: "Harder.", in_play: true },
      { id: 4, name: "Sprint", description: "Faster.", in_play: true },
      { id: 5, name: "Sand Walker", description: "Khemri.", in_play: false },
    ]);
    fakeApi.on("GET /skill-groups/?campaign_id=1", [
      skillGroup({ id: 10, name: "Combat", skill_ids: [3] }),
      skillGroup({ id: 11, name: "Speed", skill_ids: [4, 5] }),
    ]);
  });

  it("says only what the current pick gives when a skill follows a spell", async () => {
    const user = setupUser();
    const { rerender } = renderWithQueryClient(pick("spells"));
    const table = await screen.findByRole("table", { name: `${LORE} spells` });
    await user.click(await within(table).findByRole("button", { name: "Deathly Visage" }));
    expect(screen.getByText("New spell: Deathly Visage")).toBeInTheDocument();

    rerender(pick("skills"));
    expect(screen.getByText("Pick a new skill")).toBeInTheDocument();
    expect(screen.queryByText(/New spell/)).not.toBeInTheDocument();
  });

  it("offers only the campaign's skills, his groups first and the rest behind Show all", async () => {
    const user = setupUser();
    renderWithQueryClient(pick("skills"));
    expect(await screen.findByRole("option", { name: /Strike to Injure/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Sprint/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show all" }));
    expect(screen.getByRole("option", { name: /Sprint/ })).toHaveTextContent(
      "Not in his skill groups"
    );
    expect(screen.queryByRole("option", { name: /Sand Walker/ })).not.toBeInTheDocument();
  });

  it("offers general boons and banes, not a hired sword's, dramatis persona's or template fighter's own", async () => {
    fakeApi.on("GET /special/?campaign_id=1", [
      { id: 80, name: "Hatred", type: "Psychology", kind: "boon", owner_kind: "general" },
      { id: 81, name: "Stupid", type: "Animal", kind: "bane" },
      { id: 82, name: "Spy", type: "Hired Sword - Freelance Knight", owner_kind: "hired_sword" },
      {
        id: 83,
        name: "Witch Sense",
        type: "Dramatis Persona - Bertha",
        owner_kind: "dramatis_persona",
      },
      { id: 84, name: "Old Battle Wound", type: "Injury", kind: "bane", owner_kind: "general" },
      { id: 85, name: "Expert Swordsmen", type: "Warband - Mercenaries", owner_kind: "warband" },
    ]);
    renderWithQueryClient(pick("specials"));
    await screen.findByRole("option", { name: /Hatred/ });
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      expect.stringContaining("Hatred"),
      expect.stringContaining("Stupid"),
    ]);
  });
});
