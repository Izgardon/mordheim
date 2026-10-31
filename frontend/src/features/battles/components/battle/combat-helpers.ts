/** The to-hit and to-wound charts (Mordheim rulebook), as the Melee and Ranged helpers read them. */

const clamp = (value: number) => Math.max(1, Math.min(10, Math.trunc(value || 1)));

/** Close combat: better WS hits on 3+, equal on 4+, more than twice yours on 5+. */
export function meleeToHit(attackerWs: number, defenderWs: number) {
  const attacker = clamp(attackerWs);
  const defender = clamp(defenderWs);
  if (attacker > defender) return 3;
  if (defender > attacker * 2) return 5;
  return 4;
}

/** Shooting: 7 − BS, with the modifiers; past 6 it takes a 6 and then the extra roll. */
export function rangedToHit(ballisticSkill: number, modifier: number) {
  return 7 - clamp(ballisticSkill) - modifier;
}

export function formatToHit(roll: number) {
  if (roll <= 2) return "2+";
  if (roll <= 6) return `${roll}+`;
  return `6, then ${Math.min(6, roll - 3)}+`;
}

/** Strength against Toughness: null when it can't wound. */
export function toWound(strength: number, toughness: number) {
  const diff = clamp(strength) - clamp(toughness);
  if (diff >= 2) return 2;
  if (diff === 1) return 3;
  if (diff === 0) return 4;
  if (diff === -1) return 5;
  if (diff >= -3) return 6;
  return null;
}

/** Each point of Strength over 3 takes one off the save. */
export const saveModifier = (strength: number) => Math.max(0, clamp(strength) - 3);

/** The save left after the modifier, or null when there is none. */
export function saveAfter(save: number | null, strength: number) {
  if (save === null || save <= 0) return null;
  const adjusted = save + saveModifier(strength);
  return adjusted >= 7 ? null : adjusted;
}

export const RANGED_MODIFIERS = [
  { id: "cover", label: "Cover", value: -1 },
  { id: "long", label: "Long range", value: -1 },
  { id: "moving", label: "Moved", value: -1 },
  { id: "large", label: "Large target", value: 1 },
] as const;
