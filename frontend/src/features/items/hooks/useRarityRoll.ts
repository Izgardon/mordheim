import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { listWarbandHeroes } from "@/features/warbands/api/warbands-api";
import { setHeroTradingAction } from "@/features/warbands/api/warband-cache";
import { getErrorMessage } from "@/lib/get-error-message";
import { saveRarityRoll, type RarityRollLine } from "../api/purchase";

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
};

/**
 * The rare-item search: which hero searches, his roll and its modifier. The server saves a roll,
 * spends the hero's trading action and logs the search: with the purchase, or through
 * `rarity-rolls/` when the dialog closes without one (decision 9). A hero who already used his
 * action can still search, with a warning. The warband's heroes are read when the dialog opens.
 */
export function useRarityRoll({
  open,
  warband,
  heroUnits,
  draftUnit,
  item,
  rarity,
}: UseRarityRollOptions) {
  const [searchingHeroId, setSearchingHeroId] = useState("");
  const [heroSearchUnits, setHeroSearchUnits] = useState<HeroOption[] | null>(null);
  const [heroRarityRolls, setHeroRarityRolls] = useState<Record<string, HeroRarityRoll>>({});
  const [spentHeroIds, setSpentHeroIds] = useState<string[]>([]);
  // Heroes whose roll went with a purchase (the server spent them already).
  const sentRolls = useRef(new Set<string>());
  const queryClient = useQueryClient();
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

  const currentRarityRoll = searchingHeroId ? (heroRarityRolls[searchingHeroId] ?? null) : null;
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

  // A spent searcher still rolls, with the picker's warning (decision 9): one roll per hero.
  // The roll is kept here and saved on the server: with the purchase, or when the dialog closes.
  const handleRarityRollTotalChange = (total: number) => {
    if (!warband || !searchingHeroId || heroRarityRolls[searchingHeroId]) {
      return;
    }
    const heroId = searchingHeroId;
    const modifier = modifierEnabled ? rarityModifier : 0;
    const finalTotal = total + modifier;
    const reason = modifierEnabled ? modifierReason.trim() || "No reason given" : undefined;
    setHeroRarityRolls((current) => ({
      ...current,
      [heroId]: { total, modifier, finalTotal, success: finalTotal >= rarity, reason },
    }));
    setSpentHeroIds((current) => (current.includes(heroId) ? current : [...current, heroId]));
  };

  /** A stored roll as the server takes it (null for a draft hero, who can't search yet). */
  const lineOf = (heroId: string): RarityRollLine | null => {
    const stored = heroRarityRolls[heroId];
    const id = Number(heroId);
    if (!stored || Number.isNaN(id)) {
      return null;
    }
    return {
      hero_id: id,
      roll: stored.total,
      modifier: stored.modifier,
      rarity: String(rarity),
      ...(stored.reason ? { reason: stored.reason } : {}),
      success: stored.success,
    };
  };

  /** The searcher's roll, to save with the purchase. */
  const rollForPurchase = () => (searchingHeroId ? lineOf(searchingHeroId) : null);

  /**
   * The roll went with a purchase, so it isn't saved again; `spent` once the server has spent
   * the hero (a purchase queued for the roster Save leaves the sheet alone until then).
   */
  const markRollSent = (roll: RarityRollLine | null, spent = true) => {
    if (!roll) {
      return;
    }
    sentRolls.current.add(String(roll.hero_id));
    if (warband && spent) {
      setHeroTradingAction(queryClient, warband.id, roll.hero_id, false);
    }
  };

  /** Searches that ended without a purchase, saved as the dialog closes (decision 9). */
  const saveUnsentRolls = () => {
    if (!warband) {
      return;
    }
    for (const heroId of Object.keys(heroRarityRolls)) {
      const line = sentRolls.current.has(heroId) ? null : lineOf(heroId);
      if (line) {
        void saveRarityRoll(queryClient, warband.id, { ...line, item_id: item.id }).catch(
          (error: unknown) =>
            toast.error("Couldn't save the rarity roll.", { description: getErrorMessage(error) })
        );
      }
    }
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
    sentRolls.current = new Set();
  };

  return {
    heroOptions,
    searchingHeroId,
    handleSearchingHeroChange: setSearchingHeroId,
    rollDisabled: !searchingHeroId || currentRarityRoll !== null,
    hasStoredRarityRoll: currentRarityRoll !== null,
    currentRarityRoll,
    modifierEnabled,
    handleModifierEnabledChange,
    rarityModifier,
    setRarityModifier,
    modifierReason,
    setModifierReason,
    handleRarityRollTotalChange,
    rollForPurchase,
    markRollSent,
    saveUnsentRolls,
    raritySummary: {
      label: isCommonRarity ? "Common" : String(rarity),
      rollSummary,
      success: !isCommonRarity ? (currentRarityRoll?.success ?? null) : null,
    },
    reset,
  };
}
