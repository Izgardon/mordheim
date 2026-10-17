import { screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import UnitSection from "./UnitSection";
import { WarbandCatalogueContext, type WarbandCatalogue } from "./catalogue-context";
import { useUnitSectionEditor } from "@/features/warbands/hooks/units/useUnitSectionEditor";
import { henchmenKind } from "@/features/warbands/units/kinds/henchmen";

import type { ConfirmDiscard } from "@/features/warbands/hooks/warband/useDiscardGuard";
import type { HenchmenGroup } from "@/features/warbands/types/warband-types";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { getFieldNear } from "@/test/roster-queries";
import { setupUser } from "@/test/user-event";
import { ApiError } from "@/lib/api-client";
import { answerBatch, batchCreates, batchDismissals } from "@/test/batch-mock";
import { humanRace, makeVeteranHenchmenGroup } from "@/test/warband-fixtures";

const api = vi.hoisted(() => ({
  batchWarbandHenchmenGroups: vi.fn(),
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
  canEdit = true,
  canLevelUp,
  confirmDiscard,
}: {
  initialGroups: HenchmenGroup[];
  canEdit?: boolean;
  canLevelUp?: boolean;
  confirmDiscard?: ConfirmDiscard;
}) {
  const [groups, setGroups] = useState(initialGroups);
  const editor = useUnitSectionEditor(henchmenKind, {
    warbandId: 9,
    units: groups,
    canEdit,
    confirmDiscard,
    roster: { maxHeroes: 6, maxHiredSwords: 3, heroCount: 0, hiredSwordCount: 0 },
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

const startEditing = async (user: ReturnType<typeof setupUser>) => {
  await user.click(screen.getAllByRole("button", { name: "Edit Henchmen" })[0]);
  await screen.findByRole("button", { name: "Add group" });
};

const fillNewGroup = async (user: ReturnType<typeof setupUser>) => {
  await user.click(screen.getByRole("button", { name: "Add group" }));
  await user.type(screen.getByPlaceholderText("Group name"), "Crossbowmen");
  await user.type(screen.getByPlaceholderText("Swordsmen, Verminkin"), "Marksmen");
  await user.click(screen.getByPlaceholderText("Search races..."));
  await user.click(screen.getByRole("option", { name: "Human" }));
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
    api.batchWarbandHenchmenGroups.mockImplementation(answerBatch([], { gold: 175 }));
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

  it("queues a new group until Save, then creates it in one batch with level_up 0 (decision 1)", async () => {
    const user = setupUser();
    renderWithQueryClient(<Section initialGroups={[]} />);
    await startEditing(user);

    await fillNewGroup(user);
    await user.click(screen.getByRole("button", { name: "Create group" }));

    expect(await screen.findByDisplayValue("Crossbowmen")).toBeInTheDocument();
    expect(screen.getByText("New recruit: 25 gc, paid when you save.")).toBeInTheDocument();
    expect(screen.getByText(/Pending spend: 25 gc/)).toHaveTextContent(
      "Pending spend: 25 gc — Gold after pending: 175 gc"
    );
    expect(api.batchWarbandHenchmenGroups).not.toHaveBeenCalled();

    const xp = getFieldNear("Experience");
    await user.clear(xp);
    await user.type(xp, "6");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(api.batchWarbandHenchmenGroups).toHaveBeenCalledTimes(1));
    expect(batchCreates(api.batchWarbandHenchmenGroups)).toEqual([
      expect.objectContaining({
        name: "Crossbowmen",
        unit_type: "Marksmen",
        race: 1,
        price: 25,
        xp: 6,
        level_up: 0,
        max_size: 4,
        items: [],
        henchmen: [expect.objectContaining({ name: "Bolt", kills: 0, dead: false })],
      }),
    ]);
    expect(api.getWarbandSummary).not.toHaveBeenCalled();
    expect(events.emitWarbandUpdate).toHaveBeenCalledWith(9, { summary: { gold: 175 } });
    expect(onGroupsChanged).toHaveBeenLastCalledWith([
      expect.objectContaining({ id: 900, name: "Crossbowmen" }),
    ]);
  });

  it("shows a refused field on the queued group's card and saves nothing (UX-05)", async () => {
    const user = setupUser();
    api.batchWarbandHenchmenGroups.mockRejectedValue(
      new ApiError("Some of the changes are invalid; nothing was saved.", 400, {
        detail: "Some of the changes are invalid; nothing was saved.",
        code: "invalid",
        fields: { "create.0.max_size": ["Ensure this value is less than or equal to 20."] },
      })
    );
    renderWithQueryClient(<Section initialGroups={[]} />);
    await startEditing(user);
    await fillNewGroup(user);
    await user.click(screen.getByRole("button", { name: "Create group" }));
    await screen.findByDisplayValue("Crossbowmen");

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Max size: Ensure this value is less than or equal to 20."
    );
    expect(
      screen.getByText("Some of the changes are invalid; nothing was saved.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("drops a queued group on Cancel without any request (decision 1, BUG-34)", async () => {
    const user = setupUser();
    renderWithQueryClient(<Section initialGroups={[]} />);
    await startEditing(user);
    await fillNewGroup(user);
    await user.click(screen.getByRole("button", { name: "Create group" }));
    await screen.findByDisplayValue("Crossbowmen");

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(api.batchWarbandHenchmenGroups).not.toHaveBeenCalled();
    expect(screen.queryByText("Crossbowmen")).not.toBeInTheDocument();
    expect(screen.getByText("No henchmen groups yet.")).toBeInTheDocument();
  });

  it("asks for name, type and race before creating", async () => {
    const user = setupUser();
    renderWithQueryClient(<Section initialGroups={[]} />);
    await startEditing(user);

    await user.click(screen.getByRole("button", { name: "Add group" }));
    await user.click(screen.getByRole("button", { name: "Create group" }));

    expect(screen.getByText("Name, type, and race are required.")).toBeInTheDocument();
    expect(screen.queryByText(/New recruit/)).not.toBeInTheDocument();
  });

  it("asks for the first henchman's name before creating", async () => {
    const user = setupUser();
    renderWithQueryClient(<Section initialGroups={[]} />);
    await startEditing(user);
    await fillNewGroup(user);

    await user.clear(screen.getByDisplayValue("Bolt"));
    await user.click(screen.getByRole("button", { name: "Create group" }));

    expect(screen.getByText("First henchman name is required.")).toBeInTheDocument();
    expect(screen.queryByText(/New recruit/)).not.toBeInTheDocument();
  });

  it("never blocks adding a group or a member: size only warns (decision 12)", async () => {
    const user = setupUser();
    // Three living members in a group of max size 2.
    const group = makeVeteranHenchmenGroup({ max_size: 2 });
    renderWithQueryClient(<Section initialGroups={[group]} />);

    await startEditing(user);

    expect(screen.getByRole("status")).toHaveTextContent(
      "This group has 3 henchmen, over its maximum size of 2."
    );
    expect(screen.getByRole("button", { name: "Add group" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "+ Add henchman" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Duplicate Black Knives" })).toBeEnabled();
    expect(screen.queryByText(/unit limit/)).not.toBeInTheDocument();
  });

  it("disbands a group on Save, and the dialog says so and that its items are lost (decision 3, ROST-TWEAK-03, BUG-34)", async () => {
    const user = setupUser();
    const group = makeVeteranHenchmenGroup();
    api.batchWarbandHenchmenGroups.mockImplementation(answerBatch([group], { gold: 175 }));
    renderWithQueryClient(<Section initialGroups={[group]} />);
    await startEditing(user);

    await user.click(screen.getByRole("button", { name: "Disband" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(
      "Are you sure you want to disband Black Knives? The unit is removed when you save, and no gold is refunded."
    );
    expect(dialog).toHaveTextContent(
      "All items this unit carries are lost. Move them to the stash first to keep them."
    );
    await user.click(within(dialog).getByRole("button", { name: "Disband group" }));

    expect(api.batchWarbandHenchmenGroups).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(batchDismissals(api.batchWarbandHenchmenGroups)).toEqual([21]));
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

    expect(api.batchWarbandHenchmenGroups).not.toHaveBeenCalled();
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

  it("tells the page's discard guard whether Cancel would lose edits (decision 2)", async () => {
    const user = setupUser();
    const confirmDiscard = vi.fn<ConfirmDiscard>();
    renderWithQueryClient(
      <Section initialGroups={[makeVeteranHenchmenGroup()]} confirmDiscard={confirmDiscard} />
    );
    await startEditing(user);

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(confirmDiscard).toHaveBeenLastCalledWith(
      expect.objectContaining({
        isDirty: false,
        message: "Discard your unsaved changes to Henchmen?",
      })
    );

    await user.click(screen.getByRole("button", { name: "Disband" }));
    await user.click(await screen.findByRole("button", { name: "Disband group" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(confirmDiscard).toHaveBeenLastCalledWith(expect.objectContaining({ isDirty: true }));
  });

  it("says when there are no groups yet", () => {
    renderWithQueryClient(<Section initialGroups={[]} />);

    expect(screen.getByText("No henchmen groups yet.")).toBeInTheDocument();
  });
});
