import type { StatKey as StripKey } from "@/components/ui/stat-strip";
import {
  getCurrentUnitWounds,
  toUnitInformationMap,
} from "@/features/battles/components/active/active-utils";
import type {
  HenchmenGroupRoster,
  ParticipantRoster,
  PrebattleUnit,
  UnitStats,
} from "@/features/battles/components/prebattle/prebattle-types";
import { normalizeCustomUnits } from "@/features/battles/components/prebattle/prebattle-utils";
import type {
  BattleCreatureStatus,
  BattleNeutralGroup,
  BattleParticipant,
  BattleUnitInformationEntry,
} from "@/features/battles/types/battle-types";
import { helperStats } from "@/features/battles/utils/battle-companions";

/** The four states the status button cycles through (design E). */
export type UnitStatus = BattleCreatureStatus;

export const STATUS_ORDER: readonly UnitStatus[] = [
  "standing",
  "knocked_down",
  "stunned",
  "out_of_action",
];

export const STATUS_LABEL: Record<UnitStatus, string> = {
  standing: "Standing",
  knocked_down: "Knocked down",
  stunned: "Stunned",
  out_of_action: "Out of action",
};

/** Standing → Knocked down → Stunned → Out of action → Standing. */
export const nextStatus = (status: UnitStatus) =>
  STATUS_ORDER[(STATUS_ORDER.indexOf(status) + 1) % STATUS_ORDER.length];

/** A unit's state from its unit information: out of action, else its status, else standing. */
export function unitStatus(info: BattleUnitInformationEntry | undefined): UnitStatus {
  if (info?.out_of_action) return "out_of_action";
  return info?.status ?? "standing";
}

export const STAT_SHORT: Record<keyof UnitStats, StripKey> = {
  movement: "M",
  weapon_skill: "WS",
  ballistic_skill: "BS",
  strength: "S",
  toughness: "T",
  wounds: "W",
  initiative: "I",
  attacks: "A",
  leadership: "Ld",
  armour_save: "Sv",
};

/** A profile as the stat strip shows it: the save as "4+", none as a dash. */
export function statValues(stats: Partial<UnitStats>) {
  const values: Partial<Record<StripKey, string | number>> = {};
  for (const [key, short] of Object.entries(STAT_SHORT) as [keyof UnitStats, StripKey][]) {
    const value = stats[key];
    if (key === "armour_save") {
      values[short] = typeof value === "number" && value > 0 && value < 7 ? `${value}+` : "–";
    } else if (typeof value === "number") {
      values[short] = value;
    }
  }
  return values;
}

/** One of your units as its card shows it: its effective stats, wounds, status and the mount. */
export type BattleUnitView = {
  unit: PrebattleUnit;
  info: BattleUnitInformationEntry | undefined;
  status: UnitStatus;
  stats: UnitStats;
  /** The cells to pick out: M and Sv while mounted, and any battle stat change. */
  highlighted: StripKey[];
  wounds: number;
  maxWounds: number;
  kills: number;
  /** "Warhorse" while the unit has one (ridden or dismounted). */
  mount: string | null;
  dismounted: boolean;
};

export function unitView(
  unit: PrebattleUnit,
  info: BattleUnitInformationEntry | undefined
): BattleUnitView {
  const overrides = info?.stats_override ?? {};
  const mounted = info?.dismounted ? null : unit.effectiveStats;
  const stats = helperStats(unit, overrides as Partial<UnitStats>, info);
  const highlighted = new Set<StripKey>(
    Object.keys(overrides).map((key) => STAT_SHORT[key as keyof UnitStats])
  );
  if (mounted) {
    highlighted.add("M");
    highlighted.add("Sv");
  }
  return {
    unit,
    info,
    status: unitStatus(info),
    stats,
    highlighted: [...highlighted].filter(Boolean),
    wounds: getCurrentUnitWounds(unit, info),
    maxWounds: Math.max(1, Number(stats.wounds ?? 1) || 1),
    kills: info?.kill_count ?? 0,
    mount: unit.mount?.name ?? null,
    dismounted: Boolean(info?.dismounted),
  };
}

/**
 * Whether a unit can log a kill: always one of the warband's own heroes, henchmen or hired
 * swords, never a temporary unit, a pet or a neutral creature (next step 9).
 */
export const canScore = (unit: PrebattleUnit) =>
  unit.kind === "hero" || unit.kind === "henchman" || unit.kind === "hireling";

/** A henchmen group as the battle shows it: the group and its members in this battle. */
export type BattleGroupView = { group: HenchmenGroupRoster; members: BattleUnitView[] };

/** A participant's units in the battle, by section, in the order the cards come. */
export type BattleSections = {
  heroes: BattleUnitView[];
  groups: BattleGroupView[];
  swords: BattleUnitView[];
  pets: BattleUnitView[];
  temporary: BattleUnitView[];
};

