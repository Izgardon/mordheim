/**
 * ROST-NEW-02: a catalogue entry created from inside one unit's edit card is offered in every
 * other unit's pickers straight away. The real catalogue (TanStack queries behind
 * WarbandCatalogueProvider) and the real create dialogs run; only the HTTP calls are mocked.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import UnitSection from "./UnitSection";
import { WarbandCatalogueProvider } from "./catalogue-context";
import { useUnitSectionEditor } from "@/features/warbands/hooks/units/useUnitSectionEditor";
import { hiredSwordKind } from "@/features/warbands/units/kinds/hired-sword";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";
import {
  humanRace,
  makeItem,
  makeSkill,
  makeSpecial,
  makeSpell,
  makeVeteranHiredSword,
} from "@/test/warband-fixtures";

import type { WarbandHiredSword } from "@/features/warbands/types/warband-types";

const catalogue = vi.hoisted(() => ({
  listItems: vi.fn(),
  listItemProperties: vi.fn(),
  listRestrictions: vi.fn(),
  createItem: vi.fn(),
  listSkills: vi.fn(),
  createSkill: vi.fn(),
  listSpells: vi.fn(),
  createSpell: vi.fn(),
  listSpecial: vi.fn(),
  createSpecial: vi.fn(),
  listRaces: vi.fn(),
  createRace: vi.fn(),
}));

vi.mock("@/features/items/api/items-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/items/api/items-api")>()),
  listItems: catalogue.listItems,
  listItemProperties: catalogue.listItemProperties,
  listRestrictions: catalogue.listRestrictions,
  createItem: catalogue.createItem,
}));
vi.mock("@/features/skills/api/skills-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/skills/api/skills-api")>()),
  listSkills: catalogue.listSkills,
  createSkill: catalogue.createSkill,
}));
vi.mock("@/features/spells/api/spells-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/spells/api/spells-api")>()),
  listSpells: catalogue.listSpells,
  createSpell: catalogue.createSpell,
}));
vi.mock("@/features/special/api/special-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/special/api/special-api")>()),
  listSpecial: catalogue.listSpecial,
  createSpecial: catalogue.createSpecial,
}));
vi.mock("@/features/races/api/races-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/races/api/races-api")>()),
  listRaces: catalogue.listRaces,
  createRace: catalogue.createRace,
}));
vi.mock("@/features/bestiary/api/bestiary-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/bestiary/api/bestiary-api")>()),
  listHiredSwordProfiles: vi.fn(async () => []),
}));
// Creating an item goes on to its buy dialog for that card, which isn't what this file tests.
vi.mock("@/features/items/components/AcquireItemDialog/AcquireItemDialog", () => ({
  default: () => null,
}));
vi.mock("@/stores/app-store", () => ({
  useAppStore: () => ({
    warband: { id: 9, campaign_id: 1, gold: 500 },
    diceColor: "#2e8555",
    campaignStarted: true,
  }),
}));

const first = makeVeteranHiredSword({ id: 31, name: "Brother Hal", caster: "Wizard" });
const second = makeVeteranHiredSword({ id: 32, name: "Sister Ana", caster: "Wizard" });

function Section({ hiredSwords }: { hiredSwords: WarbandHiredSword[] }) {
  const [units, setUnits] = useState(hiredSwords);
  const editor = useUnitSectionEditor(hiredSwordKind, {
    warbandId: 9,
    units,
    canEdit: true,
    roster: { maxHeroes: 6, maxHiredSwords: 3, heroCount: 0, hiredSwordCount: 0 },
    onUnitsChange: setUnits,
  });
  return (
    <WarbandCatalogueProvider campaignId={1} canAddCustom>
      <UnitSection editor={editor} units={units} warbandId={9} canEdit availableGold={500} />
    </WarbandCatalogueProvider>
  );
}

type User = ReturnType<typeof setupUser>;

/** Each edit card, in roster order. */
const editCards = () => screen.getAllByRole("group", { name: /^Hired Sword \d+$/ });

