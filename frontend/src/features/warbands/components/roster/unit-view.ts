import type { BoxTileKind } from "@/components/ui/box-tile";
import type { StatKey } from "@/components/ui/stat-strip";
import type { CampaignSummary } from "@/features/campaigns/types/campaign-types";
import { STAT_FIELDS, statShown } from "@/features/catalogue/utils/statblock";
import type { Item } from "@/features/items/types/item-types";

import { getHeroLevelInfo } from "../heroes/utils/hero-level";
import {
  DEFAULT_HENCHMEN_LEVEL_THRESHOLDS,
  DEFAULT_HERO_LEVEL_THRESHOLDS,
  normalizeThresholdList,
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

// a 3px stripe, the content where the 1px border left it; the gem's lower point on the baseline
const STRIPE = "border-l-[3px] pl-4";
const GEM = "inline-block h-[7px] w-[7px] shrink-0 -translate-y-[1.5px] rotate-45";
const trim = (stripe: string, gem: string, text: string) => ({
  stripe: `${STRIPE} ${stripe}`,
  gem: `${GEM} ${gem}`,
  text,
});

/**
 * A roster card's trim in its kind's metal (William, 7 Nov 2026: "heroes gold HS silver hench
 * bronze"; mockup C): a stripe down its left edge, a gem (a 7px square turned 45°) before its
 * name, and its type line. A dramatis persona is a hired sword here.
 */
export const KIND_TRIM: Record<RosterUnit["kind"], ReturnType<typeof trim>> = {
  hero: trim("border-l-metal-gold", "bg-metal-gold", "text-metal-gold"),
  henchmen_group: trim("border-l-metal-bronze", "bg-metal-bronze", "text-metal-bronze"),
  hireling: trim("border-l-metal-silver", "bg-metal-silver", "text-metal-silver"),
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

/**
 * The profile for the stat strip: a written stat as the book writes it ("2(2)", "D6"), and M and
 * Sv as the ridden mount makes them (then highlighted).
 */
export function statValues({ unit }: RosterUnit) {
  const effective = unit.effective_stats;
  const save = effective?.armour_save ?? unit.armour_save;
  const written = unit.written_stats ?? {};
  const values: Partial<Record<StatKey, string | number>> = { Sv: save ? `${save}+` : "–" };
  for (const { key, label } of STAT_FIELDS) values[label] = statShown(unit[key], written[key]);
  if (effective?.movement !== undefined && effective.movement !== null)
    values.M = effective.movement;
  const highlighted: StatKey[] = unit.mount ? ["M", "Sv"] : [];
  return { values, highlighted };
}

/** The kind's XP table in the campaign (the XP each advance comes at), cleaned as the level info reads it. */
export const xpTable = (kind: UnitKindKey, campaign: CampaignSummary | null) => {
  const fallback =
    kind === "henchmen_group" ? DEFAULT_HENCHMEN_LEVEL_THRESHOLDS : DEFAULT_HERO_LEVEL_THRESHOLDS;
  const table =
    kind === "henchmen_group"
      ? campaign?.henchmen_level_thresholds
      : kind === "hireling"
        ? campaign?.hired_sword_level_thresholds
        : campaign?.hero_level_thresholds;
  return normalizeThresholdList(table, fallback);
};

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
  const thresholds = xpTable(entry.kind, campaign);
  const info = getHeroLevelInfo(xp, thresholds);
  const next = info.nextLevelAt;
  const span = next === null ? 1 : next - info.currentLevelAt;
  return {
    xp,
    next,
    text: next === null ? `XP ${formatXp(xp)}` : `XP ${formatXp(xp)} / ${next}`,
    share: next === null ? 1 : Math.min(1, (xp - info.currentLevelAt) / span),
    advanceReady: (entry.unit.level_up ?? 0) > 0,
    thresholds,
  };
}

export const itemBoxKind = (item: Item): BoxTileKind =>
  item.beast_kind === "mount" ? "mount" : "item";

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

/** The open card's rows of boxes: items, skills, specials (his injuries among them) and spells. */
export function boxRows(entry: RosterUnit) {
  const { unit } = entry;
  const spells = "spells" in unit ? (unit.spells ?? []) : [];
  return {
    items: isCreature(entry) ? [] : unit.items,
    skills: unit.skills ?? [],
    specials: unit.specials ?? [],
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

/** How many picks an advance left to make later on the unit's `list` (heroes and hired swords). */
export function pendingPicks({ unit }: RosterUnit, list: PendingList) {
  return (
    (unit as Partial<Record<(typeof PENDING_FIELD)[PendingList], number>>)[PENDING_FIELD[list]] ?? 0
  );
}
