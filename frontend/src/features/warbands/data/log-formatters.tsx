import type { ReactNode } from "react";
import { Check, X } from "lucide-react";

import { formatLogMessage } from "./log-translations";

import type { WarbandLog } from "../types/warband-types";

import needIcon from "@/assets/icons/need.webp";
import greedIcon from "@/assets/icons/greed.webp";

export const FEATURE_COLORS: Record<string, string> = {
  advance: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  loadout: "bg-sky-500/20 text-sky-300 border-sky-500/30",
  trading_action: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
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

  "loadout:hero_item": (log) => {
    const payload = (log.payload ?? {}) as Record<string, any>;
    const actor = payload.hero || payload.warband || "Warband";
    const quantityRaw = payload.quantity ?? 1;
    const quantity = Number(quantityRaw);
    const itemName = payload.item || "Unknown Item";
    const itemLabel =
      Number.isFinite(quantity) && quantity > 1 ? `${itemName} x ${quantity}` : itemName;
    const itemPriceRaw = payload.price ?? 0;
    const itemPrice = Number(itemPriceRaw);
    const reasonText = payload.reason || "No reason given";

    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        <span>{actor} received: {itemLabel}</span>
        {Number.isFinite(itemPrice) && itemPrice > 0
          ? (
            <span className="inline-flex items-center gap-1">
              <span>(</span>
              {renderGoldBadge(itemPrice)}
              <span>)</span>
            </span>
          )
          : <span>({reasonText})</span>}
      </span>
    );
  },
};
