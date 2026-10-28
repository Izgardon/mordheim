import type {
  BattlePostbattleFindItem,
  BattleParticipant,
  BattlePostbattleSeriousInjuryRoll,
  BattlePostbattleSuggestion,
  BattlePostbattleUpkeepEntry,
  BattlePostbattleState,
  BattlePostbattleUnitResult,
  BattleUnitInformationEntry,
} from "@/features/battles/types/battle-types";
import type {
  ParticipantRoster,
  PrebattleUnit,
} from "@/features/battles/components/prebattle/prebattle-types";
import type { WarbandResource } from "@/features/warbands/types/warband-types";

import {
  getParticipantSelectedUnits,
  toUnitInformationMap,
} from "@/features/battles/components/active/active-utils";
import {
  DEFAULT_EXPLORATION_DICE,
  type ExplorationDiceLimits,
} from "@/features/battles/components/postbattle/exploration-dice";
import type { InjuryTable } from "@/features/battles/components/postbattle/postbattle-rules";
import { paysUpkeep } from "@/features/battles/components/postbattle/upkeep-rules";

export type LocalExplorationState = {
  diceCount: number;
  diceValues: Array<number | null>;
  selectedDice: boolean[];
  resourceId: number | null;
  amountOverride: number | null;
  hasRolledAllDice: boolean;
};

export type PostbattleRenderableRow = {
  unitKey: string;
  unitName: string;
  unitType: string;
  unitKind: "hero" | "hireling" | "henchman";
  canGainXp: boolean;
  /** The serious-injury table the unit rolls on (a hireling's comes from its battle roster). */
  injuryTable: InjuryTable;
  groupName: string;
  outOfAction: boolean;
  killCount: number;
  xpEarned: number;
  dead: boolean;
  specialIds: number[];
  seriousInjuryRolls: BattlePostbattleSeriousInjuryRoll[];
};

export type PostbattleRenderableGroup = {
  key: string;
  label: string;
  unitKind: "hero" | "hireling" | "henchman";
  rows: PostbattleRenderableRow[];
};

function getUnitInformationEntry(
  unitInformationByKey: Record<string, BattleUnitInformationEntry>,
  unitKey: string
) {
  return (
    unitInformationByKey[unitKey] ?? {
      stats_override: {},
      out_of_action: false,
      kill_count: 0,
    }
  );
}

function createDefaultUnitResult(
  unit: PrebattleUnit,
  unitInformation: BattleUnitInformationEntry,
  xpEarned: number,
  groupName = ""
): BattlePostbattleUnitResult {
  const unitKind =
    unit.kind === "hero" ? "hero" : unit.kind === "hireling" ? "hireling" : "henchman";
  return {
    unit_name: unit.displayName,
    unit_kind: unitKind,
    unit_type: unit.unitType,
    group_name: groupName,
    out_of_action: unitInformation.out_of_action,
    kill_count: unitInformation.kill_count,
    xp_earned: xpEarned,
    dead: false,
    special_ids: [],
    serious_injury_rolls: [],
  };
}

function findTreasureResourceId(resources: WarbandResource[]): number | null {
  const treasure = resources.find((r) => r.name.toLowerCase() === "treasure");
  return treasure?.id ?? resources[0]?.id ?? null;
}

/** The roll saved with the draft, or `suggestion`'s dice (the server's, `suggested_postbattle`). */
export function buildLocalExplorationState(
  participant: BattleParticipant,
  resources: WarbandResource[],
  suggestion?: BattlePostbattleSuggestion["exploration"],
  limits: ExplorationDiceLimits = DEFAULT_EXPLORATION_DICE
): LocalExplorationState {
  // A roll saved with the draft comes back as it was (BUG-71): the chosen dice, resource and
  // override; the dice that weren't chosen aren't kept.
  const saved = (participant.postbattle_json as Partial<BattlePostbattleState> | undefined)
    ?.exploration;
  const savedDice = Array.isArray(saved?.dice_values)
    ? saved.dice_values.filter((value): value is number => typeof value === "number")
    : [];
  const savedResourceId = saved?.resource_id ?? findTreasureResourceId(resources);
  const savedOverride = typeof saved?.amount_override === "number" ? saved.amount_override : null;
  if (savedDice.length > 0) {
    return {
      diceCount: savedDice.length,
      diceValues: savedDice,
      selectedDice: savedDice.map((_, index) => index < limits.max_chosen),
      resourceId: savedResourceId,
      amountOverride: savedOverride,
      hasRolledAllDice: true,
    };
  }
  const diceCount = Math.max(0, Math.min(limits.max, suggestion?.dice_count ?? 0));
  return {
    diceCount,
    diceValues: Array.from({ length: diceCount }, () => null),
    selectedDice: Array.from({ length: diceCount }, (_, index) => index < limits.max_chosen),
    resourceId: savedResourceId,
    amountOverride: savedOverride,
    hasRolledAllDice: false,
  };
}

