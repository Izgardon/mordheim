import { screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import UnitSection from "./UnitSection";
import { WarbandCatalogueContext, type WarbandCatalogue } from "./catalogue-context";
import { useUnitSectionEditor } from "@/features/warbands/hooks/units/useUnitSectionEditor";
import { hiredSwordKind } from "@/features/warbands/units/kinds/hired-sword";

import type { WarbandHiredSword } from "@/features/warbands/types/warband-types";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { getFieldNear } from "@/test/roster-queries";
import { setupUser } from "@/test/user-event";
import { humanRace, makeVeteranHiredSword, warhammer } from "@/test/warband-fixtures";

const api = vi.hoisted(() => ({
  createWarbandHiredSword: vi.fn(),
  updateWarbandHiredSword: vi.fn(),
  deleteWarbandHiredSword: vi.fn(),
  getWarbandHiredSwordDetail: vi.fn(),
  getWarbandSummary: vi.fn(),
  createWarbandTrade: vi.fn(),
  createWarbandLog: vi.fn(),
}));
const events = vi.hoisted(() => ({ emitWarbandUpdate: vi.fn() }));
const bestiary = vi.hoisted(() => ({ getHiredSwordProfile: vi.fn() }));
const presets = vi.hoisted(() => ({ list: [] as unknown[] }));

vi.mock("@/features/warbands/api/warbands-api", () => api);
vi.mock("@/features/warbands/units/unit-api", async () =>
  (await import("@/test/unit-api-mock")).unitApiModuleMock(api)
);
vi.mock("@/features/warbands/api/warband-cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/warbands/api/warband-cache")>()),
  useWarbandCacheUpdate: () => events.emitWarbandUpdate,
}));
vi.mock("@/stores/app-store", () => ({
  useAppStore: () => ({ warband: null, diceColor: "#2e8555", campaignStarted: true }),
}));
vi.mock("@/features/bestiary/api/bestiary-api", () => bestiary);
vi.mock("@/lib/catalogue-queries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/catalogue-queries")>()),
  useCatalogue: (kind: string) => ({
    data: kind === "hired-swords" ? presets.list : [],
    isLoading: false,
    error: "",
  }),
}));

const onHiredSwordsChange = vi.fn();

const catalogue: WarbandCatalogue = {
  campaignId: 1,
  availableItems: [],
  availableSkills: [],
  availableSpells: [],
  availableSpecials: [],
  availableRaces: [humanRace],
  itemsError: "",
  skillsError: "",
  spellsError: "",
  specialsError: "",
  racesError: "",
  isItemsLoading: false,
  isSkillsLoading: false,
  isSpellsLoading: false,
  isSpecialsLoading: false,
  isRacesLoading: false,
  canAddCustom: false,
  onRaceCreated: vi.fn(),
};

function Section({
  initialHiredSwords,
  maxHiredSwords = 3,
  canEdit = true,
}: {
  initialHiredSwords: WarbandHiredSword[];
  maxHiredSwords?: number;
  canEdit?: boolean;
}) {
  const [hiredSwords, setHiredSwords] = useState(initialHiredSwords);
  const editor = useUnitSectionEditor(hiredSwordKind, {
    warbandId: 9,
    units: hiredSwords,
    canEdit,
    roster: {
      maxHeroes: 6,
      maxHiredSwords,
      maxUnits: Infinity,
      heroCount: 0,
      henchmanCount: 0,
      bloodPactedCount: 0,
    },
    onUnitsChange: (next) => {
      onHiredSwordsChange(next);
      setHiredSwords(next);
    },
  });
  return (
    <WarbandCatalogueContext.Provider value={catalogue}>
      <UnitSection
        editor={editor}
        units={hiredSwords}
        warbandId={9}
        canEdit={canEdit}
        availableGold={200}
      />
    </WarbandCatalogueContext.Provider>
  );
}

const created = makeVeteranHiredSword({
  id: 33,
  xp: 0,
  level_up: 0,
  caster: "No",
  items: [],
  skills: [],
  spells: [],
  specials: [],
});

const startEditing = async (user: ReturnType<typeof setupUser>) => {
  await user.click(screen.getAllByRole("button", { name: "Edit Hired Swords" })[0]);
  await screen.findByRole("button", { name: "Add hired sword" });
};

const replaceValue = async (
  user: ReturnType<typeof setupUser>,
  field: HTMLElement,
  value: string
) => {
  await user.clear(field);
  await user.type(field, value);
};

