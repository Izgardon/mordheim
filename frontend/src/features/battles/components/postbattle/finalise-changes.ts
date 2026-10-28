import { injuryEffectText } from "@/features/battles/components/postbattle/PostbattleInjuryResult";
import type { PostbattleRenderableRow } from "@/features/battles/components/postbattle/postbattle-utils";
import type { ParticipantRoster } from "@/features/battles/components/prebattle/prebattle-types";
import type { BattleEvent } from "@/features/battles/types/battle-types";
import type { CampaignSummary } from "@/features/campaigns/types/campaign-types";
import { getHenchmenLevelInfo } from "@/features/warbands/components/henchmen/utils/henchmen-level";
import { getHeroLevelInfo } from "@/features/warbands/components/heroes/utils/hero-level";
import type { WarbandSheet } from "@/features/warbands/types/warband-sheet";

/**
 * The permanent changes the finalise summary adds (BATL-NEW-10), each worked out from what the
 * page already holds: the draft's rows, the battle's events, the start roster, the warband's
 * cached sheet and the campaign's level-up thresholds.
 */

const idOf = (unitKey: string) => Number(unitKey.split(":")[1]);

type XpUnit = Pick<PostbattleRenderableRow, "unitKey" | "unitName" | "unitKind" | "groupName"> & {
  xpEarned: number;
};

export type LevelUpLine = {
  key: string;
  unitName: string;
  levelUps: number;
  /** The unit's XP before and after, when the sheet has it. */
  xpFrom?: number;
  xpTo?: number;
};

type ServerSuggestions = Record<string, { xp_earned: number; level_ups?: number }> | undefined;

/**
 * Who reaches a level-up with this battle's XP. The server's count (`level_ups`, BATL-NEW-10:
 * campaign tables, half rate, the XP high-water mark) wherever the XP is the one it suggested;
 * for XP changed by hand, the campaign's thresholds from the sheet's XP (heroes and hired swords
 * on the heroes' table, henchmen groups on theirs; half-rate units gain half). A henchmen group
 * is counted once.
 */
export function buildLevelUps(
  xpAwards: XpUnit[],
  sheet: WarbandSheet | undefined,
  campaign: Pick<CampaignSummary, "hero_level_thresholds" | "henchmen_level_thresholds"> | null,
  server?: ServerSuggestions
): LevelUpLine[] {
  const lines: LevelUpLine[] = [];
  const countedGroups = new Set<number>();
  const serverGroups = new Set<string>();
  for (const award of xpAwards) {
    const suggested = server?.[award.unitKey];
    if (
      suggested &&
      typeof suggested.level_ups === "number" &&
      suggested.xp_earned === award.xpEarned
    ) {
      const groupKey = award.unitKind === "henchman" ? `group:${award.groupName}` : award.unitKey;
      if (serverGroups.has(groupKey)) continue;
      serverGroups.add(groupKey);
      if (suggested.level_ups > 0) {
        const name =
          award.unitKind === "henchman" ? award.groupName || award.unitName : award.unitName;
        lines.push({ key: groupKey, unitName: name, levelUps: suggested.level_ups });
      }
      continue;
    }
    if (!sheet) continue;
    const id = idOf(award.unitKey);
    let unit: { xp: number | null; half_rate: boolean | null; no_level_ups?: boolean | null };
    let key = award.unitKey;
    let unitName = award.unitName;
    let levelOf = (xp: number) => getHeroLevelInfo(xp, campaign?.hero_level_thresholds).level;
    if (award.unitKind === "henchman") {
      // A sheet read before its lists arrived (or without them) counts nothing.
      const group = (sheet.henchmen_groups ?? []).find((entry) =>
        (entry.henchmen ?? []).some((henchman) => henchman.id === id)
      );
      if (!group || countedGroups.has(group.id)) continue;
      countedGroups.add(group.id);
      unit = group;
      key = `group:${group.id}`;
      unitName = award.groupName || group.name || award.unitName;
      levelOf = (xp) => getHenchmenLevelInfo(xp, campaign?.henchmen_level_thresholds).level;
    } else {
      const found =
        award.unitKind === "hero"
          ? (sheet.heroes ?? []).find((hero) => hero.id === id)
          : (sheet.hirelings ?? []).find((hireling) => hireling.id === id);
      if (!found) continue;
      unit = found;
    }
    if (unit.no_level_ups) continue;
    const xpFrom = Number(unit.xp ?? 0);
    const xpTo = xpFrom + (unit.half_rate ? award.xpEarned / 2 : award.xpEarned);
    const levelUps = levelOf(Math.floor(xpTo)) - levelOf(Math.floor(xpFrom));
    if (levelUps > 0) {
      lines.push({ key, unitName, levelUps, xpFrom, xpTo });
    }
  }
  return lines;
}

