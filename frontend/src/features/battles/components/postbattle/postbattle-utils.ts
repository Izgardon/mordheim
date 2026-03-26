import type {
  BattleEvent,
  BattleParticipant,
  BattlePostbattleSeriousInjuryRoll,
  BattlePostbattleState,
  BattlePostbattleUnitResult,
  BattleSummary,
  BattleUnitInformationEntry,
} from "@/features/battles/types/battle-types";
import type { ParticipantRoster, PrebattleUnit } from "@/features/battles/components/prebattle/prebattle-types";
import type { CampaignHeroDeathRoll } from "@/features/campaigns/types/campaign-types";
import type { WarbandResource } from "@/features/warbands/types/warband-types";

import { getParticipantSelectedUnits, toUnitInformationMap } from "@/features/battles/components/active/active-utils";

type SeriousInjuryGuide = {
  code: string;
  label: string;
  dead: boolean;
};

type SeriousInjuryRangeGuide = {
  min: number;
  max: number;
  label: string;
  dead: boolean;
};

export type LocalExplorationState = {
  diceCount: number;
  diceValues: Array<number | null>;
  selectedDice: boolean[];
  resourceId: number | null;
  hasRolledAllDice: boolean;
};

export type PostbattleRenderableRow = {
  unitKey: string;
  unitName: string;
  unitType: string;
  unitKind: "hero" | "hired_sword" | "henchman";
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
  unitKind: "hero" | "hired_sword" | "henchman";
  rows: PostbattleRenderableRow[];
};

const HERO_INJURY_GUIDE: Record<string, SeriousInjuryGuide> = {
  "11": { code: "11", label: "Dead", dead: true },
  "12": { code: "12", label: "Dead", dead: true },
  "13": { code: "13", label: "Dead", dead: true },
  "14": { code: "14", label: "Dead", dead: true },
  "15": { code: "15", label: "Dead", dead: true },
  "16": { code: "16", label: "Full Recovery", dead: false },
  "21": { code: "21", label: "Full Recovery", dead: false },
  "22": { code: "22", label: "Horrible Scars", dead: false },
  "23": { code: "23", label: "Horrible Scars", dead: false },
  "24": { code: "24", label: "Horrible Scars", dead: false },
  "25": { code: "25", label: "Horrible Scars", dead: false },
  "26": { code: "26", label: "Horrible Scars", dead: false },
  "31": { code: "31", label: "Old Battle Wound", dead: false },
  "32": { code: "32", label: "Nervous Condition", dead: false },
  "33": { code: "33", label: "Smashed Leg", dead: false },
  "34": { code: "34", label: "Arm Wound", dead: false },
  "35": { code: "35", label: "Severe Head Wound", dead: false },
  "36": { code: "36", label: "Robbed", dead: false },
  "41": { code: "41", label: "Sold to the Pits", dead: false },
  "42": { code: "42", label: "Sold to the Pits", dead: false },
  "43": { code: "43", label: "Sold to the Pits", dead: false },
  "44": { code: "44", label: "Sold to the Pits", dead: false },
  "45": { code: "45", label: "Sold to the Pits", dead: false },
  "46": { code: "46", label: "Sold to the Pits", dead: false },
  "51": { code: "51", label: "Sold to the Pits", dead: false },
  "52": { code: "52", label: "Sold to the Pits", dead: false },
  "53": { code: "53", label: "Sold to the Pits", dead: false },
  "54": { code: "54", label: "Sold to the Pits", dead: false },
  "55": { code: "55", label: "Sold to the Pits", dead: false },
  "56": { code: "56", label: "Bitter Enmity", dead: false },
  "61": { code: "61", label: "Captured", dead: false },
  "62": { code: "62", label: "Hardened", dead: false },
  "63": { code: "63", label: "Mad", dead: false },
  "64": { code: "64", label: "Stupidity", dead: false },
  "65": { code: "65", label: "Frenzy", dead: false },
  "66": { code: "66", label: "Multiple Injuries", dead: false },
};

