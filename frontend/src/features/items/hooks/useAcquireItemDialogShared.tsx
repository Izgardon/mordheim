import { useState } from "react";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { acquireTriggerNode } from "../components/AcquireItemDialog/acquire-trigger";
import { purchase, purchaseLine } from "../api/purchase";
import { acquireBlockers } from "../utils/acquire-blockers";
import { useAcquireForm } from "./useAcquireForm";
import { usePurchaseTarget, UNIT_TYPES } from "./usePurchaseTarget";
import { useRarityRoll } from "./useRarityRoll";
import { useAcquireBeastChoice } from "./useAcquireBeastChoice";

import type { Item } from "../types/item-types";
import type { AcquireItemMeta, DraftUnit } from "../types/acquire-types";
import type { UnitTypeOption } from "@components/unit-selection-section";

export type { AcquireItemMeta, DraftUnit } from "../types/acquire-types";

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
  /** After a purchase (written to the cache already), or a purchase queued for the roster Save. */
  onAcquire?: (
    item: Item,
    unitType: UnitTypeOption,
    unitId: string,
    meta?: AcquireItemMeta
  ) => void;
  deferCommit: boolean;
  /** "Buy again" (decision 11): unless the player changes the price, the server charges the
   * item's current campaign price, house rules included. */
  atCurrentPrice?: boolean;
  /** Buy again: that price, shown and checked against the gold (null: the item's own price). */
  currentPrice?: number | null;
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
  // Decision 2: spending more than the warband has is confirmed, never refused.
  const [isConfirmingOverspend, setIsConfirmingOverspend] = useState(false);
  const queryClient = useQueryClient();
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
    currentPrice: params.currentPrice,
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
  });

  const beast = useAcquireBeastChoice({
    item,
    unitType: resolvedUnitType,
    unitLabel: target.selectedUnitLabel,
    unitId: resolvedUnitId,
    quantity: count,
    groups: target.henchmenGroups,
    deferCommit,
  });

  // The server's gold, from the warband sheet's summary (BUG-37): never re-derived here.
  const { notice, actionDisabled, actionDisabledReason, overspend } = acquireBlockers({
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
      // A search that ended without a purchase is still saved (decision 9).
      rarity.saveUnsentRolls();
      setError("");
      target.reset();
      form.reset();
      rarity.reset();
      beast.reset();
    }
  };

  /** Buy or Give: an overspend asks first (`confirmed` once it has). */
  const handleAcquire = async (confirmed = false) => {
    if (!warband || !resolvedUnitType || !canProceed) {
      return;
    }
    if (overspend !== null && !confirmed) {
      setIsConfirmingOverspend(true);
      return;
    }
    setIsConfirmingOverspend(false);
    setIsSubmitting(true);
    setError("");
    let didCommit = false;
    let didClose = false;
    try {
      const meta = form.meta();
      // A rare item's roll goes with it, spending the searcher's trading action.
      const rarityRoll = isBuying && !form.isCommonRarity ? rarity.rollForPurchase() : null;
      const availabilityId = form.resolvedAvailability?.id ?? null;
      const choice = { item, meta, availabilityId, rarityRoll, companion: beast.companion };
      if (deferCommit) {
        // Queued: the roster Save sends the line in its batch (decision 1), roll included.
        rarity.markRollSent(rarityRoll, false);
        onAcquire?.(item, resolvedUnitType, resolvedUnitId, {
          ...meta,
          line: purchaseLine(choice),
        });
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
      // One request; the answer goes into the cache (the unit's items, the stash, gold, the row).
      // An item with no current price and no availability (an unsold beast) has none for the
      // server to charge: Buy again sends the price shown instead.
      const priceKnown = params.currentPrice != null || form.resolvedAvailability !== null;
      const atCurrentPrice = Boolean(params.atCurrentPrice) && !form.priceEdited && priceKnown;
      await purchase(
        {
          ...choice,
          warbandId: warband.id,
          target: resolved.target,
          atCurrentPrice,
          recruit: beast.recruit,
        },
        queryClient
      );
      didCommit = true;
      rarity.markRollSent(rarityRoll);
      onAcquire?.(item, resolvedUnitType, resolvedUnitId, meta);
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
    rollDisabled: rarity.rollDisabled || isSubmitting,
    isSavingRarityRoll: isSubmitting,
    hasStoredRarityRoll: rarity.hasStoredRarityRoll,
    currentRarityRoll: rarity.currentRarityRoll,
    modifierEnabled: rarity.modifierEnabled,
    handleModifierEnabledChange: rarity.handleModifierEnabledChange,
    rarityModifier: rarity.rarityModifier,
    setRarityModifier: rarity.setRarityModifier,
    modifierReason: rarity.modifierReason,
    setModifierReason: rarity.setModifierReason,
    handleRarityRollTotalChange: rarity.handleRarityRollTotalChange,
    basePrice: form.basePrice,
    finalPrice,
    setFinalPrice: form.setFinalPrice,
    quantity: count,
    handleQuantityChange: form.handleQuantityChange,
    itemReason: form.itemReason,
    setItemReason: form.setItemReason,
    actionDisabled,
    actionDisabledReason,
    isSubmitting,
    handleAcquire: () => handleAcquire(),
    overspendConfirm: {
      open: isConfirmingOverspend,
      message: notice,
      onOpenChange: setIsConfirmingOverspend,
      onConfirm: () => handleAcquire(true),
    },
    /** What stops Buy or Give, shown under the buttons and not only in their tooltip. */
    notice,
    availabilities: form.availabilities,
    selectedAvailabilityId: form.selectedAvailabilityId,
    setSelectedAvailabilityId: form.setSelectedAvailabilityId,
    resolvedAvailability: form.resolvedAvailability,
    /** A beast's extra choice (switch on, recruit) and whether the shop sells it. */
    beast: { view: beast.view, unlisted: beast.unlisted },
  };
}
