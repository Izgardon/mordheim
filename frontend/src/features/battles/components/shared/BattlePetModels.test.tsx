/**
 * A pet with a profile takes part in a battle as its own model next to its owner (the bestiary
 * rewrite, step 5): the roster's keyed pets become models (`pet:<owner kind>:<row>`), picked in
 * prebattle right after their owner, fighting on their own card in an active battle (out of
 * action, kills, a kill target, the helpers), and following their owner after it: postbattle gives
 * them no result, and shows one taken out of action as such.
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { toParticipantRosters } from "@/features/battles/api/battle-queries";
import { ME, battleRosters, myParticipant, opponentParticipant } from "@/test/battle-fixtures";

import ActiveParticipantRoster from "../active/ActiveParticipantRoster";
import { buildBattleUnitOptions, toUnitInformationMap } from "../active/active-utils";
import PrebattleParticipantRoster from "../prebattle/PrebattleParticipantRoster";
import RosterResultsSection from "../postbattle/RosterResultsSection";
import { buildPostbattleDraft, petResultRows } from "../postbattle/postbattle-utils";
import { meleeUnitOptions } from "../../utils/helper-options";

import type { BattleRosterMap } from "@/features/battles/types/battle-types";

vi.mock("../active/ActiveKillDialog", () => ({ default: () => null }));

const hawkStats = {
  movement: 6,
  weapon_skill: 4,
  ballistic_skill: 0,
  strength: 3,
  toughness: 3,
  wounds: 1,
  initiative: 4,
  attacks: 1,
  leadership: 5,
  armour_save: null,
};
const HAWK = "pet:hero:12";

/** Captain Wolf with a hawk (a model) and a raven (a chip); the Youngbloods with their own hawk. */
function rostersWithPets() {
  const map: BattleRosterMap = battleRosters();
  const mine = map[String(ME.id)];
  mine.heroes[0] = {
    ...mine.heroes[0],
    pets: [
      { key: HAWK, itemId: 150, name: "Hawk", hasProfile: true, stats: hawkStats },
      { itemId: 141, name: "Raven", hasProfile: false, stats: null },
    ],
  };
  mine.henchmenGroups[0] = {
    ...mine.henchmenGroups[0],
    pets: [
      {
        key: "pet:henchmen_group:30",
        itemId: 150,
        name: "Hawk",
        hasProfile: true,
        stats: hawkStats,
      },
    ],
  };
  return toParticipantRosters(map);
}

const activeProps = {
  rosterLoading: false,
  killTargetOptions: [],
  canInteract: true,
  onSetOutOfAction: vi.fn().mockResolvedValue(undefined),
  onAdjustWounds: vi.fn().mockResolvedValue(undefined),
  onSaveOverride: vi.fn().mockResolvedValue(undefined),
  onSaveUnitNotes: vi.fn().mockResolvedValue(undefined),
  onRecordKill: vi.fn().mockResolvedValue(undefined),
  onUseSingleUseItem: vi.fn().mockResolvedValue(undefined),
  getUsedSingleUseItemCount: () => 0,
  activeItemActionKey: null,
};

describe("pets as their own models", () => {
  it("makes a model of each keyed pet, named for its owner; a pet without a profile stays a chip", () => {
    const { petModels = [] } = rostersWithPets()[ME.id];

    expect(
      petModels.map((pet) => [pet.key, pet.kind, pet.displayName, pet.unitType, pet.ownerKey])
    ).toEqual([
      [HAWK, "pet", "Hawk", "Pet of Captain Wolf", "hero:1"],
      ["pet:henchmen_group:30", "pet", "Hawk", "Pet of Youngbloods", "group:11"],
    ]);
    expect(petModels[0].stats.movement).toBe(6);
  });

  it("is picked in prebattle right after its owner", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(
      <PrebattleParticipantRoster
        participant={myParticipant()}
        editable
        ratingInputValue=""
        onRatingInputChange={() => undefined}
        participantRoster={rostersWithPets()[ME.id]}
        rosterLoading={false}
        participantSelectedKeys={[]}
        participantOverrides={{}}
        participantNotes={{}}
        participantCustomUnits={[]}
        selectedUnitKeys={["hero:1"]}
        editingUnitKey={null}
        onToggleUnitSelection={onToggle}
        onToggleEditingUnit={() => undefined}
        onUpdateOverrideStat={() => undefined}
        onUpdateUnitNotes={() => undefined}
        onClearUnitOverride={() => undefined}
        onRemoveCustomUnit={() => undefined}
        canUseItems={false}
        onUseSingleUseItem={() => undefined}
        getUsedSingleUseItemCount={() => 0}
        activeItemActionKey={null}
      />
    );

    const names = screen.getAllByText(/^(Captain Wolf|Hawk|Rolf)$/).map((node) => node.textContent);
    expect(names.slice(0, 3)).toEqual(["Captain Wolf", "Hawk", "Rolf"]);
    const hawkCard = screen.getAllByText("Hawk")[0].closest(".battle-card") as HTMLElement;
    await user.click(within(hawkCard).getByRole("checkbox"));
    expect(onToggle).toHaveBeenCalledWith(HAWK);
  });

  it("fights on its own card in an active battle, and is a kill target and a helper option", () => {
    const rosters = rostersWithPets();
    const me = myParticipant({ selected_unit_keys_json: ["hero:1", HAWK] });
    render(
      <ActiveParticipantRoster
        participant={me}
        participantRoster={rosters[ME.id]}
        unitInformationByKey={toUnitInformationMap({ [HAWK]: { kill_count: 1 } })}
        {...activeProps}
      />
    );

    const hawkCard = screen.getByText("Hawk").closest(".battle-card") as HTMLElement;
    expect(
      within(hawkCard).getAllByRole("button", { name: "Set Hawk out of action" })[0]
    ).toBeInTheDocument();
    expect(
      within(hawkCard).getAllByRole("button", { name: "Record kill for Hawk, 1 so far" })[0]
    ).toBeInTheDocument();
    const options = buildBattleUnitOptions([opponentParticipant(), me], rosters);
    expect(options.find((option) => option.unitKey === HAWK)).toMatchObject({
      sectionLabel: "Pets",
    });
    const melee = meleeUnitOptions([me, opponentParticipant()], rosters, ME.id).yours;
    expect(melee.find((option) => option.value === `${ME.id}:${HAWK}`)?.stats.movement).toBe(6);
  });

  it("follows its owner after the battle: no result, and shown out of action as such", () => {
    const rosters = rostersWithPets();
    const me = myParticipant({
      selected_unit_keys_json: ["hero:1", HAWK],
      unit_information_json: { [HAWK]: { out_of_action: true, kill_count: 2 } },
    });

    const draft = buildPostbattleDraft(me, rosters[ME.id], []);
    expect(Object.keys(draft.unit_results)).toEqual(["hero:1"]);
    render(
      <RosterResultsSection
        isMobile={false}
        groups={[]}
        pets={petResultRows(me, rosters[ME.id])}
        rosterLoading={false}
        rosterError=""
        tools={{} as never}
      />
    );
    const row = screen.getByText("Hawk").closest("li") as HTMLElement;
    expect(row).toHaveTextContent("Pet of Captain Wolf");
    expect(row).toHaveTextContent("Out of action");
    expect(row).toHaveTextContent("2 kills");
  });
});