const fillNewHiredSword = async (user: ReturnType<typeof setupUser>) => {
  await user.click(screen.getByRole("button", { name: "Add hired sword" }));
  await user.type(screen.getByPlaceholderText("Hired sword name"), "Brother Hal");
  await user.type(screen.getByPlaceholderText("Hired Sword"), "Warrior Priest");
  await user.click(screen.getByPlaceholderText("Search races..."));
  await user.click(screen.getByRole("button", { name: "Human" }));
  await replaceValue(user, getFieldNear("Hire price"), "40");
  await replaceValue(user, getFieldNear("Upkeep price"), "15");
  await replaceValue(user, getFieldNear("Rating"), "25");
};

describe("UnitSection: hired swords create and save", () => {
  beforeAll(() => {
    // The section scrolls a new hired sword's form into view; jsdom has no layout.
    Element.prototype.scrollIntoView = vi.fn();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    presets.list = [];
    api.createWarbandHiredSword.mockResolvedValue(created);
    api.updateWarbandHiredSword.mockImplementation(
      async (_w: number, _id: number, body: object) => ({ ...created, ...body })
    );
    api.getWarbandSummary.mockResolvedValue({ gold: 160 });
  });

  it("POSTs a new hired sword at once, with level_up 0 and skill access as a list (BUG-101)", async () => {
    const user = setupUser();
    renderWithQueryClient(<Section initialHiredSwords={[]} />);
    await startEditing(user);

    await fillNewHiredSword(user);
    await user.click(screen.getByRole("button", { name: "Create hired sword" }));

    await waitFor(() => expect(api.createWarbandHiredSword).toHaveBeenCalledTimes(1));
    expect(api.createWarbandHiredSword).toHaveBeenCalledWith(9, {
      name: "Brother Hal",
      unit_type: "Warrior Priest",
      race: 1,
      price: 40,
      upkeep_price: 15,
      rating: 25,
      xp: 0,
      level_up: 0,
      deeds: null,
      armour_save: null,
      large: false,
      caster: "No",
      half_rate: false,
      no_level_ups: false,
      blood_pacted: false,
      // The same list of type names Save sends (it used to be the raw checkboxes).
      available_skills: [],
      items: [],
      skill_ids: [],
      special_ids: [],
      spell_ids: [],
    });
    expect(events.emitWarbandUpdate).toHaveBeenCalledWith(9, { hiredSwords: [created] });
    expect(onHiredSwordsChange).toHaveBeenLastCalledWith([created]);
    expect(await screen.findByDisplayValue("Brother Hal")).toBeInTheDocument();
  });

  it("sends level_up 0 when a hired sword created this session gets starting XP before Save", async () => {
    const user = setupUser();
    renderWithQueryClient(<Section initialHiredSwords={[]} />);
    await startEditing(user);
    await fillNewHiredSword(user);
    await user.click(screen.getByRole("button", { name: "Create hired sword" }));
    await screen.findByDisplayValue("Brother Hal");

    await replaceValue(user, getFieldNear("Experience"), "6");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(api.updateWarbandHiredSword).toHaveBeenCalledTimes(1));
    expect(api.updateWarbandHiredSword).toHaveBeenCalledWith(
      9,
      33,
      expect.objectContaining({ xp: 6, level_up: 0, available_skills: [] })
    );
    expect(api.getWarbandSummary).toHaveBeenCalledTimes(1);
  });

  it("asks for name, type and race before creating", async () => {
    const user = setupUser();
    renderWithQueryClient(<Section initialHiredSwords={[]} />);
    await startEditing(user);

    await user.click(screen.getByRole("button", { name: "Add hired sword" }));
    await user.click(screen.getByRole("button", { name: "Create hired sword" }));

    expect(screen.getByText("Name, type, and race are required.")).toBeInTheDocument();
    expect(api.createWarbandHiredSword).not.toHaveBeenCalled();
  });

  it("disables Add hired sword at the cap, counting only hired swords without a blood pact", async () => {
    const user = setupUser();
    const hired = makeVeteranHiredSword();
    const pacted = makeVeteranHiredSword({ id: 32, name: "Pacted", blood_pacted: true });
    const { unmount } = renderWithQueryClient(
      <Section initialHiredSwords={[hired, pacted]} maxHiredSwords={1} />
    );
    await startEditing(user);
    expect(screen.getByRole("button", { name: "Add hired sword" })).toBeDisabled();
    unmount();

    renderWithQueryClient(<Section initialHiredSwords={[pacted]} maxHiredSwords={1} />);
    await startEditing(user);
    expect(screen.getByRole("button", { name: "Add hired sword" })).toBeEnabled();
  });

  it("dismisses a hired sword only on Save, though the dialog says it can't be undone (BUG-34, pinned; flips in PR C)", async () => {
    const user = setupUser();
    const hired = makeVeteranHiredSword();
    api.deleteWarbandHiredSword.mockResolvedValue(undefined);
    renderWithQueryClient(<Section initialHiredSwords={[hired]} />);
    await startEditing(user);

    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("This action cannot be undone.");
    await user.click(within(dialog).getByRole("button", { name: "Dismiss hired sword" }));

    expect(api.deleteWarbandHiredSword).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(api.deleteWarbandHiredSword).toHaveBeenCalledWith(9, 31));
    expect(events.emitWarbandUpdate).toHaveBeenCalledWith(9, { summary: { gold: 160 } });
  });

  it("keeps a hired sword created this session when the edit is cancelled (BUG-34, pinned; flips in PR C)", async () => {
    const user = setupUser();
    renderWithQueryClient(<Section initialHiredSwords={[]} />);
    await startEditing(user);
    await fillNewHiredSword(user);
    await user.click(screen.getByRole("button", { name: "Create hired sword" }));
    await screen.findByDisplayValue("Brother Hal");

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(api.deleteWarbandHiredSword).not.toHaveBeenCalled();
    expect(screen.getByText("Brother Hal")).toBeInTheDocument();
  });

  it("shows the roster with Level Up! and Edit only to editors", () => {
    const hired = makeVeteranHiredSword();
    const { unmount } = renderWithQueryClient(<Section initialHiredSwords={[hired]} />);
    expect(screen.getByRole("button", { name: "Level Up!" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Edit Hired Swords" })).toHaveLength(2);
    unmount();

    renderWithQueryClient(<Section initialHiredSwords={[hired]} canEdit={false} />);
    expect(screen.getByText("Brother Hal")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Level Up!" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit Hired Swords" })).not.toBeInTheDocument();
  });

  it("counts only hired swords without a blood pact against the cap in the title", () => {
    renderWithQueryClient(
      <Section
        initialHiredSwords={[
          makeVeteranHiredSword(),
          makeVeteranHiredSword({ id: 32, name: "Pacted", blood_pacted: true }),
        ]}
      />
    );

    expect(screen.getByText("[1/3]")).toBeInTheDocument();
  });

  it("creates a hired sword from a preset with the preset's armour save (BUG-100)", async () => {
    const user = setupUser();
    const entry = {
      name: "Warrior Priest",
      movement: 4,
      weapon_skill: 4,
      ballistic_skill: 3,
      strength: 3,
      toughness: 3,
      wounds: 1,
      initiative: 3,
      attacks: 1,
      leadership: 8,
      armour_save: 5,
      large: false,
      caster: "Priest",
      equipment: [{ item: warhammer }],
      skills: [],
      spells: [],
      specials: [],
    };
    const profile = {
      id: 5,
      race: "Human",
      hire_cost: 40,
      hire_cost_expression: "",
      upkeep_cost: 15,
      upkeep_cost_expression: "",
      rating: 25,
      available_skill_types: ["Combat"],
      restrictions: [],
      bestiary_entry: entry,
    };
    presets.list = [profile];
    bestiary.getHiredSwordProfile.mockResolvedValue(profile);
    renderWithQueryClient(<Section initialHiredSwords={[]} />);
    await startEditing(user);

    await user.click(screen.getByRole("button", { name: "Add hired sword" }));
    await user.click(screen.getByRole("button", { name: /^Warrior Priest/ }));
    await screen.findByDisplayValue("Human");
    await user.click(screen.getByRole("button", { name: "Create hired sword" }));

    await waitFor(() => expect(api.createWarbandHiredSword).toHaveBeenCalledTimes(1));
    expect(bestiary.getHiredSwordProfile).toHaveBeenCalledWith(5);
    expect(api.createWarbandHiredSword).toHaveBeenCalledWith(9, {
      name: "Warrior Priest",
      unit_type: "Warrior Priest",
      race: 1,
      price: 40,
      upkeep_price: 15,
      rating: 25,
      xp: 0,
      level_up: 0,
      deeds: null,
      armour_save: 5,
      large: false,
      caster: "Priest",
      half_rate: false,
      no_level_ups: false,
      blood_pacted: false,
      available_skills: ["Combat"],
      movement: 4,
      weapon_skill: 4,
      ballistic_skill: 3,
      strength: 3,
      toughness: 3,
      wounds: 1,
      initiative: 3,
      attacks: 1,
      leadership: 8,
      items: [{ id: 105, cost: 3 }],
      skill_ids: [],
      special_ids: [],
      spell_ids: [],
    });

    // The edit form shows the stored save, and Save has nothing more to send.
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Create hired sword" })).not.toBeInTheDocument()
    );
    expect(getFieldNear("AS")).toHaveValue(5);
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument()
    );
    expect(api.updateWarbandHiredSword).not.toHaveBeenCalled();
  });
});
