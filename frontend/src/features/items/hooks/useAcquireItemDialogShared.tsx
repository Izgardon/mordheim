import { useState } from "react";
import type { ReactNode } from "react";

import { acquireTriggerNode } from "../components/AcquireItemDialog/acquire-trigger";
import { purchase } from "../api/purchase";
import { acquireBlockers } from "../utils/acquire-blockers";
import { useAcquireForm } from "./useAcquireForm";
import { usePurchaseTarget, UNIT_TYPES } from "./usePurchaseTarget";
import { useRarityRoll } from "./useRarityRoll";
import { useWarbandCacheUpdate } from "@/features/warbands/api/warband-cache";

import type { Item } from "../types/item-types";
import type { AcquiredUnit, AcquireItemMeta, DraftUnit } from "../types/acquire-types";
import type { UnitTypeOption } from "@components/unit-selection-section";

export type { AcquiredUnit, AcquireItemMeta, DraftUnit } from "../types/acquire-types";

export type AcquireItemDialogSharedParams = {
  item: Item;
  initialAvailabilityId?: number | null;
  trigger?: ReactNode | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  presetUnitType?: UnitTypeOption;
  presetUnitId?: number | string;
  draftUnit?: DraftUnit;
  disableUnitSelection: boolean;
  defaultUnitSectionCollapsed?: boolean;
  defaultRaritySectionCollapsed?: boolean;
  defaultPriceSectionCollapsed?: boolean;
  onAcquire?: (
    item: Item,
    unitType: UnitTypeOption,
    unitId: string,
    meta?: AcquireItemMeta,
    updated?: AcquiredUnit
  ) => void;
  /** After buying, refresh the cached warband's summary (gold, rating). */
  emitWarbandUpdate: boolean;
  deferCommit: boolean;
  reservedGold: number;
  enableHenchmenAutoQuantity?: boolean;
};

export type AcquireItemDialogState = ReturnType<typeof useAcquireItemDialogShared>;

/**
 * The acquire (Buy/Give) dialog: who receives the item (`usePurchaseTarget`), the form
 * (`useAcquireForm`), the rare-item search (`useRarityRoll`), the gold check, and `purchase()`.
 */