const HERO_D100_INJURY_GUIDE: SeriousInjuryRangeGuide[] = [
  { min: 1, max: 14, label: "Dead", dead: true },
  { min: 15, max: 20, label: "Multiple Injuries", dead: false },
  { min: 21, max: 23, label: "Smashed Leg", dead: false },
  { min: 24, max: 24, label: "Arm Wound", dead: false },
  { min: 25, max: 26, label: "Madness", dead: false },
  { min: 27, max: 28, label: "Smashed Leg", dead: false },
  { min: 29, max: 31, label: "Chest Wound", dead: false },
  { min: 32, max: 34, label: "Big City Shakes", dead: false },
  { min: 35, max: 37, label: "Blind in One Eye", dead: false },
  { min: 38, max: 39, label: "Old Battle Wound", dead: false },
  { min: 40, max: 42, label: "Nervous Condition", dead: false },
  { min: 43, max: 45, label: "Hand Injury", dead: false },
  { min: 46, max: 49, label: "Deep Wound", dead: false },
  { min: 50, max: 74, label: "Full Recovery", dead: false },
  { min: 75, max: 77, label: "Robbed", dead: false },
  { min: 78, max: 80, label: "Bitter Enmity", dead: false },
  { min: 81, max: 85, label: "Captured", dead: false },
  { min: 86, max: 88, label: "Hardened", dead: false },
  { min: 89, max: 91, label: "Horrible Scars", dead: false },
  { min: 92, max: 94, label: "Sold to the Pits", dead: false },
  { min: 95, max: 97, label: "Survives Against the Odds", dead: false },
  { min: 98, max: 99, label: "Really Survives Against the Odds", dead: false },
  { min: 100, max: 100, label: "Mutation", dead: false },
];

function getUnitInformationEntry(
  unitInformationByKey: Record<string, BattleUnitInformationEntry>,
  unitKey: string
) {
  return unitInformationByKey[unitKey] ?? {
    stats_override: {},
    stats_reason: "",
    out_of_action: false,
    kill_count: 0,
  };
}

function getWinnerBonus(battle: BattleSummary, participant: BattleParticipant) {
  return (battle.winner_warband_ids_json ?? []).includes(participant.warband.id) ? 1 : 0;
}

function getXpKillCountByUnitKey(
  events: BattleEvent[],
  participant: BattleParticipant
) {
  const xpKillCountByUnitKey: Record<string, number> = {};
  for (const event of events) {
    if (event.type !== "unit_kill_recorded") {
      continue;
    }
    const payload = event.payload_json ?? {};
    const earnedXp = payload.earned_xp;
    if (earnedXp === false) {
      continue;
    }
    const killerPayload =
      typeof payload.killer === "object" && payload.killer !== null
        ? (payload.killer as Record<string, unknown>)
        : null;
    if (!killerPayload) {
      continue;
    }
    const killerWarbandId = killerPayload.warband_id;
    const killerUnitKey = killerPayload.unit_key;
    if (killerWarbandId !== participant.warband.id || typeof killerUnitKey !== "string") {
      continue;
    }
    xpKillCountByUnitKey[killerUnitKey] = (xpKillCountByUnitKey[killerUnitKey] ?? 0) + 1;
  }
  return xpKillCountByUnitKey;
}

function defaultGroupXp(
  members: PrebattleUnit[],
  xpKillCountByUnitKey: Record<string, number>
) {
  const kills = members.reduce((total, member) => total + (xpKillCountByUnitKey[member.key] ?? 0), 0);
  return 1 + kills;
}