/** The exploration a draft save carries, once every die has a value (else null: not settled). */
export function settledExplorationPayload(state: LocalExplorationState | null) {
  if (!state || state.diceValues.some((value) => value === null)) {
    return null;
  }
  return toPostbattleExplorationPayload(state);
}

export function setLocalExplorationDiceCount(
  state: LocalExplorationState,
  nextDiceCount: number,
  limits: ExplorationDiceLimits = DEFAULT_EXPLORATION_DICE
): LocalExplorationState {
  const cappedCount = Math.max(0, Math.min(limits.max, nextDiceCount));
  const nextDiceValues = state.diceValues.slice(0, cappedCount);
  const nextSelectedDice = state.selectedDice.slice(0, cappedCount);
  while (nextDiceValues.length < cappedCount) {
    nextDiceValues.push(null);
  }
  while (nextSelectedDice.length < cappedCount) {
    nextSelectedDice.push(nextSelectedDice.filter(Boolean).length < limits.max_chosen);
  }
  return {
    ...state,
    diceCount: cappedCount,
    diceValues: nextDiceValues,
    selectedDice: nextSelectedDice,
  };
}

export function setLocalExplorationDieSelected(
  state: LocalExplorationState,
  index: number,
  checked: boolean,
  limits: ExplorationDiceLimits = DEFAULT_EXPLORATION_DICE
): LocalExplorationState {
  if (index < 0 || index >= state.selectedDice.length) {
    return state;
  }
  const chosen = state.selectedDice.filter(Boolean).length;
  if (checked && !state.selectedDice[index] && chosen >= limits.max_chosen) {
    return state;
  }
  return {
    ...state,
    selectedDice: state.selectedDice.map((value, entryIndex) =>
      entryIndex === index ? checked : value
    ),
  };
}

export function setLocalExplorationDieValue(
  state: LocalExplorationState,
  index: number,
  rawValue: string
): LocalExplorationState {
  if (index < 0 || index >= state.diceValues.length) {
    return state;
  }
  const trimmed = rawValue.trim();
  let nextValue: number | null = null;
  if (trimmed) {
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      return state;
    }
    nextValue = Math.max(1, Math.min(6, Math.trunc(parsed)));
  }
  return {
    ...state,
    diceValues: state.diceValues.map((value, entryIndex) =>
      entryIndex === index ? nextValue : value
    ),
  };
}

export function setLocalExplorationResource(
  state: LocalExplorationState,
  resourceId: number | null
): LocalExplorationState {
  return {
    ...state,
    resourceId,
  };
}

export function setLocalExplorationAmountOverride(
  state: LocalExplorationState,
  rawValue: string
): LocalExplorationState {
  const trimmed = rawValue.trim();
  if (trimmed === "") {
    return { ...state, amountOverride: null };
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return state;
  }
  return { ...state, amountOverride: Math.max(0, Math.trunc(parsed)) };
}

export function getSelectedExplorationDiceValues(state: LocalExplorationState) {
  return state.diceValues.filter(
    (value, index): value is number => state.selectedDice[index] && value !== null
  );
}

export function toPostbattleExplorationPayload(state: LocalExplorationState) {
  return {
    dice_values: getSelectedExplorationDiceValues(state),
    resource_id: state.resourceId,
    amount_override: state.amountOverride ?? undefined,
  };
}

function getExistingUnitResult(existing: BattlePostbattleState | undefined, unitKey: string) {
  const entry = existing?.unit_results?.[unitKey];
  if (!entry) {
    return {};
  }
  const legacyDeathRolls =
    "death_rolls" in entry && Array.isArray((entry as { death_rolls?: unknown[] }).death_rolls)
      ? (entry as { death_rolls?: BattlePostbattleSeriousInjuryRoll[] }).death_rolls
      : undefined;
  return {
    ...entry,
    special_ids: [],
    serious_injury_rolls: Array.isArray(entry.serious_injury_rolls)
      ? entry.serious_injury_rolls
      : (legacyDeathRolls ?? []),
  };
}