export function useAcquireItemDialogShared(params: AcquireItemDialogSharedParams) {
  const { item, open: openProp, onOpenChange, onAcquire, deferCommit } = params;
  const [selectOpen, setSelectOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const updateWarbandCache = useWarbandCacheUpdate();
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : selectOpen;

  const target = usePurchaseTarget({
    open,
    presetUnitType: params.presetUnitType,
    presetUnitId: params.presetUnitId,
    draftUnit: params.draftUnit,
    itemId: item.id,
    autoQuantity: params.enableHenchmenAutoQuantity ?? false,
  });
  const { warband, resolvedUnitType, resolvedUnitId, canProceed } = target;
  const form = useAcquireForm({
    item,
    initialAvailabilityId: params.initialAvailabilityId,
    open,
    targetKey: `${resolvedUnitType}:${resolvedUnitId}`,
    canProceed,
    suggestedQuantity: target.suggestedQuantity,
    defaultUnitSectionCollapsed: params.defaultUnitSectionCollapsed,
    defaultRaritySectionCollapsed: params.defaultRaritySectionCollapsed,
    defaultPriceSectionCollapsed: params.defaultPriceSectionCollapsed,
  });
  const { isBuying, count, finalPrice, totalPrice } = form;
  const rarity = useRarityRoll({
    open,
    warband,
    heroUnits: target.heroUnits,
    draftUnit: params.draftUnit,
    item,
    rarity: form.rarity,
    onError: setError,
  });

  // The server's gold, from the warband sheet's summary (BUG-37): never re-derived here.
  const { notice, actionDisabled, actionDisabledReason } = acquireBlockers({
    hasWarband: warband !== null,
    gold: typeof warband?.gold === "number" ? warband.gold : null,
    reservedGold: params.reservedGold,
    isBuying,
    totalPrice,
    canProceed,
    isSubmitting,
    unitType: resolvedUnitType,
    unitId: resolvedUnitId,
  });

  const handleSelectOpenChange = (nextOpen: boolean) => {
    if (!isControlled) {
      setSelectOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
    if (!nextOpen) {
      setError("");
      target.reset();
      form.reset();
      rarity.reset();
    }
  };

  const handleAcquire = async () => {
    if (!warband || !resolvedUnitType || !canProceed || notice) {
      return;
    }
    setIsSubmitting(true);
    setError("");
    let didCommit = false;
    let didClose = false;
    try {
      const meta: AcquireItemMeta = {
        isBuying,
        quantity: count,
        unitPrice: finalPrice,
        totalPrice,
        reason: form.itemReason,
        baseCost: form.resolvedAvailability?.cost ?? finalPrice,
      };
      if (deferCommit) {
        onAcquire?.(item, resolvedUnitType, resolvedUnitId, meta);
        handleSelectOpenChange(false);
        return;
      }
      const resolved = target.resolve();
      if (!resolved) {
        return;
      }
      if ("error" in resolved) {
        setError(resolved.error);
        return;
      }
      await purchase({ warbandId: warband.id, target: resolved.target, item, meta }, (updated) => {
        didCommit = true;
        // The PATCH's answer is the unit as saved: callers write it, with no GET after.
        onAcquire?.(item, resolvedUnitType, resolvedUnitId, meta, updated);
      });
      if (params.emitWarbandUpdate) {
        updateWarbandCache(warband.id);
      }
      handleSelectOpenChange(false);
      didClose = true;
    } catch (err) {
      setError(
        err instanceof Error ? err.message || "Unable to acquire item" : "Unable to acquire item"
      );
    } finally {
      if (didCommit && !didClose) {
        handleSelectOpenChange(false);
      }
      setIsSubmitting(false);
    }
  };

  return {
    triggerNode: acquireTriggerNode(item, params.trigger),
    resolvedSelectOpen: open,
    handleSelectOpenChange,
    isBuying,
    setIsBuying: form.setIsBuying,
    selectionLabel: isBuying ? "Buying for:" : "Giving to:",
    selectionSummary: { label: target.selectedUnitLabel || " " },
    raritySummary: rarity.raritySummary,
    priceSummary: form.priceSummary,
    isUnitSelectionCollapsed: form.isUnitSelectionCollapsed,
    setIsUnitSelectionCollapsed: form.setIsUnitSelectionCollapsed,
    isRarityCollapsed: form.isRarityCollapsed,
    setIsRarityCollapsed: form.setIsRarityCollapsed,
    isPriceCollapsed: form.isPriceCollapsed,
    setIsPriceCollapsed: form.setIsPriceCollapsed,
    unitTypes: UNIT_TYPES,
    resolvedUnitType,
    resolvedUnitId,
    setSelectedUnitType: target.setSelectedUnitType,
    setSelectedUnitId: target.setSelectedUnitId,
    units: target.units,
    error,
    disableUnitSelection: params.disableUnitSelection,
    isCommonRarity: form.isCommonRarity,
    heroOptions: rarity.heroOptions,
    searchingHeroId: rarity.searchingHeroId,
    handleSearchingHeroChange: rarity.handleSearchingHeroChange,
    rollDisabled: rarity.rollDisabled,
    isSavingRarityRoll: rarity.isSavingRarityRoll,
    hasStoredRarityRoll: rarity.hasStoredRarityRoll,
    currentRarityRoll: rarity.currentRarityRoll,
    modifierEnabled: rarity.modifierEnabled,
    handleModifierEnabledChange: rarity.handleModifierEnabledChange,
    rarityModifier: rarity.rarityModifier,
    setRarityModifier: rarity.setRarityModifier,
    modifierReason: rarity.modifierReason,
    setModifierReason: rarity.setModifierReason,
    handleRarityRollTotalChange: rarity.handleRarityRollTotalChange,
    finalPrice,
    setFinalPrice: form.setFinalPrice,
    quantity: count,
    handleQuantityChange: form.handleQuantityChange,
    itemReason: form.itemReason,
    setItemReason: form.setItemReason,
    actionDisabled,
    actionDisabledReason,
    isSubmitting,
    handleAcquire,
    /** What stops Buy or Give, shown under the buttons and not only in their tooltip. */
    notice,
    availabilities: form.availabilities,
    selectedAvailabilityId: form.selectedAvailabilityId,
    setSelectedAvailabilityId: form.setSelectedAvailabilityId,
    resolvedAvailability: form.resolvedAvailability,
  };
}