function createDefaultUnitResult(
  unit: PrebattleUnit,
  unitInformation: BattleUnitInformationEntry,
  xpEarned: number,
  groupName = ""
): BattlePostbattleUnitResult {
  const unitKind =
    unit.kind === "hero" ? "hero" : unit.kind === "hired_sword" ? "hired_sword" : "henchman";
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

export function getDefaultExplorationDiceCount(
  participant: BattleParticipant,
  roster: ParticipantRoster | undefined,
  battle: BattleSummary
) {
  const selected = getParticipantSelectedUnits(participant, roster);
  const unitInformationByKey = toUnitInformationMap(participant.unit_information_json);
  const eligibleHeroCount = selected.heroes.filter(
    (hero) => !getUnitInformationEntry(unitInformationByKey, hero.key).out_of_action
  ).length;
  return Math.max(0, Math.min(10, eligibleHeroCount + getWinnerBonus(battle, participant)));
}

export function buildLocalExplorationState(
  participant: BattleParticipant,
  roster: ParticipantRoster | undefined,
  battle: BattleSummary,
  resources: WarbandResource[]
): LocalExplorationState {
  const diceCount = getDefaultExplorationDiceCount(participant, roster, battle);
  return {
    diceCount,
    diceValues: Array.from({ length: diceCount }, () => null),
    selectedDice: Array.from({ length: diceCount }, (_, index) => index < 6),
    resourceId: resources[0]?.id ?? null,
    hasRolledAllDice: false,
  };
}

export function setLocalExplorationDiceCount(
  state: LocalExplorationState,
  nextDiceCount: number
): LocalExplorationState {
  const cappedCount = Math.max(0, Math.min(10, nextDiceCount));
  const nextDiceValues = state.diceValues.slice(0, cappedCount);
  const nextSelectedDice = state.selectedDice.slice(0, cappedCount);
  while (nextDiceValues.length < cappedCount) {
    nextDiceValues.push(null);
  }
  while (nextSelectedDice.length < cappedCount) {
    nextSelectedDice.push(nextSelectedDice.filter(Boolean).length < 6);
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
  checked: boolean
): LocalExplorationState {
  if (index < 0 || index >= state.selectedDice.length) {
    return state;
  }
  if (checked && !state.selectedDice[index] && state.selectedDice.filter(Boolean).length >= 6) {
    return state;
  }
  return {
    ...state,
    selectedDice: state.selectedDice.map((value, entryIndex) =>
      entryIndex === index ? checked : value
    ),
  };
}

function rollD6Value() {
  return Math.floor(Math.random() * 6) + 1;
}

export function rollAllLocalExplorationDice(state: LocalExplorationState): LocalExplorationState {
  return {
    ...state,
    hasRolledAllDice: true,
    diceValues: state.diceValues.map(() => rollD6Value()),
  };
}

export function rerollLocalExplorationDie(
  state: LocalExplorationState,
  index: number
): LocalExplorationState {
  if (index < 0 || index >= state.diceValues.length) {
    return state;
  }
  return {
    ...state,
    diceValues: state.diceValues.map((value, entryIndex) =>
      entryIndex === index ? rollD6Value() : value
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

export function getExplorationResourceAmount(diceValues: Array<number | null>) {
  const total = diceValues.reduce((sum, value) => sum + (value ?? 0), 0);
  if (total <= 0) {
    return 0;
  }
  if (total <= 5) {
    return 1;
  }
  if (total <= 11) {
    return 2;
  }
  if (total <= 17) {
    return 3;
  }
  if (total <= 24) {
    return 4;
  }
  if (total <= 30) {
    return 5;
  }
  if (total <= 35) {
    return 6;
  }
  return 7;
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
  };
}

function getExistingUnitResult(
  existing: BattlePostbattleState | undefined,
  unitKey: string
) {
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
      : legacyDeathRolls ?? [],
  };
}

export function buildPostbattleDraft(
  battle: BattleSummary,
  participant: BattleParticipant,
  roster: ParticipantRoster | undefined,
  resources: WarbandResource[],
  events: BattleEvent[] = []
): BattlePostbattleState {
  const unitInformationByKey = toUnitInformationMap(participant.unit_information_json);
  const xpKillCountByUnitKey = getXpKillCountByUnitKey(events, participant);
  const selected = getParticipantSelectedUnits(participant, roster);
  const existing = (participant.postbattle_json as BattlePostbattleState | undefined) ?? undefined;

  const nextUnitResults: Record<string, BattlePostbattleUnitResult> = {};

  for (const hero of selected.heroes) {
    const unitInformation = getUnitInformationEntry(unitInformationByKey, hero.key);
    nextUnitResults[hero.key] = {
      ...createDefaultUnitResult(
        hero,
        unitInformation,
        1 + (xpKillCountByUnitKey[hero.key] ?? 0)
      ),
      ...getExistingUnitResult(existing, hero.key),
    };
  }

  for (const hiredSword of selected.hiredSwords) {
    const unitInformation = getUnitInformationEntry(unitInformationByKey, hiredSword.key);
    nextUnitResults[hiredSword.key] = {
      ...createDefaultUnitResult(
        hiredSword,
        unitInformation,
        1 + (xpKillCountByUnitKey[hiredSword.key] ?? 0)
      ),
      ...getExistingUnitResult(existing, hiredSword.key),
    };
  }

  for (const group of roster?.henchmenGroups ?? []) {
    const selectedMembers = group.members.filter((member) =>
      participant.selected_unit_keys_json.includes(member.key)
    );
    if (selectedMembers.length === 0) {
      continue;
    }
    const groupXp = defaultGroupXp(selectedMembers, xpKillCountByUnitKey);
    for (const member of selectedMembers) {
      const unitInformation = getUnitInformationEntry(unitInformationByKey, member.key);
      nextUnitResults[member.key] = {
        ...createDefaultUnitResult(member, unitInformation, groupXp, group.name),
        ...getExistingUnitResult(existing, member.key),
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
        ? existingExploration.dice_values.filter((value): value is number => typeof value === "number")
        : [],
      resource_id:
        existingExploration.resource_id ??
        (resources.length > 0 ? resources[0].id : null),
    },
    unit_results: nextUnitResults,
  };
}

export function buildRenderableGroups(draft: BattlePostbattleState) {
  const heroes: PostbattleRenderableRow[] = [];
  const hiredSwords: PostbattleRenderableRow[] = [];
  const henchmenGroups = new Map<string, PostbattleRenderableRow[]>();

  for (const [unitKey, result] of Object.entries(draft.unit_results)) {
    const row: PostbattleRenderableRow = {
      unitKey,
      unitName: result.unit_name,
      unitType: result.unit_type,
      unitKind: result.unit_kind,
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
    if (result.unit_kind === "hired_sword") {
      hiredSwords.push(row);
      continue;
    }
    const groupKey = result.group_name || "Henchmen";
    const existing = henchmenGroups.get(groupKey) ?? [];
    existing.push(row);
    henchmenGroups.set(groupKey, existing);
  }

  heroes.sort((left, right) => left.unitName.localeCompare(right.unitName));
  hiredSwords.sort((left, right) => left.unitName.localeCompare(right.unitName));

  const groups: PostbattleRenderableGroup[] = [];
  if (heroes.length > 0) {
    groups.push({ key: "heroes", label: "Heroes", unitKind: "hero", rows: heroes });
  }
  for (const [groupName, rows] of henchmenGroups.entries()) {
    rows.sort((left, right) => left.unitName.localeCompare(right.unitName));
    groups.push({ key: `henchmen:${groupName}`, label: groupName, unitKind: "henchman", rows });
  }
  if (hiredSwords.length > 0) {
    groups.push({ key: "hired-swords", label: "Hired Swords", unitKind: "hired_sword", rows: hiredSwords });
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

export function rollD6SeriousInjury(): BattlePostbattleSeriousInjuryRoll {
  const value = Math.floor(Math.random() * 6) + 1;
  const dead = value <= 2;
  return {
    roll_type: "d6",
    rolls: [value],
    result_code: String(value),
    result_label: dead ? "Dead" : "Survives",
    dead_suggestion: dead,
  };
}

export function rollHeroSeriousInjury(mode: CampaignHeroDeathRoll = "d66"): BattlePostbattleSeriousInjuryRoll {
  if (mode === "d100") {
    const value = Math.floor(Math.random() * 100) + 1;
    const guide = HERO_D100_INJURY_GUIDE.find((entry) => value >= entry.min && value <= entry.max) ?? {
      min: value,
      max: value,
      label: "Check the serious injury chart manually",
      dead: false,
    };
    return {
      roll_type: "d100",
      rolls: [value],
      result_code: String(value).padStart(2, "0"),
      result_label: guide.label,
      dead_suggestion: guide.dead,
    };
  }

  const tens = Math.floor(Math.random() * 6) + 1;
  const ones = Math.floor(Math.random() * 6) + 1;
  const code = `${tens}${ones}`;
  const guide = HERO_INJURY_GUIDE[code] ?? {
    code,
    label: "Check the serious injury chart manually",
    dead: false,
  };
  return {
    roll_type: "d66",
    rolls: [tens, ones],
    result_code: guide.code,
    result_label: guide.label,
    dead_suggestion: guide.dead,
  };
}

export function isPostbattleDraftValid(draft: BattlePostbattleState | null) {
  if (!draft) {
    return false;
  }
  return Object.keys(draft.unit_results).length > 0;
}
