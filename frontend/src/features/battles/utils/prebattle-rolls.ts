import type { PrebattleUnit } from "@/features/battles/components/prebattle/prebattle-types";
import type { Dice } from "@/lib/dice";

/**
 * One roll a unit makes before the battle (William, 5 Nov 2026): the rule that asks for it (a
 * special, a skill, or a rule of an item he carries, shared or its own), its dice and the rule's
 * words on what the roll does. The page shows it and applies nothing.
 */
export type PrebattleRollLine = { key: string; source: string; dice: Dice; text: string };

const DICE = /^\d*D\d+$/;

const line = (key: string, source: string, roll?: string, text?: string) =>
  roll && DICE.test(roll) ? [{ key, source, dice: roll as Dice, text: text ?? "" }] : [];

/**
 * A unit's rolls: his specials', his skills', then each carried item's rules': a shared rule's named
 * "Rule (Item)", the item's own rule's by the item ("Evil Jester Mask").
 */
export function unitRolls(unit: PrebattleUnit): PrebattleRollLine[] {
  return [
    ...(unit.specials ?? []).flatMap((entry) =>
      line(`special:${entry.id}`, entry.name, entry.prebattleRoll, entry.prebattleText)
    ),
    ...(unit.skills ?? []).flatMap((entry) =>
      line(`skill:${entry.id}`, entry.name, entry.prebattleRoll, entry.prebattleText)
    ),
    ...(unit.items ?? []).flatMap((item) =>
      (item.prebattleRolls ?? []).flatMap((rule, index) =>
        line(
          `item:${item.id}:${index}`,
          rule.rule ? `${rule.rule} (${item.name})` : item.name,
          rule.roll,
          rule.text
        )
      )
    ),
  ];
}

/** A henchmen group's rolls, once for the group: its members', each source once. */
export function groupRolls(members: PrebattleUnit[]): PrebattleRollLine[] {
  const lines = new Map<string, PrebattleRollLine>();
  for (const member of members) {
    for (const roll of unitRolls(member)) {
      if (!lines.has(roll.key)) lines.set(roll.key, roll);
    }
  }
  return [...lines.values()];
}

/** What the faces read: a D66 as tens then units, any other roll as their sum. */
export function rollReading(dice: Dice, faces: number[]) {
  if (dice === "D66" && faces.length === 2) return faces[0] * 10 + faces[1];
  return faces.reduce((sum, face) => sum + face, 0);
}
