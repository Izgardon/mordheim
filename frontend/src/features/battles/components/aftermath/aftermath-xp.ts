import type { CampaignSummary } from "@/features/campaigns/types/campaign-types";
import type {
  BattlePostbattleAdvance,
  BattlePostbattleState,
  BattlePostbattleSuggestion,
} from "@/features/battles/types/battle-types";
import type { WarbandSheet } from "@/features/warbands/types/warband-sheet";
import {
  DEFAULT_HENCHMEN_LEVEL_THRESHOLDS,
  DEFAULT_HERO_LEVEL_THRESHOLDS,
  normalizeThresholdList,
} from "@/features/warbands/utils/level-thresholds";
import {
  isTalentBarred,
  LADS_GOT_TALENT,
  needsHero1d6Followup,
  resolveAdvanceLabel,
  resolveHenchmen2d6Stat,
  resolveHero1d6Stat,
  resolveHero2d6Stat,
} from "@/features/warbands/utils/levelup-utils";

/** One unit's line on the Experience tab: a hero, a hired sword, or a henchmen group. */
export type XpRow = {
  key: string;
  /** The draft results it writes: the unit's own, or every member of the group. */
  resultKeys: string[];
  name: string;
  type: string;
  group: boolean;
  from: number;
  earned: number;
  to: number;
  halfRate: boolean;
  canGainXp: boolean;
  reasons: string;
  thresholds: number[];
  advances: BattlePostbattleAdvance[];
  /** A group's level-up codes before this battle, oldest first: what a repeat is measured against. */
  history: string[];
};

const idOf = (unitKey: string) => Number(unitKey.split(":")[1]);
const reasonText = (reasons?: { label: string; xp: number }[]) =>
  (reasons ?? []).map((reason) => `${reason.label} +${reason.xp}`).join(" · ");

/**
 * The Experience tab's rows from the draft: each unit's XP before the battle (its sheet), what it
 * earns (half for a slow learner), why, its table (a hired sword's own, William, 7 Nov 2026)
 * and the advances already rolled.
 */
export function buildXpRows(
  draft: BattlePostbattleState,
  sheet: WarbandSheet | undefined,
  campaign: CampaignSummary | null,
  suggestion: BattlePostbattleSuggestion | undefined
): XpRow[] {
  const heroTable = normalizeThresholdList(
    campaign?.hero_level_thresholds,
    DEFAULT_HERO_LEVEL_THRESHOLDS
  );
  const hiredSwordTable = normalizeThresholdList(
    campaign?.hired_sword_level_thresholds,
    DEFAULT_HENCHMEN_LEVEL_THRESHOLDS // the same levels and gaps as henchmen (William, 12 Nov 2026)
  );
  const groupTable = normalizeThresholdList(
    campaign?.henchmen_level_thresholds,
    DEFAULT_HENCHMEN_LEVEL_THRESHOLDS
  );
  const rows: XpRow[] = [];
  const groups = new Map<number, XpRow>();
  for (const [key, result] of Object.entries(draft.unit_results)) {
    const reasons = reasonText(suggestion?.unit_results[key]?.reasons);
    if (result.unit_kind === "henchman") {
      const group = sheet?.henchmen_groups.find((entry) =>
        entry.henchmen.some((member) => member.id === idOf(key))
      );
      if (!group) continue;
      const known = groups.get(group.id);
      if (known) {
        known.resultKeys.push(key);
        continue;
      }
      const row = xpRow(key, result.xp_earned, group.xp ?? 0, Boolean(group.half_rate), {
        name: group.name,
        type: `Henchmen ×${group.henchmen.filter((member) => !member.dead).length}`,
        group: true,
        canGainXp: !group.no_level_ups,
        reasons,
        thresholds: groupTable,
        advances: result.advances ?? [],
        history: (group.level_up_history ?? []).map((record) => record.code),
      });
      groups.set(group.id, row);
      rows.push(row);
      continue;
    }
    const unit =
      result.unit_kind === "hero"
        ? sheet?.heroes.find((hero) => hero.id === idOf(key))
        : sheet?.hirelings.find((sword) => sword.id === idOf(key));
    if (!unit) continue;
    const noXp = "no_level_ups" in unit && Boolean(unit.no_level_ups);
    rows.push(
      xpRow(key, result.xp_earned, Number(unit.xp ?? 0), Boolean(unit.half_rate), {
        name: result.unit_name,
        type: result.unit_type,
        group: false,
        canGainXp: !noXp,
        reasons,
        thresholds: result.unit_kind === "hero" ? heroTable : hiredSwordTable,
        advances: result.advances ?? [],
        history: [],
      })
    );
  }
  return rows;
}

function xpRow(
  key: string,
  earned: number,
  from: number,
  halfRate: boolean,
  rest: Omit<XpRow, "key" | "resultKeys" | "from" | "earned" | "to" | "halfRate">
): XpRow {
  const to = from + earned * (halfRate ? 0.5 : 1);
  return { key, resultKeys: [key], from, earned, to, halfRate, ...rest };
}

/** The thresholds this battle's XP crosses (whole XP only), the boxes of the block shown, and more. */
export function xpBlock(row: XpRow) {
  const crossed = row.thresholds.filter((at) => at > row.from && at <= Math.floor(row.to));
  const done = row.advances.length;
  const ahead = row.thresholds.filter((at) => at > row.from);
  const next = ahead[done] ?? row.thresholds[row.thresholds.length - 1] ?? 0;
  const prev =
    done === 0 ? (row.thresholds.filter((at) => at <= row.from).pop() ?? 0) : crossed[done - 1];
  const boxes = [];
  for (let n = prev + 1; n <= next; n += 1) {
    boxes.push({
      n,
      state: n <= row.from ? "had" : n <= row.to ? "earned" : "empty",
      last: n === next,
    });
  }
  return { boxes, next, canAdvance: crossed.length > done, at: crossed[done] ?? null };
}

