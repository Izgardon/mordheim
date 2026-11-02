import type { BoxTileKind } from "@/components/ui/box-tile";
import type { StatKey } from "@/components/ui/stat-strip";
import type { CampaignSummary } from "@/features/campaigns/types/campaign-types";
import type { Item } from "@/features/items/types/item-types";

import { getHeroLevelInfo } from "../heroes/utils/hero-level";
import {
  DEFAULT_HENCHMEN_LEVEL_THRESHOLDS,
  DEFAULT_HERO_LEVEL_THRESHOLDS,
} from "../../utils/level-thresholds";
import { isCreatureGroup } from "../../utils/companions";
import type { Unit, UnitKindKey, UnitListKey } from "../../types/units";
import type { HenchmenGroup, UnitKill } from "../../types/warband-types";

/** A unit on the roster with its kind, so one card serves heroes, groups and hired swords. */
export type RosterUnit =
  | { kind: "hero"; unit: Unit<"hero"> }
  | { kind: "henchmen_group"; unit: Unit<"henchmen_group"> }
  | { kind: "hireling"; unit: Unit<"hireling"> };

export const LIST_KEY: Record<UnitKindKey, UnitListKey> = {
  hero: "heroes",
  henchmen_group: "henchmenGroups",
  hireling: "hirelings",
};

export const unitKey = ({ kind, unit }: RosterUnit) => `${kind}-${unit.id}`;

/** A card's DOM id, which a `?unit=` link scrolls to. */
export const unitDomId = (entry: RosterUnit) => `unit-${unitKey(entry)}`;

export const unitName = (unit: { name: string | null; unit_type: string | null }) =>
  unit.name?.trim() || unit.unit_type?.trim() || "Unnamed";

const KIND_WORD: Record<RosterUnit["kind"], string> = {
  hero: "Hero",
  henchmen_group: "Henchmen",
  hireling: "Hired sword",
};

/**
 * The line under a card's name: its type, or what it is when the type is the name already (a
 * dramatis persona hired as himself, a hero with no name), so the card never prints it twice.
 */
export function unitTypeLine(entry: RosterUnit) {
  const type = entry.unit.unit_type?.trim() ?? "";
  if (type.toLowerCase() !== unitName(entry.unit).toLowerCase()) return type;
  if (entry.kind === "hireling" && entry.unit.kind === "dramatis_persona")
    return "Dramatis persona";
  return type ? KIND_WORD[entry.kind] : "";
}

export const isGroup = (
  entry: RosterUnit
): entry is { kind: "henchmen_group"; unit: HenchmenGroup } => entry.kind === "henchmen_group";

export const isCreature = (entry: RosterUnit) => isGroup(entry) && isCreatureGroup(entry.unit);

export const liveMembers = (group: HenchmenGroup) =>
  group.henchmen.filter((member) => !member.dead);

/**
 * A henchman's name, else his group's type and his number among its living members ("Wardogs 2"),
 * as the battle calls him: creature groups' members have no names.
 */
export function memberName(group: HenchmenGroup, member: { id: number; name?: string | null }) {
  const number = liveMembers(group).findIndex((entry) => entry.id === member.id) + 1;
  return member.name?.trim() || `${group.unit_type?.trim() || "Henchman"} ${number || ""}`.trim();
}

/** The profile for the stat strip; M and Sv read the ridden mount, which is then highlighted. */
export function statValues({ unit }: RosterUnit) {
  const effective = unit.effective_stats;
  const save = effective?.armour_save ?? unit.armour_save;
  const values: Partial<Record<StatKey, string | number>> = {
    M: effective?.movement ?? unit.movement ?? undefined,
    WS: unit.weapon_skill ?? undefined,
    BS: unit.ballistic_skill ?? undefined,
    S: unit.strength ?? undefined,
    T: unit.toughness ?? undefined,
    W: unit.wounds ?? undefined,
    I: unit.initiative ?? undefined,
    A: unit.attacks ?? undefined,
    Ld: unit.leadership ?? undefined,
    Sv: save ? `${save}+` : "–",
  };
  const highlighted: StatKey[] = unit.mount ? ["M", "Sv"] : [];
  return { values, highlighted };
}

export const gearSummary = (items: Item[]) =>
  items.length ? items.map((item) => item.name).join(", ") : "No gear";

