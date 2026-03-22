import type {
  BattleParticipant,
  BattlePostbattleDeathRoll,
  BattlePostbattleState,
  BattlePostbattleUnitResult,
  BattleSummary,
  BattleUnitInformationEntry,
} from "@/features/battles/types/battle-types";
import type { ParticipantRoster, PrebattleUnit } from "@/features/battles/components/prebattle/prebattle-types";
import type { WarbandResource } from "@/features/warbands/types/warband-types";

import { getParticipantSelectedUnits, toUnitInformationMap } from "@/features/battles/components/active/active-utils";

type SeriousInjuryGuide = {
  code: string;
  label: string;
  dead: boolean;
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
  deathRolls: BattlePostbattleDeathRoll[];
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

function defaultGroupXp(members: PrebattleUnit[], unitInformationByKey: Record<string, BattleUnitInformationEntry>) {
  const survives = members.some((member) => !getUnitInformationEntry(unitInformationByKey, member.key).out_of_action);
  const kills = members.reduce(
    (total, member) => total + getUnitInformationEntry(unitInformationByKey, member.key).kill_count,
    0
  );
  return (survives ? 1 : 0) + kills;
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
    death_rolls: [],
  };
}

function createDefaultExplorationDice(
  participant: BattleParticipant,
  roster: ParticipantRoster | undefined,
  battle: BattleSummary,
  existingDice: BattlePostbattleState["exploration"]["dice"]
) {
  const selected = getParticipantSelectedUnits(participant, roster);
  const unitInformationByKey = toUnitInformationMap(participant.unit_information_json);
  const eligibleHeroKeys = selected.heroes
    .filter((hero) => !getUnitInformationEntry(unitInformationByKey, hero.key).out_of_action)
    .map((hero) => hero.key);

  const desiredKeys = [
    ...eligibleHeroKeys.map((heroKey) => ({ key: `hero:${heroKey}`, source: "hero" as const, hero_unit_key: heroKey })),
  ];
  if (getWinnerBonus(battle, participant) > 0) {
    desiredKeys.push({ key: "winner-bonus", source: "winner_bonus" as const, hero_unit_key: null });
  }

  return desiredKeys.map((entry, index) => {
    const existing = existingDice.find((die) => die.key === entry.key);
    return {
      key: entry.key,
      source: entry.source,
      value: existing?.value ?? ((index % 6) + 1),
      hero_unit_key: entry.hero_unit_key,
    };
  });
}

export function buildPostbattleDraft(
  battle: BattleSummary,
  participant: BattleParticipant,
  roster: ParticipantRoster | undefined,
  resources: WarbandResource[]
): BattlePostbattleState {
  const unitInformationByKey = toUnitInformationMap(participant.unit_information_json);
  const selected = getParticipantSelectedUnits(participant, roster);
  const existing = (participant.postbattle_json as BattlePostbattleState | undefined) ?? undefined;

  const nextUnitResults: Record<string, BattlePostbattleUnitResult> = {};

  for (const hero of selected.heroes) {
    const unitInformation = getUnitInformationEntry(unitInformationByKey, hero.key);
    nextUnitResults[hero.key] = {
      ...createDefaultUnitResult(
        hero,
        unitInformation,
        (unitInformation.out_of_action ? 0 : 1) + unitInformation.kill_count
      ),
      ...(existing?.unit_results?.[hero.key] ?? {}),
    };
  }

  for (const hiredSword of selected.hiredSwords) {
    const unitInformation = getUnitInformationEntry(unitInformationByKey, hiredSword.key);
    nextUnitResults[hiredSword.key] = {
      ...createDefaultUnitResult(
        hiredSword,
        unitInformation,
        (unitInformation.out_of_action ? 0 : 1) + unitInformation.kill_count
      ),
      ...(existing?.unit_results?.[hiredSword.key] ?? {}),
    };
  }

  for (const group of roster?.henchmenGroups ?? []) {
    const selectedMembers = group.members.filter((member) =>
      participant.selected_unit_keys_json.includes(member.key)
    );
    if (selectedMembers.length === 0) {
      continue;
    }
    const groupXp = defaultGroupXp(selectedMembers, unitInformationByKey);
    for (const member of selectedMembers) {
      const unitInformation = getUnitInformationEntry(unitInformationByKey, member.key);
      nextUnitResults[member.key] = {
        ...createDefaultUnitResult(member, unitInformation, groupXp, group.name),
        ...(existing?.unit_results?.[member.key] ?? {}),
      };
    }
  }

  const existingExploration = existing?.exploration ?? {
    dice: [],
    shard_total: 0,
    resource_id: null,
  };

  return {
    exploration: {
      dice: createDefaultExplorationDice(participant, roster, battle, existingExploration.dice ?? []),
      shard_total: Number(existingExploration.shard_total ?? 0),
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
      deathRolls: result.death_rolls,
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

export function getExplorationGuide(dice: BattlePostbattleState["exploration"]["dice"]) {
  if (dice.length === 0) {
    return "No eligible heroes available for exploration dice.";
  }
  const counts = new Map<number, number>();
  for (const die of dice) {
    counts.set(die.value, (counts.get(die.value) ?? 0) + 1);
  }
  const duplicateFaces = Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .sort((left, right) => right[1] - left[1] || right[0] - left[0]);
  if (duplicateFaces.length === 0) {
    return "No doubles or higher. Check the total and standard exploration result manually.";
  }
  const [face, count] = duplicateFaces[0];
  const label = count === 2 ? "Double" : count === 3 ? "Triple" : count === 4 ? "Quad" : `${count}x`;
  return `${label} ${face}s rolled. Check the exploration table for the matching special result if needed.`;
}

export function rollD6Death(): BattlePostbattleDeathRoll {
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

export function rollHeroDeath(): BattlePostbattleDeathRoll {
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
  if (draft.exploration.shard_total < 0) {
    return false;
  }
  return Object.keys(draft.unit_results).length > 0;
}