/** The advances this battle's XP brings him that aren't rolled yet (none for one who gains no XP). */
export function advancesWaiting(row: XpRow) {
  if (!row.canGainXp) return 0;
  const crossed = row.thresholds.filter((at) => at > row.from && at <= Math.floor(row.to)).length;
  const rolled = row.advances.filter((advance) => !awaitsFollowUp(advance)).length;
  return Math.max(0, crossed - rolled);
}

/**
 * A hero's advance whose follow-up D6 hasn't been rolled or typed yet. The server takes it in the
 * draft and leaves the level-up on his card if the battle is finalised with it still waiting.
 */
export const PENDING_ADVANCE = "Pending";
const PENDING_LABEL = "Not rolled yet";

/** An advance that still waits on its D6: its stat isn't known yet. */
export const awaitsFollowUp = (advance: BattlePostbattleAdvance) => advance.id === PENDING_ADVANCE;

/** How an advance reads: "+1 Toughness", "New skill", "The lad's got talent". */
export function advanceLabel(id: string) {
  if (id === "LGT") return "The lad's got talent";
  if (id === "Special") return "New special";
  if (id === "Skill" || id === "Spell") return `New ${id.toLowerCase()}`;
  return `+1 ${resolveAdvanceLabel(id)}`;
}

/**
 * The advance table's result for the 2D6 `faces` (rolled or typed). A hero's 6, 8 or 9 waits on its
 * follow-up D6, which the app never rolls for him (William, 18 Nov 2026: "the second roll box that
 * appears on certain level ups appears with a number already entered, it should be blank"), so it
 * comes back pending until `withFollowUp` has the face he rolled or typed.
 */
export function rollAdvance(group: boolean, at: number, faces: number[]): BattlePostbattleAdvance {
  const rolls = faces.slice(0, 2);
  const total = rolls[0] + rolls[1];
  let id: string | null;
  if (group) {
    const result = resolveHenchmen2d6Stat(total);
    id = result.ladsGotTalent ? "LGT" : result.stat;
  } else if (needsHero1d6Followup(total)) {
    return { id: PENDING_ADVANCE, label: PENDING_LABEL, at, rolls };
  } else {
    id = resolveHero2d6Stat(total);
  }
  const advance = id ?? "Skill";
  return { id: advance, label: advanceLabel(advance), at, rolls };
}

/**
 * The lad's got talent coming up again on a group that has just had it (William, 12 Nov 2026, on
 * repeat advances: "greyed with a warning, and a prompt to re-roll"). It is what the warband page's
 * advance dialog bars before the roll; here the roll has happened, so the result is greyed, warned
 * about and rolled again. It is never refused: a guide, not a gatekeeper.
 */
export function isRepeat(row: XpRow, index: number) {
  const advance = row.advances[index];
  if (!advance || advance.id !== LADS_GOT_TALENT) return false;
  const before = row.advances.slice(0, index).map((entry) => entry.id);
  return isTalentBarred(row.group, [...row.history, ...before]);
}

/** The row's advances with the one at `index` replaced by what was rolled or typed instead. */
export const withAdvanceAt = (
  advances: BattlePostbattleAdvance[],
  index: number,
  advance: BattlePostbattleAdvance
) => advances.map((entry, at) => (at === index ? advance : entry));

/** A hero's advance with its follow-up D6 rolled again or typed: the stat follows the new face. */
export function withFollowUp(advance: BattlePostbattleAdvance, face: number) {
  const rolls = [advance.rolls[0], advance.rolls[1], face];
  const id = resolveHero1d6Stat(rolls[0] + rolls[1], face) ?? advance.id;
  return { ...advance, id, label: advanceLabel(id), rolls };
}

/** The draft with `advances` as every result of the row (a group's members share them). */
export function withAdvances(
  draft: BattlePostbattleState,
  row: XpRow,
  advances: BattlePostbattleAdvance[]
): BattlePostbattleState {
  const unitResults = { ...draft.unit_results };
  for (const key of row.resultKeys) {
    const current = unitResults[key];
    if (current) unitResults[key] = { ...current, advances };
  }
  return { ...draft, unit_results: unitResults };
}

/** The draft with the row's XP earned set (a group's members earn the same). */
export function withXpEarned(
  draft: BattlePostbattleState,
  row: XpRow,
  earned: number
): BattlePostbattleState {
  const unitResults = { ...draft.unit_results };
  for (const key of row.resultKeys) {
    const current = unitResults[key];
    if (current) unitResults[key] = { ...current, xp_earned: Math.max(0, earned) };
  }
  return { ...draft, unit_results: unitResults };
}

/**
 * The draft with the row's XP earned changed; XP taken back below a threshold takes back the
 * advances rolled for it.
 */
export function withCorrectedXp(draft: BattlePostbattleState, row: XpRow, earned: number) {
  const to = row.from + Math.max(0, earned) * (row.halfRate ? 0.5 : 1);
  const crossed = row.thresholds.filter((at) => at > row.from && at <= Math.floor(to)).length;
  const next = withXpEarned(draft, row, earned);
  return row.advances.length > crossed
    ? withAdvances(next, row, row.advances.slice(0, crossed))
    : next;
}