export function battleSections(
  participant: BattleParticipant,
  roster: ParticipantRoster | undefined
): BattleSections {
  const selected = new Set(participant.selected_unit_keys_json ?? []);
  const information = toUnitInformationMap(participant.unit_information_json);
  const view = (unit: PrebattleUnit) => unitView(unit, information[unit.key]);
  const pick = (units: PrebattleUnit[] = []) => units.filter((unit) => selected.has(unit.key));
  return {
    heroes: pick(roster?.heroes).map(view),
    groups: (roster?.henchmenGroups ?? [])
      .map((group) => ({ group, members: pick(group.members).map(view) }))
      .filter((entry) => entry.members.length > 0),
    swords: pick(roster?.hirelings).map(view),
    pets: pick(roster?.petModels).map(view),
    temporary: pick(normalizeCustomUnits(participant.custom_units_json)).map(view),
  };
}

/** Every model of a participant in the battle (a henchman each). */
export function allViews(sections: BattleSections) {
  return [
    ...sections.heroes,
    ...sections.groups.flatMap((entry) => entry.members),
    ...sections.swords,
    ...sections.pets,
    ...sections.temporary,
  ];
}

/** A chip in the strip under the top bar: a warband in the battle, or a neutral group. */
export type WarbandSide = {
  kind: "warband";
  id: string;
  name: string;
  participant: BattleParticipant;
  out: number;
  total: number;
  /** The rout test comes once a quarter of the models are out of action. */
  routAt: number;
  mine: boolean;
};

export type NeutralSide = {
  kind: "neutral";
  id: string;
  name: string;
  group: BattleNeutralGroup;
  out: number;
  total: number;
};

export type BattleSide = WarbandSide | NeutralSide;

export const sideId = {
  warband: (warbandId: number) => `warband:${warbandId}`,
  neutral: (groupKey: string) => `neutral:${groupKey}`,
};

/** Players who never came (declined, left before the battle) have no chip. */
const IN_THE_BATTLE = new Set(["in_battle", "finished_battle", "confirmed_postbattle"]);

export function battleSides(
  participants: BattleParticipant[],
  rosters: Record<number, ParticipantRoster | undefined>,
  neutralGroups: BattleNeutralGroup[],
  userId: number | undefined
): BattleSide[] {
  const warbands = participants
    .filter((participant) => IN_THE_BATTLE.has(participant.status))
    .map((participant): WarbandSide => {
      const views = allViews(battleSections(participant, rosters[participant.user.id]));
      const out = views.filter((entry) => entry.status === "out_of_action").length;
      return {
        kind: "warband",
        id: sideId.warband(participant.warband.id),
        name: participant.warband.name,
        participant,
        out,
        total: views.length,
        routAt: Math.max(1, Math.ceil(views.length / 4)),
        mine: participant.user.id === userId,
      };
    })
    .sort((left, right) => Number(right.mine) - Number(left.mine));
  const neutrals = neutralGroups.map(
    (group): BattleSide => ({
      kind: "neutral",
      id: sideId.neutral(group.key),
      name: group.name,
      group,
      out: group.creatures.filter((creature) => creature.status === "out_of_action").length,
      total: group.creatures.length,
    })
  );
  return [...warbands, ...neutrals];
}

/** "1 of 15 out · rout at 4", or "1 of 4 out" for a neutral group. */
export function sideLine(side: BattleSide) {
  const out = `${side.out} of ${side.total} out`;
  return side.kind === "warband" ? `${out} · rout at ${side.routAt}` : out;
}

/** A victim the kill sheet offers: a model of another warband, or a neutral creature. */
export type VictimOption = {
  id: string;
  name: string;
  detail: string;
  unitKey?: string;
  neutralKey?: string;
};

/**
 * Who a kill can take out on one side (design E): its heroes, hired swords, pets and temporary
 * units, a henchmen group as one row ("A Brethren") that takes its first standing member, or a
 * neutral group's creatures. Models already out of action are left out.
 */
export function victimOptions(
  side: BattleSide,
  rosters: Record<number, ParticipantRoster | undefined>
): VictimOption[] {
  if (side.kind === "neutral") {
    return side.group.creatures
      .filter((creature) => creature.status !== "out_of_action")
      .map((creature) => ({
        id: creature.key,
        name: creature.name,
        detail: `Neutral · ${STATUS_LABEL[creature.status].toLowerCase()}`,
        neutralKey: creature.key,
      }));
  }
  const sections = battleSections(side.participant, rosters[side.participant.user.id]);
  const single = (entry: BattleUnitView, kind: string): VictimOption => ({
    id: entry.unit.key,
    name: entry.unit.displayName,
    detail: `${entry.unit.unitType} · ${kind}`,
    unitKey: entry.unit.key,
  });
  const standing = (entry: BattleUnitView) => entry.status !== "out_of_action";
  return [
    ...sections.heroes.filter(standing).map((entry) => single(entry, "hero")),
    ...sections.groups.flatMap(({ group, members }) => {
      const up = members.filter(standing);
      return up.length
        ? [
            {
              id: up[0].unit.key,
              name: `A ${group.unitType || group.name}`,
              detail: `Henchman · ${up.length} of ${members.length} standing`,
              unitKey: up[0].unit.key,
            },
          ]
        : [];
    }),
    ...sections.swords.filter(standing).map((entry) => single(entry, "hired sword")),
    ...sections.pets.filter(standing).map((entry) => single(entry, "animal")),
    ...sections.temporary.filter(standing).map((entry) => single(entry, "temporary")),
  ];
}