function getExistingUpkeepEntry(existing: BattlePostbattleState | undefined, unitKey: string) {
  const entry = existing?.upkeep?.entries?.[unitKey];
  if (!entry) {
    return {};
  }
  return {
    ...entry,
    cost:
      typeof entry.cost === "number" && Number.isFinite(entry.cost)
        ? Math.max(0, Math.trunc(entry.cost))
        : null,
  };
}

function mergeUnitResultWithExisting(
  defaultResult: BattlePostbattleUnitResult,
  existing: Partial<BattlePostbattleUnitResult>
): BattlePostbattleUnitResult {
  const existingKillCount =
    typeof existing.kill_count === "number" && Number.isFinite(existing.kill_count)
      ? Math.max(0, Math.trunc(existing.kill_count))
      : defaultResult.kill_count;

  return {
    ...defaultResult,
    ...existing,
    kill_count: Math.max(defaultResult.kill_count, existingKillCount),
  };
}

function getExistingFinds(existing: BattlePostbattleState | undefined) {
  const rawFinds = existing?.finds;
  const goldCrowns =
    typeof rawFinds?.gold_crowns === "number" && Number.isFinite(rawFinds.gold_crowns)
      ? Math.max(0, Math.trunc(rawFinds.gold_crowns))
      : 0;
  const items = Array.isArray(rawFinds?.items)
    ? rawFinds.items.flatMap((entry): BattlePostbattleFindItem[] => {
        if (!entry || typeof entry !== "object") {
          return [];
        }
        const itemId = Number(entry.item_id);
        if (!Number.isFinite(itemId) || itemId <= 0) {
          return [];
        }
        const cost =
          typeof entry.cost === "number" && Number.isFinite(entry.cost)
            ? Math.max(0, Math.trunc(entry.cost))
            : null;
        return [
          {
            item_id: Math.trunc(itemId),
            name: typeof entry.name === "string" ? entry.name : "",
            type: typeof entry.type === "string" ? entry.type : null,
            cost,
          },
        ];
      })
    : [];

  return {
    gold_crowns: goldCrowns,
    items,
  };
}

/**
 * The draft saved so far, filled in from the server's `suggested_postbattle` (XP per unit, upkeep)
 * for whatever the player hasn't set; without a suggestion XP starts at 0 and upkeep unknown.
 */
export function buildPostbattleDraft(
  participant: BattleParticipant,
  roster: ParticipantRoster | undefined,
  resources: WarbandResource[],
  suggestion?: BattlePostbattleSuggestion
): BattlePostbattleState {
  const unitInformationByKey = toUnitInformationMap(participant.unit_information_json);
  const suggestedXp = (unitKey: string) => suggestion?.unit_results[unitKey]?.xp_earned ?? 0;
  const selected = getParticipantSelectedUnits(participant, roster);
  const existing = (participant.postbattle_json as BattlePostbattleState | undefined) ?? undefined;

  const nextUnitResults: Record<string, BattlePostbattleUnitResult> = {};
  const nextUpkeepEntries: Record<string, BattlePostbattleUpkeepEntry> = {};

  for (const hero of selected.heroes) {
    const unitInformation = getUnitInformationEntry(unitInformationByKey, hero.key);
    const defaultResult = createDefaultUnitResult(hero, unitInformation, suggestedXp(hero.key));
    nextUnitResults[hero.key] = {
      ...mergeUnitResultWithExisting(defaultResult, getExistingUnitResult(existing, hero.key)),
    };
  }

  for (const hireling of selected.hirelings) {
    const unitInformation = getUnitInformationEntry(unitInformationByKey, hireling.key);
    const defaultResult = createDefaultUnitResult(
      hireling,
      unitInformation,
      suggestedXp(hireling.key)
    );
    nextUnitResults[hireling.key] = {
      ...mergeUnitResultWithExisting(defaultResult, getExistingUnitResult(existing, hireling.key)),
    };
  }

  // A hireling who stays for one battle leaves after it: no upkeep keeps him (the server agrees).
  for (const hireling of (roster?.hirelings ?? []).filter(paysUpkeep)) {
    nextUpkeepEntries[hireling.key] = {
      ...(suggestion?.upkeep.entries[hireling.key] ?? {
        unit_name: hireling.displayName,
        cost: null,
      }),
      ...getExistingUpkeepEntry(existing, hireling.key),
    };
  }

  for (const group of roster?.henchmenGroups ?? []) {
    const selectedMembers = group.members.filter((member) =>
      participant.selected_unit_keys_json.includes(member.key)
    );
    if (selectedMembers.length === 0) {
      continue;
    }
    for (const member of selectedMembers) {
      const unitInformation = getUnitInformationEntry(unitInformationByKey, member.key);
      const defaultResult = createDefaultUnitResult(
        member,
        unitInformation,
        suggestedXp(member.key),
        group.name
      );
      nextUnitResults[member.key] = {
        ...mergeUnitResultWithExisting(defaultResult, getExistingUnitResult(existing, member.key)),
      };
    }
  }

  const existingExploration = existing?.exploration ?? {
    dice_values: [],
    resource_id: null,
  };

  return {
    exploration: {
      dice_values: Array.isArray(existingExploration.dice_values)
        ? existingExploration.dice_values.filter(
            (value): value is number => typeof value === "number"
          )
        : [],
      resource_id: existingExploration.resource_id ?? findTreasureResourceId(resources),
    },
    finds: getExistingFinds(existing),
    upkeep: {
      pay_upkeep: existing?.upkeep?.pay_upkeep ?? true,
      entries: nextUpkeepEntries,
    },
    unit_results: nextUnitResults,
    // The mounts' rolls saved so far (step 5); left out until one is rolled.
    ...(existing?.mount_survival ? { mount_survival: existing.mount_survival } : {}),
  };
}

