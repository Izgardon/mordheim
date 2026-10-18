import { Checkbox } from "@/components/ui/checkbox";
import type { BattlePostbattleSeriousInjuryRoll } from "@/features/battles/types/battle-types";

const STAT_NAMES: Record<string, string> = {
  movement: "Movement",
  weapon_skill: "Weapon Skill",
  ballistic_skill: "Ballistic Skill",
  strength: "Strength",
  toughness: "Toughness",
  wounds: "Wounds",
  initiative: "Initiative",
  attacks: "Attacks",
  leadership: "Leadership",
};

/** What the server's injury table says a result does, in words. */
export function injuryEffectText(roll: BattlePostbattleSeriousInjuryRoll) {
  const effect = roll.effect;
  if (!effect) {
    return null;
  }
  if (effect.kind === "dead") return "He dies";
  if (effect.kind === "stat") {
    return `${effect.change ?? -1} ${STAT_NAMES[effect.stat ?? ""] ?? effect.stat ?? ""}`.trim();
  }
  if (effect.kind === "special") return `Gains ${effect.special}`;
  if (effect.kind === "none") return "No lasting effect";
  return null;
}

type PostbattleInjuryResultProps = {
  unitName: string;
  /** The unit's last roll: the only one finalise applies (earlier ones were re-rolled). */
  roll: BattlePostbattleSeriousInjuryRoll;
  disabled: boolean;
  onToggleApply: (apply: boolean) => void;
};

/**
 * The serious injury result finalise applies (BUG-47, decision 7): a simple result (dead, a
 * characteristic -1, a named special) is ticked to apply and can be unticked; a complex one
 * (Robbed, Captured, ...) is flagged to apply by hand.
 */
export default function PostbattleInjuryResult({
  unitName,
  roll,
  disabled,
  onToggleApply,
}: PostbattleInjuryResultProps) {
  const kind = roll.effect?.kind;
  if (!kind) {
    return null;
  }
  if (kind === "manual") {
    return (
      <p className="text-xs text-amber-300">
        {roll.result_label}: apply by hand on the warband sheet.
      </p>
    );
  }
  if (kind === "none") {
    return <p className="text-xs text-muted-foreground">{roll.result_label}: no lasting effect.</p>;
  }
  return (
    <label className="flex flex-wrap items-center gap-2 text-xs text-foreground">
      <Checkbox
        checked={roll.apply !== false}
        disabled={disabled}
        aria-label={`Apply ${roll.result_label} to ${unitName}`}
        onChange={(event) => onToggleApply(event.target.checked)}
      />
      <span>
        Apply at finalise: {roll.result_label} ({injuryEffectText(roll)})
      </span>
    </label>
  );
}
