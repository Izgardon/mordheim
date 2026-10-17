import { screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import UnitSection from "./UnitSection";
import { WarbandCatalogueContext, type WarbandCatalogue } from "./catalogue-context";
import { useUnitSectionEditor } from "@/features/warbands/hooks/units/useUnitSectionEditor";
import { henchmenKind } from "@/features/warbands/units/kinds/henchmen";

import type { HenchmenGroup } from "@/features/warbands/types/warband-types";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { getFieldNear } from "@/test/roster-queries";
import { setupUser } from "@/test/user-event";
import { humanRace, makeVeteranHenchmenGroup } from "@/test/warband-fixtures";

const api = vi.hoisted(() => ({
  createWarbandHenchmenGroup: vi.fn(),
  updateWarbandHenchmenGroup: vi.fn(),
  deleteWarbandHenchmenGroup: vi.fn(),
  listWarbandHenchmenGroupDetails: vi.fn(),
  getWarbandHenchmenGroupDetail: vi.fn(),
  getWarbandSummary: vi.fn(),
  createWarbandTrade: vi.fn(),
  createWarbandLog: vi.fn(),
}));
const events = vi.hoisted(() => ({ emitWarbandUpdate: vi.fn() }));

vi.mock("@/features/warbands/api/warbands-api", () => api);
vi.mock("@/features/warbands/units/unit-api", async () =>
  (await import("@/test/unit-api-mock")).unitApiModuleMock(api)
);
vi.mock("@/features/warbands/api/warband-cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/warbands/api/warband-cache")>()),
  useWarbandCacheUpdate: () => events.emitWarbandUpdate,
}));
vi.mock("@/features/warbands/api/warbands-items", () => ({
  listWarbandItems: vi.fn(async () => []),
  removeWarbandItem: vi.fn(),
}));
vi.mock("@/stores/app-store", () => ({
  useAppStore: () => ({ warband: null, diceColor: "#2e8555", campaignStarted: true }),
}));
vi.mock("@/lib/catalogue-queries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/catalogue-queries")>()),
  useCatalogue: () => ({ data: [], isLoading: false, error: "" }),
}));

const onGroupsChanged = vi.fn();

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
  initialGroups,
  maxUnits,
  heroAndBloodPactedCount,
  canEdit = true,
  canLevelUp,
}: {
  initialGroups: HenchmenGroup[];
  maxUnits?: number;
  heroAndBloodPactedCount?: number;
  canEdit?: boolean;
  canLevelUp?: boolean;
}) {
  const [groups, setGroups] = useState(initialGroups);
  const editor = useUnitSectionEditor(henchmenKind, {
    warbandId: 9,
    units: groups,
    canEdit,
    roster: {
      maxHeroes: 6,
      maxHiredSwords: 3,
      maxUnits: maxUnits ?? Infinity,
      heroCount: heroAndBloodPactedCount ?? 0,
      henchmanCount: 0,
      bloodPactedCount: 0,
    },
    onUnitsChange: (next) => {
      onGroupsChanged(next);
      setGroups(next);
    },
  });
  return (
    <WarbandCatalogueContext.Provider value={catalogue}>
      <UnitSection
        editor={editor}
        units={groups}
        warbandId={9}
        canEdit={canEdit}
        canLevelUp={canLevelUp}
        availableGold={200}
      />
    </WarbandCatalogueContext.Provider>
  );
}

const created = makeVeteranHenchmenGroup({
  id: 23,
  name: "Crossbowmen",
  unit_type: "Marksmen",
  price: 25,
  xp: 0,
  level_up: 0,
  max_size: 4,
  items: [],
  skills: [],
  specials: [],
  henchmen: [{ id: 81, name: "Bolt", kills: 0, dead: false }],
});

const startEditing = async (user: ReturnType<typeof setupUser>) => {
  await user.click(screen.getAllByRole("button", { name: "Edit Henchmen" })[0]);
  await screen.findByRole("button", { name: "Add group" });
};

