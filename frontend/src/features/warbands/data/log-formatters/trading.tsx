import { Check, X } from "lucide-react";

import { payloadOf, renderDiceBadge, type LogFormatter } from "./badges";

type RarityRollPayload = {
  hero?: string;
  item?: string;
  rarity?: number | string;
  roll?: number;
  modifier?: number;
  reason?: string;
  success?: boolean;
};

type DiceRollPayload = {
  warband?: string;
  dice?: string;
  rolls?: number[];
  total?: number;
  reason?: string;
};

/** A hero's search for a rare item: the roll, its modifier and reason, and whether it found it. */
const rarityRoll: LogFormatter = (log) => {
  const payload = payloadOf<RarityRollPayload>(log);
  const heroName = payload.hero || "Unknown Hero";
  const itemName = payload.item || "Unknown Item";
  const rarityLabel = payload.rarity === 2 ? "Common" : String(payload.rarity ?? "?");
  const rollValue = payload.roll ?? "-";
  const modifierRaw = payload.modifier ?? 0;
  const modifierValue = Number(modifierRaw);
  const hasModifier = Number.isFinite(modifierValue) && modifierValue !== 0;
  const modifierText = hasModifier
    ? modifierValue >= 0
      ? `+${modifierValue}`
      : `-${Math.abs(modifierValue)}`
    : "";
  const rawReason = typeof payload.reason === "string" ? payload.reason.trim() : "";
  const cleanedReason = rawReason && rawReason !== "No modifier" ? rawReason : "";
  const reasonSuffix = cleanedReason ? ` (${cleanedReason})` : "";
  const success = payload.success;
  const resultIcon =
    success === undefined ? null : success ? (
      <Check className="h-4 w-4 text-emerald-400" />
    ) : (
      <X className="h-4 w-4 text-red-400" />
    );

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span>
        {heroName} searched for: {itemName} [{rarityLabel}] - Roll {rollValue} (
        {renderDiceBadge("2D6")}){hasModifier ? modifierText : ""}
        {reasonSuffix}
      </span>
      {resultIcon}
    </span>
  );
};

/** A roll of the warband's dice roller (the campaign dice log and custom trading rolls). */
export const diceRoll: LogFormatter = (log) => {
  const payload = payloadOf<DiceRollPayload>(log);
  const warbandName = payload.warband || "Warband";
  const diceLabel = String(payload.dice || "Dice").toUpperCase();
  const rollsRaw = Array.isArray(payload.rolls) ? payload.rolls : [];
  const rolls = rollsRaw
    .map((value) => Number(value))
    .filter((value): value is number => Number.isFinite(value));
  const computedTotal = rolls.reduce((sum, value) => sum + value, 0);
  const payloadTotal = Number(payload.total);
  const total = Number.isFinite(payloadTotal) ? payloadTotal : computedTotal;
  const reason = typeof payload.reason === "string" ? payload.reason.trim() : "";
  const reasonSuffix = reason ? ` (${reason})` : "";

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span>
        {warbandName} rolled {rolls.length ? rolls.join(", ") : "-"} ({renderDiceBadge(diceLabel)})
        = {total}
        {reasonSuffix}
      </span>
    </span>
  );
};

/** Trading actions and dice rolls. */
export const TRADING_FORMATTERS: Record<string, LogFormatter> = {
  "trading_action:rarity roll": rarityRoll,
  "trading_action:custom_dice_roll": diceRoll,
  "dice_roll:dice_roll": diceRoll,
};
