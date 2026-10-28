import { screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import UnitSection from "./UnitSection";
import { WarbandCatalogueContext, type WarbandCatalogue } from "./catalogue-context";
import { useUnitSectionEditor } from "@/features/warbands/hooks/units/useUnitSectionEditor";
import { hirelingKind } from "@/features/warbands/units/kinds/hireling";
import { takesHiredSwordPlace } from "@/features/warbands/units/kinds/hireling-terms";

import type { WarbandHireling } from "@/features/warbands/types/warband-types";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { getFieldNear } from "@/test/roster-queries";
import { setupUser } from "@/test/user-event";
import { humanRace, makeVeteranHireling } from "@/test/warband-fixtures";
import { answerBatch, batchCreates, batchDismissals, batchUpdate } from "@/test/batch-mock";

const api = vi.hoisted(() => ({
  batchWarbandHirelings: vi.fn(),
  getWarbandHirelingDetail: vi.fn(),
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
vi.mock("@/stores/app-store", () => ({
  useAppStore: () => ({ warband: null, diceColor: "#2e8555" }),
}));
vi.mock("@/features/campaigns/hooks/useCampaignStarted", () => ({
  useCampaignStarted: () => true,
}));

const onHirelingsChange = vi.fn();

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
  initialHirelings,
  maxHiredSwords = 3,
  canEdit = true,
}: {
  initialHirelings: WarbandHireling[];
  maxHiredSwords?: number;
  canEdit?: boolean;
}) {
  const [hirelings, setHirelings] = useState(initialHirelings);
  const editor = useUnitSectionEditor(hirelingKind, {
    warbandId: 9,
    units: hirelings,
    canEdit,
    roster: {
      maxHeroes: 6,
      maxHiredSwords,
      heroCount: 0,
      // As the server's summary counts: hired swords without a blood pact.
      hirelingCount: hirelings.filter(takesHiredSwordPlace).length,
    },
    onUnitsChange: (next) => {
      onHirelingsChange(next);
      setHirelings(next);
    },
  });
  return (
    <WarbandCatalogueContext.Provider value={catalogue}>
      <UnitSection
        editor={editor}
        units={hirelings}
        warbandId={9}
        canEdit={canEdit}
        availableGold={200}
      />
    </WarbandCatalogueContext.Provider>
  );
}

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

const fillNewHireling = async (user: ReturnType<typeof setupUser>) => {
  await user.click(screen.getByRole("button", { name: "Add hired sword" }));
  const addForm = screen.getByRole("group", { name: "New Hired Sword" });
  await user.type(within(addForm).getByPlaceholderText("Hired sword name"), "Brother Hal");
  await user.type(within(addForm).getByPlaceholderText("Hired Sword"), "Warrior Priest");
  await user.click(within(addForm).getByPlaceholderText("Search races..."));
  await user.click(within(addForm).getByRole("option", { name: "Human" }));
  await replaceValue(user, getFieldNear("Hire price", addForm), "40");
  await replaceValue(user, getFieldNear("Upkeep price", addForm), "15");
  await replaceValue(user, getFieldNear("Rating", addForm), "25");
};

describe("UnitSection: hired swords create and save", () => {
  beforeAll(() => {
    // The section scrolls a new hired sword's form into view; jsdom has no layout.
    Element.prototype.scrollIntoView = vi.fn();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    api.batchWarbandHirelings.mockImplementation(answerBatch([], { gold: 160 }));
    api.getWarbandSummary.mockResolvedValue({ gold: 160 });
  });

  it("queues a new hired sword until Save, then creates it with level_up 0 and skill access as a list (decision 1, BUG-101)", async () => {
    const user = setupUser();
    renderWithQueryClient(<Section initialHirelings={[]} />);
    await startEditing(user);

    await fillNewHireling(user);
    await user.click(screen.getByRole("button", { name: "Create hired sword" }));

    expect(await screen.findByDisplayValue("Brother Hal")).toBeInTheDocument();
    expect(screen.getByText("New recruit: 40 gc, paid when you save.")).toBeInTheDocument();
    expect(api.batchWarbandHirelings).not.toHaveBeenCalled();

    await replaceValue(user, getFieldNear("Experience"), "6");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(api.batchWarbandHirelings).toHaveBeenCalledTimes(1));
    expect(batchCreates(api.batchWarbandHirelings)).toEqual([
      expect.objectContaining({
        name: "Brother Hal",
        unit_type: "Warrior Priest",
        race: 1,
        price: 40,
        upkeep_price: 15,
        rating: 25,
        xp: 6,
        level_up: 0,
        armour_save: null,
        blood_pacted: false,
        // The same list of type names an update sends (it used to be the raw checkboxes).
        available_skills: [],
        items: [],
      }),
    ]);
    expect(events.emitWarbandUpdate).toHaveBeenCalledWith(9, { summary: { gold: 160 } });
    expect(onHirelingsChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ id: 900, name: "Brother Hal" }),
    ]);
  });

  it("asks for name and type before creating, leaving the race optional", async () => {
    const user = setupUser();
    renderWithQueryClient(<Section initialHirelings={[]} />);
    await startEditing(user);

    await user.click(screen.getByRole("button", { name: "Add hired sword" }));
    await user.click(screen.getByRole("button", { name: "Create hired sword" }));

    expect(screen.getByText("Name and type are required.")).toBeInTheDocument();
    expect(screen.queryByText(/New recruit/)).not.toBeInTheDocument();
  });

  it("at the cap, adds only a blood-pacted hired sword, counting only those without a pact (BUG-102)", async () => {
    const user = setupUser();
    const hired = makeVeteranHireling();
    const pacted = makeVeteranHireling({ id: 32, name: "Pacted", blood_pacted: true });
    renderWithQueryClient(<Section initialHirelings={[hired, pacted]} maxHiredSwords={1} />);
    await startEditing(user);
    expect(
      screen.getByText(
        "Maximum of 1 hired swords reached; a blood-pacted one or a dramatis persona can still join."
      )
    ).toBeInTheDocument();

    await fillNewHireling(user);
    await user.click(screen.getByRole("button", { name: "Create hired sword" }));
    expect(await screen.findByText("Hired sword limit reached.")).toBeInTheDocument();
    expect(screen.queryByText(/New recruit/)).not.toBeInTheDocument();

    const addForm = screen.getByRole("group", { name: "New Hired Sword" });
    await user.click(within(addForm).getByRole("checkbox", { name: "Bloodpacted" }));
    await user.click(screen.getByRole("button", { name: "Create hired sword" }));

    expect(await screen.findByText("New recruit: 40 gc, paid when you save.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(api.batchWarbandHirelings).toHaveBeenCalledTimes(1));
    expect(batchCreates(api.batchWarbandHirelings)).toEqual([
      expect.objectContaining({ name: "Brother Hal", blood_pacted: true }),
    ]);
  });

  it("leaves Add hired sword quiet below the cap when the others are blood-pacted", async () => {
    const user = setupUser();
    const pacted = makeVeteranHireling({ id: 32, name: "Pacted", blood_pacted: true });
    renderWithQueryClient(<Section initialHirelings={[pacted]} maxHiredSwords={1} />);
    await startEditing(user);

    expect(screen.getByRole("button", { name: "Add hired sword" })).toBeEnabled();
    expect(screen.queryByText(/hired swords reached/)).not.toBeInTheDocument();
  });

  it("dismisses a hired sword on Save with no refund, and the dialog says its items are lost (decision 3, BUG-34)", async () => {
    const user = setupUser();
    const hired = makeVeteranHireling();
    api.batchWarbandHirelings.mockImplementation(answerBatch([hired], { gold: 160 }));
    renderWithQueryClient(<Section initialHirelings={[hired]} />);
    await startEditing(user);

    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("The unit is removed when you save, and no gold is refunded.");
    expect(dialog).toHaveTextContent(
      "All items this unit carries are lost. Move them to the stash first to keep them."
    );
    await user.click(within(dialog).getByRole("button", { name: "Dismiss hired sword" }));

    expect(api.batchWarbandHirelings).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(batchDismissals(api.batchWarbandHirelings)).toEqual([31]));
    expect(events.emitWarbandUpdate).toHaveBeenCalledWith(9, { summary: { gold: 160 } });
  });

  it("takes an armour save as 5, 5+ or -1+, shows it as N+ and hints at 1+ or better (decision 11)", async () => {
    const user = setupUser();
    const hired = makeVeteranHireling();
    api.batchWarbandHirelings.mockImplementation(answerBatch([hired], { gold: 160 }));
    renderWithQueryClient(<Section initialHirelings={[hired]} />);
    await startEditing(user);

    const save = screen.getByLabelText("Armour save");
    expect(save).toHaveValue("4+");
    expect(screen.queryByText("A roll of 1 always fails.")).not.toBeInTheDocument();

    await replaceValue(user, save, "7");
    expect(
      screen.getByText("Enter an armour save from -5+ to 6+, such as 4+, or leave it empty.")
    ).toBeInTheDocument();

    await replaceValue(user, save, "1");
    await user.keyboard("{Tab}");
    expect(save).toHaveValue("1+");
    expect(screen.getByText("A roll of 1 always fails.")).toBeInTheDocument();
    await replaceValue(user, save, "-1+");
    expect(screen.getByText("A roll of 1 always fails.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(api.batchWarbandHirelings).toHaveBeenCalledTimes(1));
    expect(batchUpdate(api.batchWarbandHirelings, 31)).toEqual(
      expect.objectContaining({ armour_save: -1 })
    );
  });

  it("edits the pending level-ups and sends the count only when it changed (decision 5)", async () => {
    const user = setupUser();
    const hired = makeVeteranHireling({ level_up: 2 });
    api.batchWarbandHirelings.mockImplementation(answerBatch([hired], { gold: 160 }));
    renderWithQueryClient(<Section initialHirelings={[hired]} />);
    await startEditing(user);

    const pending = screen.getByLabelText("Pending level-ups");
    expect(pending).toHaveValue(2);
    expect(screen.getByText("Lowering XP keeps level-ups already earned.")).toBeInTheDocument();
    await replaceValue(user, getFieldNear("Experience"), "1");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(api.batchWarbandHirelings).toHaveBeenCalledTimes(1));
    // XP alone: the server keeps the level-ups already earned.
    expect(batchUpdate(api.batchWarbandHirelings, 31)).not.toHaveProperty("level_up");

    await startEditing(user);
    await replaceValue(user, screen.getByLabelText("Pending level-ups"), "0");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(api.batchWarbandHirelings).toHaveBeenCalledTimes(2));
    expect(batchUpdate(api.batchWarbandHirelings, 31)).toEqual(
      expect.objectContaining({ level_up: 0 })
    );
  });

  it("duplicates a hired sword as a queued recruit with its profile and loadout (ROST-NEW-01)", async () => {
    const user = setupUser();
    const hired = makeVeteranHireling();
    api.batchWarbandHirelings.mockImplementation(answerBatch([hired], { gold: 160 }));
    renderWithQueryClient(<Section initialHirelings={[hired]} />);
    await startEditing(user);

    await user.click(screen.getByRole("button", { name: "Duplicate Brother Hal" }));

    expect(await screen.findByDisplayValue("Brother Hal (copy)")).toBeInTheDocument();
    expect(screen.getByText("New recruit: 40 gc, paid when you save.")).toBeInTheDocument();
    expect(api.batchWarbandHirelings).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(api.batchWarbandHirelings).toHaveBeenCalledTimes(1));
    expect(batchCreates(api.batchWarbandHirelings)).toEqual([
      expect.objectContaining({
        name: "Brother Hal (copy)",
        unit_type: "Warrior Priest",
        race: 1,
        price: 40,
        xp: 0,
        level_up: 0,
        deeds: null,
        caster: "Priest",
        items: [
          { id: 105, cost: 3 },
          { id: 103, cost: 20 },
        ],
        skill_ids: [203],
        spell_ids: [302],
      }),
    ]);
  });

  it("offers Duplicate only below the hired-sword cap, or for a blood-pacted copy (ROST-NEW-01)", async () => {
    const user = setupUser();
    const hired = makeVeteranHireling();
    const pacted = makeVeteranHireling({ id: 32, name: "Pacted", blood_pacted: true });
    renderWithQueryClient(<Section initialHirelings={[hired, pacted]} maxHiredSwords={1} />);
    await startEditing(user);

    const blocked = screen.getByRole("button", { name: "Duplicate Brother Hal" });
    expect(blocked).toBeDisabled();
    expect(blocked).toHaveAttribute("title", "Maximum of 1 hired swords reached.");
    expect(screen.getByRole("button", { name: "Duplicate Pacted" })).toBeEnabled();
  });

  it("drops a queued recruit from its card without warning about items it never had", async () => {
    const user = setupUser();
    renderWithQueryClient(<Section initialHirelings={[]} />);
    await startEditing(user);
    await fillNewHireling(user);
    await user.click(screen.getByRole("button", { name: "Create hired sword" }));
    await screen.findByDisplayValue("Brother Hal");

    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(
      "Remove the queued recruit Brother Hal? Nothing has been paid for it yet."
    );
    expect(dialog).not.toHaveTextContent("items this unit carries");
    await user.click(within(dialog).getByRole("button", { name: "Remove" }));

    expect(screen.queryByDisplayValue("Brother Hal")).not.toBeInTheDocument();
    expect(api.batchWarbandHirelings).not.toHaveBeenCalled();
  });

  it("drops a queued hired sword on Cancel without any request (decision 1, BUG-34)", async () => {
    const user = setupUser();
    renderWithQueryClient(<Section initialHirelings={[]} />);
    await startEditing(user);
    await fillNewHireling(user);
    await user.click(screen.getByRole("button", { name: "Create hired sword" }));
    await screen.findByDisplayValue("Brother Hal");

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(api.batchWarbandHirelings).not.toHaveBeenCalled();
    expect(screen.queryByText("Brother Hal")).not.toBeInTheDocument();
  });

  it("shows the roster with Level Up! and Edit only to editors", () => {
    const hired = makeVeteranHireling();
    const { unmount } = renderWithQueryClient(<Section initialHirelings={[hired]} />);
    expect(screen.getByRole("button", { name: "Level Up!" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Edit Hired Swords" })).toHaveLength(2);
    unmount();

    renderWithQueryClient(<Section initialHirelings={[hired]} canEdit={false} />);
    expect(screen.getByText("Brother Hal")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Level Up!" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit Hired Swords" })).not.toBeInTheDocument();
  });

  it("adds a dramatis persona by hand even at the cap: hero table, his stay and pay, no level-ups", async () => {
    const user = setupUser();
    renderWithQueryClient(
      <Section initialHirelings={[makeVeteranHireling()]} maxHiredSwords={1} />
    );
    await startEditing(user);

    await fillNewHireling(user);
    const addForm = screen.getByRole("group", { name: "New Hired Sword" });
    await user.click(within(addForm).getByRole("radio", { name: "Dramatis persona" }));
    expect(within(addForm).getByRole("radio", { name: "Hero" })).toBeChecked();
    await user.click(within(addForm).getByRole("radio", { name: "One battle" }));
    await user.type(within(addForm).getByLabelText("Paid in"), "a favour");
    await user.click(screen.getByRole("button", { name: "Create dramatis persona" }));
    expect(await screen.findByText("New recruit: 40 gc, paid when you save.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(api.batchWarbandHirelings).toHaveBeenCalledTimes(1));
    expect(batchCreates(api.batchWarbandHirelings)).toEqual([
      expect.objectContaining({
        name: "Brother Hal",
        kind: "dramatis_persona",
        injury_table: "hero",
        stays: "one_battle",
        payment_note: "a favour",
        no_level_ups: true,
      }),
    ]);
  });

  it("calls a dramatis persona one in edit mode: his card, its dismiss confirm, and the add form's name and Create (step 2 browser check)", async () => {
    const user = setupUser();
    const bertha = makeVeteranHireling({ id: 33, name: "Bertha", kind: "dramatis_persona" });
    renderWithQueryClient(<Section initialHirelings={[makeVeteranHireling(), bertha]} />);
    await startEditing(user);

    expect(screen.getByRole("group", { name: "Hired Sword 1" })).toBeInTheDocument();
    const card = screen.getByRole("group", { name: "Dramatis Persona 2" });
    expect(card).toHaveTextContent(/Dramatis Persona 2\s*-\s*Bertha/);
    await user.click(within(card).getByRole("button", { name: "Dismiss" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Dismiss dramatis persona" })).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await user.click(screen.getByRole("button", { name: "Add hired sword" }));
    const addForm = screen.getByRole("group", { name: "New Hired Sword" });
    expect(within(addForm).getByPlaceholderText("Hired sword name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create hired sword" })).toBeInTheDocument();
    await user.click(within(addForm).getByRole("radio", { name: "Dramatis persona" }));

    expect(addForm).toHaveAccessibleName("New Dramatis Persona");
    expect(within(addForm).getByPlaceholderText("Dramatis persona name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create dramatis persona" })).toBeInTheDocument();
  });

  it("saves a hired sword with no race, as one hired from an entry the catalogue's races lack", async () => {
    const user = setupUser();
    const skink = makeVeteranHireling({ race_id: null, race_name: null });
    api.batchWarbandHirelings.mockImplementation(answerBatch([skink], { gold: 160 }));
    renderWithQueryClient(<Section initialHirelings={[skink]} />);
    await startEditing(user);

    await replaceValue(user, getFieldNear("Experience"), "5");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(api.batchWarbandHirelings).toHaveBeenCalledTimes(1));
    expect(batchUpdate(api.batchWarbandHirelings, 31)).toEqual(
      expect.objectContaining({ race: null, xp: 5 })
    );
  });

  it("moves a hired sword to the hero injury table on its edit card (a house rule)", async () => {
    const user = setupUser();
    const hired = makeVeteranHireling();
    api.batchWarbandHirelings.mockImplementation(answerBatch([hired], { gold: 160 }));
    renderWithQueryClient(<Section initialHirelings={[hired]} />);
    await startEditing(user);

    expect(screen.queryByRole("radio", { name: "Dramatis persona" })).toBeNull();
    await user.click(screen.getByRole("radio", { name: "Hero" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(api.batchWarbandHirelings).toHaveBeenCalledTimes(1));
    expect(batchUpdate(api.batchWarbandHirelings, 31)).toEqual(
      expect.objectContaining({ kind: "hired_sword", injury_table: "hero" })
    );
  });

  it("leaves dramatis personae out of the count in the title while editing", async () => {
    const user = setupUser();
    renderWithQueryClient(
      <Section
        initialHirelings={[
          makeVeteranHireling(),
          makeVeteranHireling({ id: 33, name: "Bertha", kind: "dramatis_persona" }),
        ]}
      />
    );
    await startEditing(user);

    expect(screen.getByText("[1/3]")).toBeInTheDocument();
  });

  it("counts only hired swords without a blood pact against the cap in the title", () => {
    renderWithQueryClient(
      <Section
        initialHirelings={[
          makeVeteranHireling(),
          makeVeteranHireling({ id: 32, name: "Pacted", blood_pacted: true }),
        ]}
      />
    );

    expect(screen.getByText("[1/3]")).toBeInTheDocument();
  });
});