const thresholdsFor = (kind: UnitKindKey, campaign: CampaignSummary | null) =>
  kind === "henchmen_group"
    ? (campaign?.henchmen_level_thresholds ?? DEFAULT_HENCHMEN_LEVEL_THRESHOLDS)
    : kind === "hireling"
      ? (campaign?.hired_sword_level_thresholds ?? DEFAULT_HERO_LEVEL_THRESHOLDS)
      : (campaign?.hero_level_thresholds ?? DEFAULT_HERO_LEVEL_THRESHOLDS);

/** XP as the card shows it: half a point is "½" (a half-rate unit keeps fractions), "12½". */
export function formatXp(xp: number) {
  const whole = Math.floor(xp);
  const half = xp - whole >= 0.5;
  return half ? `${whole || ""}½` : String(whole);
}

/** XP against the next threshold: "XP 24 / 28", the bar's share, and whether an advance waits. */
export function xpInfo(entry: RosterUnit, campaign: CampaignSummary | null) {
  if (isCreature(entry)) return null;
  const xp = Number(entry.unit.xp ?? 0);
  const info = getHeroLevelInfo(xp, thresholdsFor(entry.kind, campaign));
  const next = info.nextLevelAt;
  const span = next === null ? 1 : next - info.currentLevelAt;
  return {
    xp,
    next,
    text: next === null ? `XP ${formatXp(xp)}` : `XP ${formatXp(xp)} / ${next}`,
    share: next === null ? 1 : Math.min(1, (xp - info.currentLevelAt) / span),
    advanceReady: (entry.unit.level_up ?? 0) > 0,
  };
}

export const itemBoxKind = (item: Item): BoxTileKind =>
  item.beast_kind === "mount" ? "mount" : "item";

/** A special that is a lasting injury (its type says so: the injury tables make them "Injury"). */
export const isInjury = (special: { type?: string | null }) => /injur/i.test(special.type ?? "");

/**
 * One line of a unit's Kills list: "Magister Halvard · Street Fight · round 2 · melee", with the
 * model who scored it for a henchmen group ("· by Kurt"). A kill logged after the fight has no
 * round; a battle with no scenario shows its date.
 */
export function killLine(kill: UnitKill) {
  const when = kill.scenario.trim()
    ? kill.scenario
    : new Date(kill.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const round = kill.round
    ? `round ${kill.round}`
    : kill.phase === "after"
      ? "after the fight"
      : "";
  return [kill.victim, when, round, kill.how ?? "", kill.by ? `by ${kill.by}` : ""]
    .filter(Boolean)
    .join(" · ");
}

/** The open card's rows of boxes: items, skills, specials, spells and injuries. */
export function boxRows(entry: RosterUnit) {
  const { unit } = entry;
  const specials = unit.specials ?? [];
  const spells = "spells" in unit ? (unit.spells ?? []) : [];
  return {
    items: isCreature(entry) ? [] : unit.items,
    skills: unit.skills ?? [],
    specials: specials.filter((special) => !isInjury(special)),
    injuries: specials.filter(isInjury),
    spells,
  };
}

/** A list a pick made later goes into: an advance's "Skill to choose" (spell, special). */
export type PendingList = "skills" | "spells" | "specials";

const PENDING_FIELD = {
  skills: "pending_skills",
  spells: "pending_spells",
  specials: "pending_specials",
} as const;
const ID_FIELD = { skills: "skill_ids", spells: "spell_ids", specials: "special_ids" } as const;

/** How many picks an advance left to make later on the unit's `list` (heroes and hired swords). */
export function pendingPicks({ unit }: RosterUnit, list: PendingList) {
  return (
    (unit as Partial<Record<(typeof PENDING_FIELD)[PendingList], number>>)[PENDING_FIELD[list]] ?? 0
  );
}

/** The save that makes one pick: the chosen entry joins the list, and one pick fewer is left. */
export function pickPayload(entry: RosterUnit, list: PendingList, entryId: number) {
  const unit = entry.unit as Partial<Record<PendingList, { id: number }[]>>;
  return {
    [ID_FIELD[list]]: [...(unit[list] ?? []).map(({ id }) => id), entryId],
    [PENDING_FIELD[list]]: Math.max(0, pendingPicks(entry, list) - 1),
  };
}