const fillNewGroup = async (user: ReturnType<typeof setupUser>) => {
  await user.click(screen.getByRole("button", { name: "Add group" }));
  await user.type(screen.getByPlaceholderText("Group name"), "Crossbowmen");
  await user.type(screen.getByPlaceholderText("Swordsmen, Verminkin"), "Marksmen");
  await user.click(screen.getByPlaceholderText("Search races..."));
  await user.click(screen.getByRole("button", { name: "Human" }));
  await user.type(screen.getByPlaceholderText("Henchman name"), "Bolt");
  const maxSize = screen.getByPlaceholderText("5");
  await user.clear(maxSize);
  await user.type(maxSize, "4");
  const baseCost = screen.getByPlaceholderText("0");
  await user.clear(baseCost);
  await user.type(baseCost, "25");
};

describe("UnitSection: henchmen create and save", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.createWarbandHenchmenGroup.mockResolvedValue(created);
    api.updateWarbandHenchmenGroup.mockImplementation(
      async (_w: number, _id: number, body: object) => ({ ...created, ...body })
    );
    api.getWarbandSummary.mockResolvedValue({ gold: 175 });
  });

  it("starts editing from the groups it shows, without loading them again (PERF-26)", async () => {
    const user = setupUser();
    renderWithQueryClient(<Section initialGroups={[makeVeteranHenchmenGroup()]} />);

    await startEditing(user);

    expect(screen.getByDisplayValue("Black Knives")).toBeInTheDocument();
    expect(api.listWarbandHenchmenGroupDetails).not.toHaveBeenCalled();
    expect(api.getWarbandHenchmenGroupDetail).not.toHaveBeenCalled();
  });

  it("POSTs a new group at once with its first henchman and level_up 0", async () => {
    const user = setupUser();
    renderWithQueryClient(<Section initialGroups={[]} />);
    await startEditing(user);

    await fillNewGroup(user);
    await user.click(screen.getByRole("button", { name: "Create group" }));

    await waitFor(() => expect(api.createWarbandHenchmenGroup).toHaveBeenCalledTimes(1));
    expect(api.createWarbandHenchmenGroup).toHaveBeenCalledWith(9, {
      name: "Crossbowmen",
      unit_type: "Marksmen",
      race: 1,
      price: 25,
      xp: 0,
      level_up: 0,
      max_size: 4,
      deeds: null,
      armour_save: null,
      large: false,
      half_rate: false,
      no_level_ups: false,
      items: [],
      skill_ids: [],
      special_ids: [],
      henchmen: [{ name: "Bolt", kills: 0, dead: false }],
    });
    expect(events.emitWarbandUpdate).toHaveBeenCalledWith(9, { henchmenGroups: [created] });
    expect(onGroupsChanged).toHaveBeenLastCalledWith([created]);
    expect(await screen.findByDisplayValue("Crossbowmen")).toBeInTheDocument();
  });

  it("sends nothing more on Save right after Create", async () => {
    const user = setupUser();
    renderWithQueryClient(<Section initialGroups={[]} />);
    await startEditing(user);
    await fillNewGroup(user);
    await user.click(screen.getByRole("button", { name: "Create group" }));
    await screen.findByDisplayValue("Crossbowmen");

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument()
    );
    expect(api.updateWarbandHenchmenGroup).not.toHaveBeenCalled();
    expect(api.getWarbandSummary).not.toHaveBeenCalled();
  });

  it("sends level_up 0 when a group created this session gets starting XP before Save", async () => {
    const user = setupUser();
    renderWithQueryClient(<Section initialGroups={[]} />);
    await startEditing(user);
    await fillNewGroup(user);
    await user.click(screen.getByRole("button", { name: "Create group" }));
    await screen.findByDisplayValue("Crossbowmen");

    const xp = getFieldNear("Experience");
    await user.clear(xp);
    await user.type(xp, "6");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(api.updateWarbandHenchmenGroup).toHaveBeenCalledTimes(1));
    expect(api.updateWarbandHenchmenGroup).toHaveBeenCalledWith(
      9,
      23,
      expect.objectContaining({ xp: 6, level_up: 0 })
    );
    expect(api.getWarbandSummary).toHaveBeenCalledTimes(1);
  });

  it("keeps a group created this session when the edit is cancelled (BUG-34, pinned; flips in PR C)", async () => {
    const user = setupUser();
    renderWithQueryClient(<Section initialGroups={[]} />);
    await startEditing(user);
    await fillNewGroup(user);
    await user.click(screen.getByRole("button", { name: "Create group" }));
    await screen.findByDisplayValue("Crossbowmen");

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(api.deleteWarbandHenchmenGroup).not.toHaveBeenCalled();
    expect(screen.getByText("Crossbowmen")).toBeInTheDocument();
  });

  it("asks for name, type and race before creating", async () => {
    const user = setupUser();
    renderWithQueryClient(<Section initialGroups={[]} />);
    await startEditing(user);

    await user.click(screen.getByRole("button", { name: "Add group" }));
    await user.click(screen.getByRole("button", { name: "Create group" }));

    expect(screen.getByText("Name, type, and race are required.")).toBeInTheDocument();
    expect(api.createWarbandHenchmenGroup).not.toHaveBeenCalled();
  });

  it("asks for the first henchman's name before creating", async () => {
    const user = setupUser();
    renderWithQueryClient(<Section initialGroups={[]} />);
    await startEditing(user);
    await fillNewGroup(user);

    await user.clear(screen.getByDisplayValue("Bolt"));
    await user.click(screen.getByRole("button", { name: "Create group" }));

    expect(screen.getByText("First henchman name is required.")).toBeInTheDocument();
    expect(api.createWarbandHenchmenGroup).not.toHaveBeenCalled();
  });

  it("disables Add group at the warband unit limit", async () => {
    const user = setupUser();
    renderWithQueryClient(
      <Section
        initialGroups={[makeVeteranHenchmenGroup()]}
        maxUnits={5}
        heroAndBloodPactedCount={2}
      />
    );

    await startEditing(user);

    expect(screen.getByRole("button", { name: "Add group" })).toBeDisabled();
    expect(screen.getByText("Warband unit limit of 5 reached.")).toBeInTheDocument();
  });

  it("disbands a group only on Save, though the dialog says it can't be undone (BUG-34, pinned; flips in PR C)", async () => {
    const user = setupUser();
    const group = makeVeteranHenchmenGroup();
    api.deleteWarbandHenchmenGroup.mockResolvedValue(undefined);
    renderWithQueryClient(<Section initialGroups={[group]} />);
    await startEditing(user);

    await user.click(screen.getByRole("button", { name: "Disband" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(
      "Are you sure you want to disband Black Knives? This action cannot be undone."
    );
    await user.click(within(dialog).getByRole("button", { name: "Disband group" }));

    expect(api.deleteWarbandHenchmenGroup).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(api.deleteWarbandHenchmenGroup).toHaveBeenCalledWith(9, 21));
    expect(events.emitWarbandUpdate).toHaveBeenCalledWith(9, { summary: { gold: 175 } });
  });

  it("keeps a disbanded group when the edit is cancelled", async () => {
    const user = setupUser();
    const group = makeVeteranHenchmenGroup();
    renderWithQueryClient(<Section initialGroups={[group]} />);
    await startEditing(user);

    await user.click(screen.getByRole("button", { name: "Disband" }));
    await user.click(await screen.findByRole("button", { name: "Disband group" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(api.deleteWarbandHenchmenGroup).not.toHaveBeenCalled();
    expect(screen.getByText("Black Knives")).toBeInTheDocument();
  });

  it("shows the roster with Level Up! and Edit only to editors", () => {
    const group = makeVeteranHenchmenGroup();
    const { unmount } = renderWithQueryClient(<Section initialGroups={[group]} />);
    expect(screen.getByRole("button", { name: "Level Up!" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Edit Henchmen" })).toHaveLength(2);
    expect(screen.getByText("[3]")).toBeInTheDocument();
    unmount();

    renderWithQueryClient(<Section initialGroups={[group]} canEdit={false} />);
    expect(screen.getByText("Black Knives")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Level Up!" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit Henchmen" })).not.toBeInTheDocument();
  });

  it("shows Level Up! from the level_up capability, not from edit (BUG-31)", () => {
    renderWithQueryClient(
      <Section initialGroups={[makeVeteranHenchmenGroup()]} canEdit canLevelUp={false} />
    );

    expect(screen.getAllByRole("button", { name: "Edit Henchmen" })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Level Up!" })).not.toBeInTheDocument();
  });

  it("says when there are no groups yet", () => {
    renderWithQueryClient(<Section initialGroups={[]} />);

    expect(screen.getByText("No henchmen groups yet.")).toBeInTheDocument();
  });
});
