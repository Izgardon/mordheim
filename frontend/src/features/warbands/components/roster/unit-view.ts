import type { BoxTileKind } from "@/components/ui/box-tile";
import type { UnitMarker } from "@/components/ui/game-icons";
import type { StatKey } from "@/components/ui/stat-strip";
import type { CampaignSummary } from "@/features/campaigns/types/campaign-types";
import { STAT_FIELDS, statShown } from "@/features/catalogue/utils/statblock";
import { itemKind } from "@/features/items/item-kind";
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

// a 3px stripe, the content where the 1px border left it
const STRIPE = "border-l-[3px] pl-4";
const trim = (stripe: string, text: string) => ({ stripe: `${STRIPE} ${stripe}`, text });

/**
 * A roster card's trim in its kind's metal (William, 7 Nov 2026: "heroes gold HS silver hench
 * bronze"; mockup C): a stripe down its left edge, and its marker and type line. A dramatis
 * persona is a hired sword here.
 */
export const KIND_TRIM: Record<RosterUnit["kind"], ReturnType<typeof trim>> = {
  hero: trim("border-l-metal-gold", "text-metal-gold"),
  henchmen_group: trim("border-l-metal-bronze", "text-metal-bronze"),
  hireling: trim("border-l-metal-silver", "text-metal-silver"),
};

/** The game icon before a card's name: the leader's crown, a hero's helmet, a group, a hired sword. */
export function unitMarker(entry: RosterUnit): UnitMarker {
  if (entry.kind === "henchmen_group") {
    if (entry.unit.is_animal) return "animal";
    const ranged = entry.unit.items.some((item) =>
      ["missile", "blackpowder"].includes(itemKind(item))
    );
    return ranged ? "henchmen_ranged" : "henchmen";
  }
  if (entry.kind === "hireling") return "hired";
  if (entry.unit.is_leader) return "leader";
  // a hero who casts shows what kind of caster he is; the leader keeps his crown
  if (entry.unit.caster === "Priest") return "priest";
  if (entry.unit.caster === "Wizard") return "wizard";
  return "hero";
}

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

/**
 * Whether the card offers his loadout (the closed card's Loadout, the open card's Add item). A
 * creature group carries none, and a hired sword keeps the kit he came with (William, 21 Nov 2026):
 * his Edit form still adds and takes away.
 */
export const buysItems = (entry: RosterUnit) => entry.kind !== "hireling" && !isCreature(entry);

export const liveMembers = (group: HenchmenGroup) =>
  group.henchmen.filter((member) => !member.dead);

/**
 * The profile for the stat strip: a written stat as the book writes it ("2(2)", "D6"), and M as the
 * ridden mount makes it (then highlighted). Sv is the unit's own: mounting and armour write it.
 */
export function statValues({ unit }: RosterUnit) {
  const effective = unit.effective_stats;
  const save = unit.armour_save;
  const written = unit.written_stats ?? {};
  const values: Partial<Record<StatKey, string | number>> = { Sv: save ? `${save}+` : "–" };
  for (const { key, label } of STAT_FIELDS) values[label] = statShown(unit[key], written[key]);
  if (effective?.movement !== undefined && effective.movement !== null)
    values.M = effective.movement;
  const highlighted: StatKey[] = unit.mount ? ["M"] : [];
  return { values, highlighted };
}

/** The kind's XP table in the campaign (the XP each advance comes at), cleaned as the level info reads it. */
export const xpTable = (kind: UnitKindKey, campaign: CampaignSummary | null) => {
  // hired swords fall back to the henchmen table with henchmen groups (William, 12 Nov 2026)
  const fallback =
    kind === "hero" ? DEFAULT_HERO_LEVEL_THRESHOLDS : DEFAULT_HENCHMEN_LEVEL_THRESHOLDS;
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

const BEASTS = new Set(["mount", "creature", "pet"]);

/** An item's box: a mount, creature or pet stands out (William, 25 Nov 2026), any other item is an item. */
export const itemBoxKind = (item: Item): BoxTileKind =>
  BEASTS.has(itemKind(item)) ? "beast" : "item";

/** How a kill was scored, as a kill's line ends (William, 22 Nov 2026). */
const KILL_HOW: Record<NonNullable<UnitKill["how"]>, string> = {
  melee: "in melee",
  shooting: "with ranged",
  magic: "with magic",
  other: "by other means",
};

/**
 * One line of a unit's Kills list: the victim's name and how they fell (William, 22 Nov 2026:
 * "should just read the name followed by 'in melee' or with ranged or with magic etc"), "Magister
 * Halvard in melee"; the victim alone when the battle logged no how.
 */
export function killLine(kill: UnitKill) {
  return kill.how ? `${kill.victim} ${KILL_HOW[kill.how]}` : kill.victim;
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
