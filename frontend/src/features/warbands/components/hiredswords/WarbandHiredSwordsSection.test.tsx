import { screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import WarbandHiredSwordsSection from "./WarbandHiredSwordsSection";
import { skillFields, statFields } from "@/features/warbands/utils/warband-utils";

import type { WarbandHiredSword } from "@/features/warbands/types/warband-types";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { getFieldNear } from "@/test/roster-queries";
import { setupUser } from "@/test/user-event";
import { humanRace, makeVeteranHiredSword } from "@/test/warband-fixtures";

const api = vi.hoisted(() => ({
  createWarbandHiredSword: vi.fn(),
  updateWarbandHiredSword: vi.fn(),
  deleteWarbandHiredSword: vi.fn(),
  listWarbandHiredSwordDetails: vi.fn(),
  getWarbandHiredSwordDetail: vi.fn(),
  getWarbandSummary: vi.fn(),
  createWarbandTrade: vi.fn(),
  createWarbandLog: vi.fn(),
}));
const events = vi.hoisted(() => ({ emitWarbandUpdate: vi.fn() }));

vi.mock("@/features/warbands/api/warbands-api", () => api);
vi.mock("@/features/warbands/api/warbands-events", () => events);
vi.mock("@/stores/app-store", () => ({
  useAppStore: () => ({ warband: null, diceColor: "#2e8555", campaignStarted: true }),
}));
vi.mock("@/lib/catalogue-queries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/catalogue-queries")>()),
  useCatalogue: () => ({ data: [], isLoading: false, error: "" }),
}));

const onHiredSwordsChange = vi.fn();

function Section({
  initialHiredSwords,
  maxHiredSwords = 3,
}: {
  initialHiredSwords: WarbandHiredSword[];
  maxHiredSwords?: number;
}) {
  const [hiredSwords, setHiredSwords] = useState(initialHiredSwords);
  return (
    <WarbandHiredSwordsSection
      warbandId={9}
      hiredSwords={hiredSwords}
      canEdit
      maxHiredSwords={maxHiredSwords}
      availableItems={[]}
      availableSkills={[]}
      availableSpells={[]}
      availableSpecials={[]}
      availableRaces={[humanRace]}
      onItemCreated={vi.fn()}
      itemsError=""
      skillsError=""
      spellsError=""
      specialsError=""
      racesError=""
      isItemsLoading={false}
      isSkillsLoading={false}
      isSpellsLoading={false}
      isSpecialsLoading={false}
      isRacesLoading={false}
      campaignId={1}
      statFields={statFields}
      skillFields={skillFields}
      onRaceCreated={vi.fn()}
      availableGold={200}
      onHiredSwordsChange={(next) => {
        onHiredSwordsChange(next);
        setHiredSwords(next);
      }}
    />
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

describe("WarbandHiredSwordsSection create and save", () => {
  beforeAll(() => {
    // The section scrolls a new hired sword's form into view; jsdom has no layout.
    Element.prototype.scrollIntoView = vi.fn();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    api.listWarbandHiredSwordDetails.mockResolvedValue([]);
    api.createWarbandHiredSword.mockResolvedValue(created);
    api.updateWarbandHiredSword.mockImplementation(
      async (_w: number, _id: number, body: object) => ({ ...created, ...body })
    );
    api.getWarbandSummary.mockResolvedValue({ gold: 160 });
  });

  it("POSTs a new hired sword at once, with level_up 0 and skill access as a checkbox dict", async () => {
    const user = setupUser();
    renderWithQueryClient(<Section initialHiredSwords={[]} />);
    await startEditing(user);

    await fillNewHiredSword(user);
    await user.click(screen.getByRole("button", { name: "Create hired sword" }));

    await waitFor(() => expect(api.createWarbandHiredSword).toHaveBeenCalledTimes(1));
    expect(api.createWarbandHiredSword).toHaveBeenCalledWith(
      9,
      {
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
        // The save hook sends a list of type names; the create path sends the raw checkboxes.
        available_skills: { C: false, Sh: false, A: false, St: false, Sp: false, Spc: false },
        items: [],
        skill_ids: [],
        special_ids: [],
        spell_ids: [],
      },
      { emitUpdate: false }
    );
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
    api.listWarbandHiredSwordDetails.mockResolvedValue([hired, pacted]);
    const { unmount } = renderWithQueryClient(
      <Section initialHiredSwords={[hired, pacted]} maxHiredSwords={1} />
    );
    await startEditing(user);
    expect(screen.getByRole("button", { name: "Add hired sword" })).toBeDisabled();
    unmount();

    api.listWarbandHiredSwordDetails.mockResolvedValue([pacted]);
    renderWithQueryClient(<Section initialHiredSwords={[pacted]} maxHiredSwords={1} />);
    await startEditing(user);
    expect(screen.getByRole("button", { name: "Add hired sword" })).toBeEnabled();
  });

  it("dismisses a hired sword only on Save, though the dialog says it can't be undone (BUG-34, pinned; flips in PR C)", async () => {
    const user = setupUser();
    const hired = makeVeteranHiredSword();
    api.listWarbandHiredSwordDetails.mockResolvedValue([hired]);
    api.deleteWarbandHiredSword.mockResolvedValue(undefined);
    renderWithQueryClient(<Section initialHiredSwords={[hired]} />);
    await startEditing(user);

    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("This action cannot be undone.");
    await user.click(within(dialog).getByRole("button", { name: "Dismiss hired sword" }));

    expect(api.deleteWarbandHiredSword).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(api.deleteWarbandHiredSword).toHaveBeenCalledWith(9, 31, { emitUpdate: false })
    );
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
});