const startEditing = async (user: User) => {
  renderWithQueryClient(<Section hiredSwords={[first, second]} />);
  await user.click(screen.getAllByRole("button", { name: "Edit Hired Swords" })[0]);
  await waitFor(() => expect(editCards()).toHaveLength(2));
  await waitFor(() => expect(screen.queryByText(/^Loading /)).not.toBeInTheDocument());
  // From here on a background refetch never answers: what the next card offers comes from the
  // cache write the create made, not from reloading the list.
  for (const list of [
    catalogue.listItems,
    catalogue.listSkills,
    catalogue.listSpells,
    catalogue.listSpecial,
    catalogue.listRaces,
  ]) {
    list.mockImplementation(() => new Promise(() => undefined));
  }
};

/** The search box around a field: the nearest container that also holds its Create button. */
const searchBox = (card: HTMLElement, placeholder: string) => {
  let node = within(card).getByPlaceholderText(placeholder).parentElement;
  while (node && !within(node).queryByRole("button", { name: /^Create (new|race)$/ })) {
    node = node.parentElement;
  }
  return node as HTMLElement;
};

/** Opens a card's loadout tab and its search, as a player looking for an entry does. */
const openPicker = async (user: User, card: HTMLElement, tab: string, add: string) => {
  await user.click(within(card).getByRole("button", { name: tab }));
  await user.click(within(card).getByRole("button", { name: add }));
};

const commitType = async (user: User, dialog: HTMLElement, placeholder: string, add: string) => {
  await user.type(within(dialog).getByPlaceholderText(placeholder), "Homebrew");
  await user.click(within(dialog).getByRole("button", { name: add }));
};

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.releasePointerCapture = vi.fn();
});

/** The server's lists: a create adds to them, so a background refetch keeps the new entry. */
const server = {
  items: [] as unknown[],
  skills: [] as unknown[],
  spells: [] as unknown[],
  specials: [] as unknown[],
  races: [] as unknown[],
};
const listOf = (list: keyof typeof server) => async () => [...server[list]];
const createIn = (list: keyof typeof server, entry: () => unknown) => async () => {
  server[list].push(entry());
  return entry();
};

beforeEach(() => {
  vi.clearAllMocks();
  server.items = [makeItem({ id: 101, name: "Sword" })];
  server.skills = [makeSkill({ id: 201, name: "Strongman" })];
  server.spells = [makeSpell({ id: 301, name: "Fireball" })];
  server.specials = [makeSpecial({ id: 401, name: "Scar" })];
  server.races = [humanRace];
  catalogue.listItems.mockImplementation(listOf("items"));
  catalogue.listItemProperties.mockResolvedValue([]);
  catalogue.listRestrictions.mockResolvedValue([]);
  catalogue.listSkills.mockImplementation(listOf("skills"));
  catalogue.listSpells.mockImplementation(listOf("spells"));
  catalogue.listSpecial.mockImplementation(listOf("specials"));
  catalogue.listRaces.mockImplementation(listOf("races"));
});

