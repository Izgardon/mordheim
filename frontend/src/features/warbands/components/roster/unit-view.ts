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
import type { HenchmenGroup } from "../../types/warband-types";

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

export const unitName = (unit: { name: string | null; unit_type: string | null }) =>
  unit.name?.trim() || unit.unit_type?.trim() || "Unnamed";

export const isGroup = (
  entry: RosterUnit
): entry is { kind: "henchmen_group"; unit: HenchmenGroup } => entry.kind === "henchmen_group";

export const isCreature = (entry: RosterUnit) => isGroup(entry) && isCreatureGroup(entry.unit);

export const liveMembers = (group: HenchmenGroup) =>
  group.henchmen.filter((member) => !member.dead);

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

/** XP against the next threshold: "XP 24 / 28", the bar's share, and whether an advance waits. */
export function xpInfo(entry: RosterUnit, campaign: CampaignSummary | null) {
  if (isCreature(entry)) return null;
  const xp = entry.unit.xp ?? 0;
  const info = getHeroLevelInfo(xp, thresholdsFor(entry.kind, campaign));
  const next = info.nextLevelAt;
  const span = next === null ? 1 : next - info.currentLevelAt;
  return {
    xp,
    next,
    text: next === null ? `XP ${xp}` : `XP ${xp} / ${next}`,
    share: next === null ? 1 : Math.min(1, (xp - info.currentLevelAt) / span),
    advanceReady: (entry.unit.level_up ?? 0) > 0,
  };
}

export const itemBoxKind = (item: Item): BoxTileKind =>
  item.beast_kind === "mount" ? "mount" : "item";

const isInjury = (special: { type?: string | null }) => /injur/i.test(special.type ?? "");

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