/**
 * A mount's D6 rolled (or cleared): its suggested result, dead on `dies_on` or less (the
 * server's number); the player may change the result afterwards.
 */
export function mountRollResult(roll: number | null, diesOn: number) {
  return { roll, dead: roll !== null && roll <= diesOn };
}

/** The draft with one rider's mount roll and result set (step 5). */
export function setMountSurvival(
  draft: BattlePostbattleState,
  unitKey: string,
  value: { roll: number | null; dead: boolean }
): BattlePostbattleState {
  return { ...draft, mount_survival: { ...draft.mount_survival, [unitKey]: value } };
}

export function buildRenderableGroups(draft: BattlePostbattleState, roster?: ParticipantRoster) {
  const heroes: PostbattleRenderableRow[] = [];
  const hirelings: PostbattleRenderableRow[] = [];
  const henchmenGroups = new Map<string, PostbattleRenderableRow[]>();
  const xpEligibilityByUnitKey = new Map<string, boolean>();
  const injuryTableByUnitKey = new Map<string, InjuryTable>();

  for (const hero of roster?.heroes ?? []) {
    xpEligibilityByUnitKey.set(hero.key, true);
  }
  for (const hireling of roster?.hirelings ?? []) {
    // A dramatis persona gains no XP, by kind (the server suggests none either).
    xpEligibilityByUnitKey.set(
      hireling.key,
      !hireling.noLevelUps && hireling.hirelingKind !== "dramatis_persona"
    );
    injuryTableByUnitKey.set(hireling.key, hireling.injuryTable === "hero" ? "hero" : "henchman");
  }
  for (const group of roster?.henchmenGroups ?? []) {
    for (const member of group.members) {
      xpEligibilityByUnitKey.set(member.key, !member.noLevelUps);
    }
  }

  for (const [unitKey, result] of Object.entries(draft.unit_results)) {
    const row: PostbattleRenderableRow = {
      unitKey,
      unitName: result.unit_name,
      unitType: result.unit_type,
      unitKind: result.unit_kind,
      canGainXp: xpEligibilityByUnitKey.get(unitKey) ?? true,
      injuryTable:
        result.unit_kind === "hero" ? "hero" : (injuryTableByUnitKey.get(unitKey) ?? "henchman"),
      groupName: result.group_name,
      outOfAction: result.out_of_action,
      killCount: result.kill_count,
      xpEarned: result.xp_earned,
      dead: result.dead,
      specialIds: result.special_ids,
      seriousInjuryRolls: result.serious_injury_rolls,
    };
    if (result.unit_kind === "hero") {
      heroes.push(row);
      continue;
    }
    if (result.unit_kind === "hireling") {
      hirelings.push(row);
      continue;
    }
    const groupKey = result.group_name || "Henchmen";
    const existing = henchmenGroups.get(groupKey) ?? [];
    existing.push(row);
    henchmenGroups.set(groupKey, existing);
  }

  const groups: PostbattleRenderableGroup[] = [];
  if (heroes.length > 0) {
    groups.push({ key: "heroes", label: "Heroes", unitKind: "hero", rows: heroes });
  }
  for (const [groupName, rows] of henchmenGroups.entries()) {
    groups.push({ key: `henchmen:${groupName}`, label: groupName, unitKind: "henchman", rows });
  }
  if (hirelings.length > 0) {
    groups.push({
      key: "hirelings",
      label: "Hired Swords",
      unitKind: "hireling",
      rows: hirelings,
    });
  }

  return groups;
}

