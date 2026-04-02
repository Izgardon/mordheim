import type { ReactNode } from "react";
import { Check, X } from "lucide-react";

import { formatLogMessage } from "./log-translations";

import type { WarbandLog } from "../types/warband-types";

import needIcon from "@/assets/icons/need.webp";
import greedIcon from "@/assets/icons/greed.webp";

export const FEATURE_COLORS: Record<string, string> = {
  advance: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  battle: "bg-red-500/20 text-red-300 border-red-500/30",
  loadout: "bg-sky-500/20 text-sky-300 border-sky-500/30",
  personnel: "bg-lime-500/20 text-lime-300 border-lime-500/30",
  trading_action: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  dice_roll: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  warband: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  hero: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  campaign: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
};

export const DEFAULT_FEATURE_COLOR = "bg-white/10 text-muted-foreground border-white/20";

export const renderDiceBadge = (dice?: string) => (
  <span className="inline-flex items-center gap-1 align-middle leading-none">
    <img src={needIcon} alt="" className="relative top-[1px] h-4 w-4" />
    {dice ? <span>{dice}</span> : null}
  </span>
);

export const renderGoldBadge = (value: number) => (
  <span className="inline-flex items-center gap-1 align-middle leading-none">
    <img src={greedIcon} alt="" className="relative top-[1px] h-4 w-4" />
    <span>{value} gc</span>
  </span>
);

type LogFormatter = (log: WarbandLog) => ReactNode;

type LoadoutItemFormatterOptions = {
  reasonFallback?: string;
};

const formatLoadoutItem = (
  log: WarbandLog,
  { reasonFallback }: LoadoutItemFormatterOptions = {}
) => {
  const payload = (log.payload ?? {}) as Record<string, any>;
  const actor = payload.hero || payload.warband || "Warband";
  const quantityRaw = payload.quantity ?? 1;
  const quantity = Number(quantityRaw);
  const itemName = payload.item || "Unknown Item";
  const itemLabel =
    Number.isFinite(quantity) && quantity > 1 ? `${itemName} x ${quantity}` : itemName;
  const itemPriceRaw = payload.price ?? 0;
  const itemPrice = Number(itemPriceRaw);
  const rawReason = typeof payload.reason === "string" ? payload.reason.trim() : "";
  const reasonText = rawReason || reasonFallback || "";

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span>{actor} received: {itemLabel}</span>
      {Number.isFinite(itemPrice) && itemPrice > 0 ? (
        <span className="inline-flex items-center gap-1">
          <span>(</span>
          {renderGoldBadge(itemPrice)}
          <span>)</span>
        </span>
      ) : reasonText ? (
        <span>({reasonText})</span>
      ) : null}
    </span>
  );
};

