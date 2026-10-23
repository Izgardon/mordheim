import type {
  BattleParticipant,
  BattleUnitInformationEntry,
} from "@/features/battles/types/battle-types";
import type {
  HenchmenGroupRoster,
  ParticipantRoster,
  PrebattleUnit,
  UnitOverride,
  UnitSingleUseItem,
} from "@/features/battles/components/prebattle/prebattle-types";

import ActiveUnitCard from "./ActiveUnitCard";
import ActiveHenchmenGroupCard from "./ActiveHenchmenGroupCard";
import type { ActiveBattleUnitOption } from "./active-utils";
import { getParticipantSelectedUnits, withPetModels } from "./active-utils";

type ActiveParticipantRosterProps = {
  participant: BattleParticipant;
  participantRoster?: ParticipantRoster;
  rosterLoading: boolean;
  rosterError?: string;
  unitInformationByKey: Record<string, BattleUnitInformationEntry>;
  killTargetOptions: ActiveBattleUnitOption[];
  canInteract: boolean;
  onSetOutOfAction: (unitKey: string, outOfAction: boolean) => Promise<void>;
  /** A rider off his mount for the rest of the battle, or back on it (step 5). */
  onSetDismounted?: (unitKey: string, dismounted: boolean) => Promise<void>;
  onAdjustWounds: (unit: PrebattleUnit, delta: number) => Promise<void>;
  onSaveOverride: (unitKeys: string[], override: UnitOverride | undefined) => Promise<void>;
  onSaveUnitNotes: (unitKey: string, notes: string) => Promise<void>;
  onRecordKill: (payload: {
    killerUnitKey: string;
    victimUnitKey?: string;
    victimName?: string;
    notes?: string;
    earnedXp: boolean;
  }) => Promise<void>;
  onUseSingleUseItem: (unit: PrebattleUnit, item: UnitSingleUseItem) => Promise<void>;
  getUsedSingleUseItemCount: (unitKey: string, itemId: number) => number;
  /** Undoes this player's latest use of an item by a unit (BUG-11). */
  onUndoSingleUseItem?: (unit: PrebattleUnit, itemId: number) => Promise<void>;
  activeItemActionKey: string | null;
  savingUnitKeys?: Record<string, boolean>;
  sectionIds?: Partial<Record<"heroes" | "henchmen" | "hirelings" | "temporary", string>>;
};

const SECTION_TITLE_CLASS = "battle-section-title";

export default function ActiveParticipantRoster({
  participant,
  participantRoster,
  rosterLoading,
  rosterError,
  unitInformationByKey,
  savingUnitKeys = {},
  sectionIds,
  ...cardProps
}: ActiveParticipantRosterProps) {
  const selectedUnits = getParticipantSelectedUnits(participant, participantRoster);
  const selectedUnitKeySet = new Set(participant.selected_unit_keys_json ?? []);
  const selectedHenchmenGroups: HenchmenGroupRoster[] = (participantRoster?.henchmenGroups ?? [])
    .map((group) => ({
      ...group,
      members: group.members.filter((member) => selectedUnitKeySet.has(member.key)),
    }))
    .filter((group) => group.members.length > 0);

  const renderUnitCard = (unit: PrebattleUnit) => (
    <ActiveUnitCard
      key={unit.key}
      unit={unit}
      unitInformation={unitInformationByKey[unit.key]}
      isSavingUnitConfig={Boolean(savingUnitKeys[unit.key])}
      {...cardProps}
    />
  );
  // Each pet fighting as its own model follows its owner's card (step 5).
  const { pets } = selectedUnits;
  const ownedBy = (prefix: string) => (pet: PrebattleUnit) =>
    (pet.ownerKey ?? "").startsWith(prefix);
  const unitCards = (units: PrebattleUnit[], prefix: string) =>
    withPetModels(units, pets, (unit) => unit.key, ownedBy(prefix)).map(renderUnitCard);

  const section = (id: string | undefined, title: string, cards: React.ReactNode[]) =>
    cards.length ? (
      <section id={id} className="space-y-2 scroll-mt-28">
        <p className={SECTION_TITLE_CLASS}>{title}</p>
        <div className="space-y-2">{cards}</div>
      </section>
    ) : null;

  const groupCards = withPetModels(
    selectedHenchmenGroups,
    pets,
    (group) => `group:${group.id}`,
    ownedBy("group:")
  ).map((group) =>
    !("members" in group) ? (
      renderUnitCard(group)
    ) : (
      <ActiveHenchmenGroupCard
        key={group.id}
        groupName={group.name}
        groupType={group.unitType}
        beastKind={group.beastKind}
        members={group.members}
        unitInformationByKey={unitInformationByKey}
        savingUnitKeys={savingUnitKeys}
        {...cardProps}
      />
    )
  );

  const nothingSelected =
    !selectedUnits.heroes.length &&
    !selectedHenchmenGroups.length &&
    !selectedUnits.hirelings.length &&
    !selectedUnits.temporary.length &&
    !pets.length;

  return (
    <div className="space-y-4">
      {rosterLoading ? (
        <p className="text-sm text-muted-foreground">Loading roster...</p>
      ) : rosterError ? (
        <p className="text-sm text-red-600">{rosterError}</p>
      ) : (
        <div className="space-y-4">
          {section(sectionIds?.heroes, "Heroes", unitCards(selectedUnits.heroes, "hero:"))}
          {section(sectionIds?.henchmen, "Henchmen", groupCards)}
          {section(
            sectionIds?.hirelings,
            "Hired Swords",
            unitCards(selectedUnits.hirelings, "hireling:")
          )}
          {section(
            sectionIds?.temporary,
            "Temporary Units",
            selectedUnits.temporary.map(renderUnitCard)
          )}
          {nothingSelected ? (
            <p className="text-sm text-muted-foreground">No units selected for this battle.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
