import { useEffect, useMemo, useState } from "react";

import type { Item, ItemAvailability } from "../types/item-types";
import type { AcquireItemMeta } from "../types/acquire-types";

type UseAcquireFormOptions = {
  item: Item;
  initialAvailabilityId?: number | null;
  /** The price to start from instead of the availability's (Buy again's current_price). */
  currentPrice?: number | null;
  open: boolean;
  /** Who receives the item ("type:id"): picking another one resets a typed quantity. */
  targetKey: string;
  /** A receiver is chosen: the receiver section folds and the price (and rarity) unfold. */
  canProceed: boolean;
  /** A quantity to start from (a henchmen group's members), until the player types one. */
  suggestedQuantity: number | null;
  defaultUnitSectionCollapsed?: boolean;
  defaultRaritySectionCollapsed?: boolean;
  defaultPriceSectionCollapsed?: boolean;
};

/**
 * The acquire dialog's form: buy or give, the availability, the price, the quantity (only a
 * common item takes one, BUG-70), the gift's reason, and which sections are folded.
 */
export function useAcquireForm({
  item,
  initialAvailabilityId,
  currentPrice,
  open,
  targetKey,
  canProceed,
  suggestedQuantity,
  defaultUnitSectionCollapsed,
  defaultRaritySectionCollapsed,
  defaultPriceSectionCollapsed,
}: UseAcquireFormOptions) {
  const [selectedAvailabilityId, setSelectedAvailabilityId] = useState<number | null>(
    initialAvailabilityId ?? null
  );
  const [isBuying, setIsBuying] = useState(true);
  const [itemReason, setItemReason] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [quantityTouched, setQuantityTouched] = useState(false);
  const [isUnitSelectionCollapsed, setIsUnitSelectionCollapsed] = useState(
    defaultUnitSectionCollapsed ?? false
  );
  const [isRarityCollapsed, setIsRarityCollapsed] = useState(defaultRaritySectionCollapsed ?? true);
  const [isPriceCollapsed, setIsPriceCollapsed] = useState(defaultPriceSectionCollapsed ?? true);

  const availabilities = useMemo(() => item.availabilities ?? [], [item.availabilities]);
  const resolvedAvailability = useMemo<ItemAvailability | null>(() => {
    if (availabilities.length === 0) return null;
    if (availabilities.length === 1) return availabilities[0];
    if (selectedAvailabilityId !== null) {
      return availabilities.find((a) => a.id === selectedAvailabilityId) ?? availabilities[0];
    }
    return availabilities[0];
  }, [availabilities, selectedAvailabilityId]);

  const resolvedCost = currentPrice ?? resolvedAvailability?.cost ?? 0;
  const rarity = resolvedAvailability?.rarity ?? 2;
  const variableCost = resolvedAvailability?.variable_cost ?? null;
  const [finalPrice, setFinalPrice] = useState(resolvedCost);

  const isCommonRarity = rarity === 2;
  // Copies acquired: only a common item takes a quantity (BUG-70: never the stale pick).
  const count = isCommonRarity ? quantity : 1;
  const totalPrice = isBuying ? finalPrice * count : finalPrice;
  const hasVariableCost = Boolean(variableCost && variableCost.trim());
  const priceSummary = {
    text:
      isBuying && count > 1 ? `${finalPrice} x ${count} = ${totalPrice} gc` : `${totalPrice} gc`,
    variable: hasVariableCost ? (variableCost ?? "") : "",
  };

  useEffect(() => {
    if (!open) {
      return;
    }
    setSelectedAvailabilityId(initialAvailabilityId ?? null);
  }, [open, initialAvailabilityId, item.id]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setFinalPrice(resolvedCost);
  }, [open, item.id, resolvedCost]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setQuantityTouched(false);
  }, [open, targetKey, item.id, isBuying, isCommonRarity]);

  useEffect(() => {
    if (suggestedQuantity === null || !open || !isBuying || !isCommonRarity || quantityTouched) {
      return;
    }
    setQuantity(suggestedQuantity);
  }, [suggestedQuantity, open, isBuying, isCommonRarity, quantityTouched]);

  useEffect(() => {
    if (!canProceed) {
      setIsUnitSelectionCollapsed(false);
      return;
    }
    setIsUnitSelectionCollapsed(true);
    if (isBuying) {
      if (!isCommonRarity) {
        setIsRarityCollapsed((prev) => (prev ? false : prev));
      }
      setIsPriceCollapsed((prev) => (prev ? false : prev));
    }
  }, [canProceed, isBuying, isCommonRarity]);

  const handleQuantityChange = (value: number) => {
    setQuantity(value);
    setQuantityTouched(true);
  };

  /** What the player chose, as the purchase (or the queued purchase) takes it. */
  const meta = (): AcquireItemMeta => ({
    isBuying,
    quantity: count,
    unitPrice: finalPrice,
    totalPrice,
    reason: itemReason,
    baseCost: resolvedAvailability?.cost ?? finalPrice,
  });

  /** Back to a fresh form, as the dialog closes. */
  const reset = () => {
    setItemReason("");
    setIsBuying(true);
    setQuantity(1);
    setQuantityTouched(false);
    setIsUnitSelectionCollapsed(defaultUnitSectionCollapsed ?? false);
    setIsRarityCollapsed(defaultRaritySectionCollapsed ?? true);
    setIsPriceCollapsed(defaultPriceSectionCollapsed ?? true);
    setSelectedAvailabilityId(initialAvailabilityId ?? null);
    setFinalPrice(resolvedCost);
  };

  return {
    availabilities,
    selectedAvailabilityId,
    setSelectedAvailabilityId,
    resolvedAvailability,
    rarity,
    isCommonRarity,
    isBuying,
    setIsBuying,
    itemReason,
    setItemReason,
    /** The price a copy starts at: Buy again's current price, or the availability's cost. */
    basePrice: resolvedCost,
    finalPrice,
    setFinalPrice,
    count,
    totalPrice,
    /** The player changed the price the availability suggested. */
    priceEdited: finalPrice !== resolvedCost,
    meta,
    priceSummary,
    handleQuantityChange,
    isUnitSelectionCollapsed,
    setIsUnitSelectionCollapsed,
    isRarityCollapsed,
    setIsRarityCollapsed,
    isPriceCollapsed,
    setIsPriceCollapsed,
    reset,
  };
}
