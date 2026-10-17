import { useEffect, useMemo, useState } from "react";

import {
  createWarbandLog,
  listWarbandHeroes,
  updateWarbandHero,
} from "@/features/warbands/api/warbands-api";

import type { Item } from "../types/item-types";
import type { DraftUnit, HeroOption, HeroRarityRoll } from "../types/acquire-types";
import type { Warband } from "@/features/warbands/types/warband-types";

type UseRarityRollOptions = {
  open: boolean;
  warband: Warband | null;
  /** The warband's heroes as its summary lists them (the fallback when the read fails). */
  heroUnits: HeroOption[];
  draftUnit?: DraftUnit;
  item: Item;
  rarity: number;
  /** A failed trading-action spend, for the dialog's error line. */
  onError: (message: string) => void;
};

/**
 * The rare-item search: which hero searches, his roll and its modifier. A roll spends the hero's
 * trading action and logs the search, from the browser (PR C saves rolls with the purchase and
 * greys spent heroes instead, ECON-TWEAK-01). The warband's heroes are read when the dialog opens.
 */
export function useRarityRoll({
  open,
  warband,
  heroUnits,
  draftUnit,
  item,
  rarity,
  onError,
}: UseRarityRollOptions) {
  const [searchingHeroId, setSearchingHeroId] = useState("");
  const [heroSearchUnits, setHeroSearchUnits] = useState<HeroOption[] | null>(null);
  const [heroRarityRolls, setHeroRarityRolls] = useState<Record<string, HeroRarityRoll>>({});
  const [spentHeroIds, setSpentHeroIds] = useState<string[]>([]);
  const [savingHeroIds, setSavingHeroIds] = useState<string[]>([]);
  const [modifierEnabled, setModifierEnabled] = useState(false);
  const [rarityModifier, setRarityModifier] = useState(0);
  const [modifierReason, setModifierReason] = useState("");

  useEffect(() => {
    if (!open || !warband) {
      return;
    }
    let active = true;
    setHeroSearchUnits(null);
    listWarbandHeroes(warband.id)
      .then((data) => {
        if (active) setHeroSearchUnits(data);
      })
      .catch(() => {
        if (active) setHeroSearchUnits(heroUnits);
      });
    return () => {
      active = false;
    };
  }, [open, warband, heroUnits]);

  const heroOptions = useMemo<HeroOption[]>(() => {
    const base = open ? (heroSearchUnits ?? []) : heroUnits;
    const withDraft =
      draftUnit?.unitType !== "heroes"
        ? base
        : [...base, { id: draftUnit.id, name: draftUnit.name ?? null }];
    return withDraft.map((hero) => {
      const isSpent = hero.trading_action === false || spentHeroIds.includes(String(hero.id));
      return { ...hero, trading_action: isSpent ? false : hero.trading_action };
    });
  }, [draftUnit, heroSearchUnits, heroUnits, open, spentHeroIds]);

  const searcher = heroOptions.find((hero) => String(hero.id) === searchingHeroId) ?? null;
  const currentRarityRoll = searchingHeroId ? (heroRarityRolls[searchingHeroId] ?? null) : null;
  const isSavingRarityRoll = searchingHeroId ? savingHeroIds.includes(searchingHeroId) : false;
  const hasAvailableSearcher = searcher?.trading_action !== false;
  const isCommonRarity = rarity === 2;
  const roll = currentRarityRoll;
  const rollSummary =
    roll !== null && !isCommonRarity
      ? ` -> ${roll.total} ${roll.modifier >= 0 ? `+ ${roll.modifier}` : `- ${Math.abs(roll.modifier)}`} = ${roll.finalTotal}`
      : "";

  const handleModifierEnabledChange = (nextEnabled: boolean) => {
    setModifierEnabled(nextEnabled);
    if (!nextEnabled) {
      setRarityModifier(0);
      setModifierReason("");
    }
  };

  const stopSaving = (heroId: string) =>
    setSavingHeroIds((current) => current.filter((entry) => entry !== heroId));

  const handleRarityRollTotalChange = (total: number) => {
    if (!warband || !searchingHeroId || !hasAvailableSearcher || isSavingRarityRoll) {
      return;
    }
    const heroId = searchingHeroId;
    if (heroRarityRolls[heroId]) {
      return;
    }
    const heroName = searcher?.name?.trim() || "Unnamed Hero";
    const modifier = modifierEnabled ? rarityModifier : 0;
    const finalTotal = total + modifier;
    const success = finalTotal >= rarity;
    const parsedHeroId = Number(heroId);

    setHeroRarityRolls((current) => ({
      ...current,
      [heroId]: { total, modifier, finalTotal, success },
    }));
    setSavingHeroIds((current) => (current.includes(heroId) ? current : [...current, heroId]));
    if (Number.isNaN(parsedHeroId)) {
      stopSaving(heroId);
      return;
    }

    void updateWarbandHero(warband.id, parsedHeroId, { trading_action: false })
      .then(async () => {
        setHeroSearchUnits((current) =>
          current
            ? current.map((hero) =>
                String(hero.id) === heroId ? { ...hero, trading_action: false } : hero
              )
            : current
        );
        setSpentHeroIds((current) => (current.includes(heroId) ? current : [...current, heroId]));
        try {
          await createWarbandLog(warband.id, {
            feature: "trading_action",
            entry_type: "rarity roll",
            payload: {
              hero: heroName,
              item: item.name,
              rarity: isCommonRarity ? "Common" : String(rarity),
              roll: total,
              modifier,
              ...(modifierEnabled ? { reason: modifierReason.trim() || "No reason given" } : {}),
              success,
            },
          });
        } catch (logError) {
          console.error("Failed to log rarity roll", logError);
        } finally {
          stopSaving(heroId);
        }
      })
      .catch(() => {
        stopSaving(heroId);
        setHeroRarityRolls((current) => {
          const next = { ...current };
          delete next[heroId];
          return next;
        });
        onError("Unable to spend the selected hero's trading action.");
      });
  };

  /** No search, as the dialog closes. */
  const reset = () => {
    setModifierEnabled(false);
    setRarityModifier(0);
    setModifierReason("");
    setSearchingHeroId("");
    setHeroSearchUnits(null);
    setHeroRarityRolls({});
    setSpentHeroIds([]);
    setSavingHeroIds([]);
  };

  return {
    heroOptions,
    searchingHeroId,
    handleSearchingHeroChange: setSearchingHeroId,
    rollDisabled: !searchingHeroId || !hasAvailableSearcher || isSavingRarityRoll,
    isSavingRarityRoll,
    hasStoredRarityRoll: currentRarityRoll !== null,
    currentRarityRoll,
    modifierEnabled,
    handleModifierEnabledChange,
    rarityModifier,
    setRarityModifier,
    modifierReason,
    setModifierReason,
    handleRarityRollTotalChange,
    raritySummary: {
      label: isCommonRarity ? "Common" : String(rarity),
      rollSummary,
      success: !isCommonRarity ? (currentRarityRoll?.success ?? null) : null,
    },
    reset,
  };
}