const rosterUnits = (roster: ParticipantRoster | undefined) => [
  ...(roster?.heroes ?? []),
  ...(roster?.hirelings ?? []),
  ...(roster?.henchmenGroups ?? []).flatMap((group) => group.members),
];

/** The single-use items this player used in the battle and didn't undo: used up at finalise. */
export function buildItemsUsed(
  events: BattleEvent[],
  userId: number | undefined,
  roster: ParticipantRoster | undefined
) {
  const units = rosterUnits(roster);
  return events.flatMap((event) => {
    if (event.type !== "item_used" || event.voided_at || event.actor_user_id !== userId) {
      return [];
    }
    const unitKey = String(event.payload_json?.unit_key ?? "");
    const unitName = units.find((unit) => unit.key === unitKey)?.displayName ?? unitKey;
    return [{ key: String(event.id), unitName, itemName: event.payload_json?.item_name ?? "" }];
  });
}

/** Each unit's last serious-injury roll: applied at finalise when ticked, or to apply by hand. */
export function buildInjuries(rows: PostbattleRenderableRow[]) {
  return rows.flatMap((row) => {
    const roll = row.seriousInjuryRolls[row.seriousInjuryRolls.length - 1];
    const kind = roll?.effect?.kind;
    if (!roll || !kind || kind === "none") {
      return [];
    }
    if (kind === "manual") {
      return [
        { unitKey: row.unitKey, text: `${row.unitName}: ${roll.result_label}`, byHand: true },
      ];
    }
    if (roll.apply === false) {
      return [];
    }
    const effect = injuryEffectText(roll);
    const text = `${row.unitName}: ${roll.result_label}${effect ? ` (${effect})` : ""}`;
    return [{ unitKey: row.unitKey, text, byHand: false }];
  });
}

/**
 * What dies with each dead unit (pass 2 decision 7): a hero's or hired sword's carried items, or
 * one of each of a dead henchman's group items, from the start roster.
 */
export function buildItemsLost(
  rows: PostbattleRenderableRow[],
  roster: ParticipantRoster | undefined
) {
  const units = rosterUnits(roster);
  return rows.flatMap((row) => {
    const items = row.dead
      ? (units.find((unit) => unit.key === row.unitKey)?.items ?? []).map((item) => item.name)
      : [];
    return items.length > 0
      ? [
          {
            unitKey: row.unitKey,
            unitName: row.unitName,
            henchman: row.unitKind === "henchman",
            items,
          },
        ]
      : [];
  });
}

/** The warband's gold once finalised: today's, plus found gold (a Reward), less paid upkeep. */
export function buildGold({
  sheet,
  findsGoldCrowns,
  upkeepPaid,
}: {
  sheet: WarbandSheet | undefined;
  findsGoldCrowns: number;
  upkeepPaid: number;
}) {
  const current = sheet?.warband?.gold ?? sheet?.summary?.gold;
  if (typeof current !== "number") {
    return null;
  }
  return { current, findsGoldCrowns, upkeepPaid, after: current + findsGoldCrowns - upkeepPaid };
}