describe("catalogue entries created mid-edit (ROST-NEW-02)", () => {
  it("offers a skill created on one card in the next card's skill picker", async () => {
    const user = setupUser();
    catalogue.createSkill.mockImplementation(
      createIn("skills", () => makeSkill({ id: 250, name: "Quick Hands", type: "Homebrew" }))
    );
    await startEditing(user);
    const [cardA, cardB] = editCards();

    await openPicker(user, cardA, "Skills", "+ Add skill");
    await user.click(
      within(searchBox(cardA, "Search skills...")).getByRole("button", { name: "Create new" })
    );
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByPlaceholderText("Quick Hands"), "Quick Hands");
    await commitType(user, dialog, "Search or add a list", "Add custom list");
    await user.type(within(dialog).getByPlaceholderText("Describe the skill."), "Fast.");
    await user.click(within(dialog).getByRole("button", { name: "Add skill" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await openPicker(user, cardB, "Skills", "+ Add skill");
    expect(within(cardB).getByRole("button", { name: /Quick Hands/ })).toBeInTheDocument();
  });

  it("offers a spell created on one card in the next card's spell picker", async () => {
    const user = setupUser();
    catalogue.createSpell.mockImplementation(
      createIn("spells", () => makeSpell({ id: 350, name: "Ember Ward", type: "Homebrew" }))
    );
    await startEditing(user);
    const [cardA, cardB] = editCards();

    await openPicker(user, cardA, "Spells", "+ Add spell");
    await user.click(
      within(searchBox(cardA, "Search spells...")).getByRole("button", { name: "Create new" })
    );
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByPlaceholderText("Fireball"), "Ember Ward");
    await commitType(user, dialog, "Search or add a class", "Add custom class");
    await user.type(within(dialog).getByPlaceholderText("Describe the spell."), "Warm.");
    await user.click(within(dialog).getByRole("button", { name: "Add spell" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await openPicker(user, cardB, "Spells", "+ Add spell");
    expect(within(cardB).getByRole("button", { name: /Ember Ward/ })).toBeInTheDocument();
  });

  it("offers a special created on one card in the next card's special picker", async () => {
    const user = setupUser();
    catalogue.createSpecial.mockImplementation(
      createIn("specials", () => makeSpecial({ id: 450, name: "Blessing", type: "Homebrew" }))
    );
    await startEditing(user);
    const [cardA, cardB] = editCards();

    await openPicker(user, cardA, "Special", "+ Add special");
    await user.click(
      within(searchBox(cardA, "Search specials...")).getByRole("button", { name: "Create new" })
    );
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByPlaceholderText("Blessing"), "Blessing");
    await commitType(user, dialog, "Search or add a special", "Add custom category");
    await user.type(within(dialog).getByPlaceholderText("Describe the entry."), "Holy.");
    await user.click(within(dialog).getByRole("button", { name: "Add entry" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await openPicker(user, cardB, "Special", "+ Add special");
    expect(within(cardB).getByRole("button", { name: /Blessing/ })).toBeInTheDocument();
  });

  it("offers a race created on one card in the next card's race picker", async () => {
    const user = setupUser();
    catalogue.createRace.mockImplementation(
      createIn("races", () => ({ ...humanRace, id: 7, name: "Ogre" }))
    );
    await startEditing(user);
    const [cardA, cardB] = editCards();

    await user.click(
      within(searchBox(cardA, "Search races...")).getByRole("button", { name: "Create race" })
    );
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByPlaceholderText("Human"), "Ogre");
    await user.click(within(dialog).getByRole("button", { name: "Add race" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    const raceSearch = within(cardB).getByPlaceholderText("Search races...");
    await user.clear(raceSearch);
    expect(within(cardB).getByRole("option", { name: "Ogre" })).toBeInTheDocument();
  });

  it("offers an item created on one card in the next card's item picker", async () => {
    const user = setupUser();
    catalogue.createItem.mockImplementation(
      createIn("items", () => makeItem({ id: 150, name: "Gutterblade", type: "Weapon" }))
    );
    await startEditing(user);
    const [cardA, cardB] = editCards();

    await openPicker(user, cardA, "Items", "+ Add item");
    await user.click(
      within(searchBox(cardA, "Search items...")).getByRole("button", { name: "Create new" })
    );
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByPlaceholderText("Gutterblade"), "Gutterblade");
    // Radix Select: open it from the keyboard and take the first type.
    within(dialog).getByRole("combobox", { name: "Type" }).focus();
    await user.keyboard("{Enter}");
    await screen.findAllByRole("option");
    await user.keyboard("{Enter}");
    expect(within(dialog).getByRole("combobox", { name: "Type" })).not.toHaveTextContent(
      "Select a type"
    );
    await user.type(within(dialog).getByPlaceholderText("25"), "5");
    await user.type(within(dialog).getByPlaceholderText("2"), "2");
    await user.click(within(dialog).getByRole("button", { name: "Add item" }));
    await waitFor(() => expect(catalogue.createItem).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await openPicker(user, cardB, "Items", "+ Add item");
    expect(within(cardB).getByRole("button", { name: /Gutterblade/ })).toBeInTheDocument();
  });
});