export function updateGroupXp(draft: BattlePostbattleState, groupName: string, xpEarned: number) {
  const nextUnitResults = { ...draft.unit_results };
  for (const [unitKey, result] of Object.entries(nextUnitResults)) {
    if (result.unit_kind !== "henchman" || result.group_name !== groupName) {
      continue;
    }
    nextUnitResults[unitKey] = { ...result, xp_earned: xpEarned };
  }
  return { ...draft, unit_results: nextUnitResults };
}

export function updateUnitResult(
  draft: BattlePostbattleState,
  unitKey: string,
  updater: (current: BattlePostbattleUnitResult) => BattlePostbattleUnitResult
) {
  const current = draft.unit_results[unitKey];
  if (!current) {
    return draft;
  }
  return {
    ...draft,
    unit_results: {
      ...draft.unit_results,
      [unitKey]: updater(current),
    },
  };
}

export function updatePostbattleUpkeepEntry(
  draft: BattlePostbattleState,
  unitKey: string,
  nextCost: number | null
) {
  const current = draft.upkeep.entries[unitKey];
  if (!current) {
    return draft;
  }
  return {
    ...draft,
    upkeep: {
      ...draft.upkeep,
      entries: {
        ...draft.upkeep.entries,
        [unitKey]: {
          ...current,
          cost:
            typeof nextCost === "number" && Number.isFinite(nextCost)
              ? Math.max(0, Math.trunc(nextCost))
              : null,
        },
      },
    },
  };
}

export function setPostbattlePayUpkeep(draft: BattlePostbattleState, payUpkeep: boolean) {
  return {
    ...draft,
    upkeep: {
      ...draft.upkeep,
      pay_upkeep: payUpkeep,
    },
  };
}

export function setPostbattleFindsGold(draft: BattlePostbattleState, goldCrowns: number) {
  return {
    ...draft,
    finds: {
      ...draft.finds,
      gold_crowns: Math.max(0, Math.trunc(goldCrowns)),
    },
  };
}

export function addPostbattleFindItem(
  draft: BattlePostbattleState,
  item: BattlePostbattleFindItem
) {
  return {
    ...draft,
    finds: {
      ...draft.finds,
      items: [...draft.finds.items, item],
    },
  };
}

export function removePostbattleFindItem(draft: BattlePostbattleState, index: number) {
  if (index < 0 || index >= draft.finds.items.length) {
    return draft;
  }
  return {
    ...draft,
    finds: {
      ...draft.finds,
      items: draft.finds.items.filter((_, itemIndex) => itemIndex !== index),
    },
  };
}

export function getPostbattleUpkeepTotal(draft: BattlePostbattleState | null) {
  if (!draft) {
    return 0;
  }

  let total = 0;
  for (const [unitKey, entry] of Object.entries(draft.upkeep.entries)) {
    if (draft.unit_results[unitKey]?.dead) {
      continue;
    }
    if (typeof entry.cost !== "number" || !Number.isFinite(entry.cost)) {
      continue;
    }
    total += Math.max(0, Math.trunc(entry.cost));
  }
  return total;
}

export function isPostbattleDraftValid(draft: BattlePostbattleState | null) {
  if (!draft) {
    return false;
  }
  return Object.keys(draft.unit_results).length > 0;
}

/** A pet that fought as its own model, as postbattle shows it (step 5). */
export type PostbattlePetRow = {
  unitKey: string;
  name: string;
  owner: string;
  outOfAction: boolean;
  kills: number;
};

/**
 * The selected pets that fought as their own models: each follows its owner after the battle
 * (no XP, no injury roll, no result of its own), so postbattle only shows how it ended.
 */
export function petResultRows(
  participant: BattleParticipant,
  roster: ParticipantRoster | undefined
): PostbattlePetRow[] {
  const unitInformation = toUnitInformationMap(participant.unit_information_json);
  return getParticipantSelectedUnits(participant, roster).pets.map((pet) => ({
    unitKey: pet.key,
    name: pet.displayName,
    owner: pet.unitType,
    outOfAction: Boolean(unitInformation[pet.key]?.out_of_action),
    kills: unitInformation[pet.key]?.kill_count ?? 0,
  }));
}