export const LOG_FORMATTERS: Record<string, LogFormatter> = {
  "advance:hero": (log) => {
    const payload = (log.payload ?? {}) as Record<string, any>;
    const heroName = payload.hero || "Unknown Hero";
    const advanceLabel = payload.advance?.label || payload.advance || "Advance";
    const roll1Total = payload.roll1?.result?.total ?? null;
    const roll2Total = payload.roll2?.result?.total ?? null;
    const roll1Dice = payload.roll1?.dice;
    const roll2Dice = payload.roll2?.dice;

    if (roll1Total === null && roll2Total === null) {
      return `${heroName} levelled up and gained a ${advanceLabel}`;
    }
    if (roll2Total === null) {
      return (
        <>
          {heroName} levelled up with a roll of {roll1Total} (
          {renderDiceBadge(roll1Dice)}) and gained a {advanceLabel}
        </>
      );
    }
    return (
      <>
        {heroName} levelled up with a roll of {roll1Total} (
        {renderDiceBadge(roll1Dice)}), followed by a {roll2Total} (
        {renderDiceBadge(roll2Dice)}) and gained a {advanceLabel}
      </>
    );
  },
  "advance:henchmen": (log) => {
    const payload = (log.payload ?? {}) as Record<string, any>;
    const groupName = payload.group || "Unknown Group";
    const advanceLabel = payload.advance?.label || payload.advance || "Advance";
    const roll1Total = payload.roll1?.result?.total ?? null;
    const roll1Dice = payload.roll1?.dice;

    if (roll1Total === null) {
      return `${groupName} levelled up and gained ${advanceLabel}`;
    }
    return (
      <>
        {groupName} levelled up with a roll of {roll1Total} (
        {renderDiceBadge(roll1Dice)}) and gained {advanceLabel}
      </>
    );
  },

  "trading_action:rarity roll": (log) => {
    const payload = (log.payload ?? {}) as Record<string, any>;
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
    const rawReason =
      typeof payload.reason === "string" ? payload.reason.trim() : "";
    const cleanedReason =
      rawReason && rawReason !== "No modifier" ? rawReason : "";
    const reasonSuffix = cleanedReason ? ` (${cleanedReason})` : "";
    const success = payload.success;
    const resultIcon =
      success === undefined
        ? null
        : success
          ? <Check className="h-4 w-4 text-emerald-400" />
          : <X className="h-4 w-4 text-red-400" />;

    const translated = formatLogMessage("trading_action", "rarity roll", {
      hero: heroName,
      item: itemName,
      rarity: rarityLabel,
      roll: rollValue,
      modifier_text: hasModifier ? modifierText : "",
      reason_suffix: reasonSuffix,
    });

    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        <span>
          {heroName} searched for: {itemName} [{rarityLabel}] - Roll {rollValue}
          {" "}({renderDiceBadge("2D6")})
          {hasModifier ? modifierText : ""}{reasonSuffix}
        </span>
        {resultIcon}
      </span>
    );
  },
  "dice_roll:dice_roll": (log) => {
    const payload = (log.payload ?? {}) as Record<string, any>;
    const warbandName = payload.warband || "Warband";
    const diceLabel = String(payload.dice || "Dice").toUpperCase();
    const rollsRaw = Array.isArray(payload.rolls) ? payload.rolls : [];
    const rolls = rollsRaw
      .map((value) => Number(value))
      .filter((value): value is number => Number.isFinite(value));
    const computedTotal = rolls.reduce((sum, value) => sum + value, 0);
    const payloadTotal = Number(payload.total);
    const total = Number.isFinite(payloadTotal) ? payloadTotal : computedTotal;
    const reason =
      typeof payload.reason === "string" ? payload.reason.trim() : "";
    const reasonSuffix = reason ? ` (${reason})` : "";

    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        <span>
          {warbandName} rolled {rolls.length ? rolls.join(", ") : "-"} (
          {renderDiceBadge(diceLabel)}) = {total}
          {reasonSuffix}
        </span>
      </span>
    );
  },
  "trading_action:custom_dice_roll": (log) => {
    const payload = (log.payload ?? {}) as Record<string, any>;
    const warbandName = payload.warband || "Warband";
    const diceLabel = String(payload.dice || "Dice").toUpperCase();
    const rollsRaw = Array.isArray(payload.rolls) ? payload.rolls : [];
    const rolls = rollsRaw
      .map((value) => Number(value))
      .filter((value): value is number => Number.isFinite(value));
    const computedTotal = rolls.reduce((sum, value) => sum + value, 0);
    const payloadTotal = Number(payload.total);
    const total = Number.isFinite(payloadTotal) ? payloadTotal : computedTotal;
    const reason =
      typeof payload.reason === "string" ? payload.reason.trim() : "";
    const reasonSuffix = reason ? ` (${reason})` : "";

    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        <span>
          {warbandName} rolled {rolls.length ? rolls.join(", ") : "-"} (
          {renderDiceBadge(diceLabel)}) = {total}
          {reasonSuffix}
        </span>
      </span>
    );
  },
  "personnel:serious_injury": (log) => {
    const payload = (log.payload ?? {}) as Record<string, any>;
    const unitName = payload.unit_name || "Unknown unit";
    const rollTypeRaw =
      typeof payload.roll_type === "string" ? payload.roll_type.trim().toUpperCase() : "";
    const rolls = Array.isArray(payload.rolls)
      ? payload.rolls
          .map((value) => Number(value))
          .filter((value): value is number => Number.isFinite(value))
      : [];
    const resultCode =
      typeof payload.result_code === "string" ? payload.result_code.trim() : "";
    const resultLabel =
      typeof payload.result_label === "string" ? payload.result_label.trim() : "";

    if (!rollTypeRaw && rolls.length === 0 && !resultCode && !resultLabel) {
      return `${unitName} made a serious injury roll`;
    }

    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        <span>{unitName} made a serious injury roll of {rolls.length ? rolls.join(", ") : "-"}</span>
        {rollTypeRaw ? <span>({renderDiceBadge(rollTypeRaw)})</span> : null}
        {resultCode || resultLabel ? (
          <span>
            = {[resultCode, resultLabel].filter(Boolean).join(": ")}
          </span>
        ) : null}
      </span>
    );
  },
  "battle:complete": (log) => {
    const payload = (log.payload ?? {}) as Record<string, any>;
    const result = payload.result === "lost" ? "lost" : "won";
    const withNames = Array.isArray(payload.with)
      ? payload.with.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      : [];
    const againstNames = Array.isArray(payload.against)
      ? payload.against.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      : [];
    const verb = result === "won" ? "Won" : "Lost";
    if (againstNames.length === 0) {
      return `${verb} the battle.`;
    }
    if (withNames.length === 0) {
      return `${verb} the battle against ${againstNames.join(", ")}.`;
    }
    return `${verb} the battle with ${withNames.join(", ")} against ${againstNames.join(", ")}.`;
  },
  "battle:exploration": (log) => {
    const payload = (log.payload ?? {}) as Record<string, any>;
    const dice = Array.isArray(payload.dice)
      ? payload.dice.filter((value): value is number => Number.isFinite(Number(value))).map((value) => Number(value))
      : [];
    return `Exploration rolls: ${dice.length > 0 ? dice.join(", ") : "-"}.`;
  },
  "battle:finds": (log) => {
    const payload = (log.payload ?? {}) as Record<string, any>;
    const goldCrowns = Number(payload.gold_crowns);
    const items = Array.isArray(payload.items)
      ? payload.items
          .map((entry) => (entry && typeof entry === "object" ? String(entry.name || "").trim() : ""))
          .filter((value): value is string => value.length > 0)
      : [];

    if (Number.isFinite(goldCrowns) && goldCrowns > 0 && items.length > 0) {
      return (
        <span className="inline-flex flex-wrap items-center gap-1">
          <span>Finds:</span>
          {renderGoldBadge(goldCrowns)}
          <span>and {items.join(", ")}.</span>
        </span>
      );
    }
    if (Number.isFinite(goldCrowns) && goldCrowns > 0) {
      return (
        <span className="inline-flex flex-wrap items-center gap-1">
          <span>Finds:</span>
          {renderGoldBadge(goldCrowns)}
        </span>
      );
    }
    if (items.length > 0) {
      return `Finds: ${items.join(", ")}.`;
    }
    return "Finds recorded.";
  },

  "advance:hired_sword": (log) => {
    const payload = (log.payload ?? {}) as Record<string, any>;
    const heroName = payload.hero || "Unknown Hired Sword";
    const advanceLabel = payload.advance?.label || payload.advance || "Advance";
    const roll1Total = payload.roll1?.result?.total ?? null;
    const roll2Total = payload.roll2?.result?.total ?? null;
    const roll1Dice = payload.roll1?.dice;
    const roll2Dice = payload.roll2?.dice;

    if (roll1Total === null && roll2Total === null) {
      return `${heroName} levelled up and gained a ${advanceLabel}`;
    }
    if (roll2Total === null) {
      return (
        <>
          {heroName} levelled up with a roll of {roll1Total} (
          {renderDiceBadge(roll1Dice)}) and gained a {advanceLabel}
        </>
      );
    }
    return (
      <>
        {heroName} levelled up with a roll of {roll1Total} (
        {renderDiceBadge(roll1Dice)}), followed by a {roll2Total} (
        {renderDiceBadge(roll2Dice)}) and gained a {advanceLabel}
      </>
    );
  },

  "personnel:new_hired_sword": (log) => {
    const payload = (log.payload ?? {}) as Record<string, any>;
    const name = payload.name || "Unknown";
    const type = payload.type || "Hired Sword";
    return `Hired ${name} the ${type}`;
  },

  "personnel:remove_hired_sword": (log) => {
    const payload = (log.payload ?? {}) as Record<string, any>;
    const name = payload.name || "Unknown";
    const type = payload.type || "Hired Sword";
    return `Dismissed ${name} the ${type}`;
  },

  "loadout:hero_item": (log) => {
    return formatLoadoutItem(log, { reasonFallback: "No reason given" });
  },
  "loadout:henchmen_item": (log) => formatLoadoutItem(log),
  "loadout:hired_sword_item": (log) =>
    formatLoadoutItem(log, { reasonFallback: "No reason given" }),
};
