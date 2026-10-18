import type { UnitTypeOption } from "@components/unit-selection-section";

export const NO_WARBAND_NOTICE = "You need a warband in this campaign to buy or give items.";

const RECEIVER_PROMPTS: Partial<Record<UnitTypeOption, string>> = {
  heroes: "Select a hero to receive the item.",
  hiredswords: "Select a hired sword to receive the item.",
  henchmen: "Select a henchmen group to receive the item.",
};

type AcquireBlockerInput = {
  hasWarband: boolean;
  /** The warband's gold from its summary (null: unknown). */
  gold: number | null;
  /** Gold already promised to purchases queued in roster edit mode. */
  reservedGold: number;
  isBuying: boolean;
  totalPrice: number;
  canProceed: boolean;
  isSubmitting: boolean;
  unitType: UnitTypeOption | "";
  unitId: string;
};

/**
 * What stops Buy or Give, and what to warn about. `notice` shows under the buttons and
 * `actionDisabledReason` in their tooltip. Spending more than the warband has is never a block
 * (decision 2): `overspend` is the gold it would be left with, which the player confirms first.
 */
export function acquireBlockers({
  hasWarband,
  gold,
  reservedGold,
  isBuying,
  totalPrice,
  canProceed,
  isSubmitting,
  unitType,
  unitId,
}: AcquireBlockerInput) {
  const charges = isBuying && totalPrice > 0;
  const left = gold === null ? null : gold - Math.max(0, Number(reservedGold) || 0) - totalPrice;
  const overspend = charges && left !== null && left < 0 ? left : null;
  const goldNotice = !charges
    ? ""
    : gold === null
      ? "Gold crowns unknown for this warband."
      : overspend !== null
        ? overspendMessage(overspend)
        : "";
  const notice = hasWarband ? goldNotice : NO_WARBAND_NOTICE;
  const actionDisabled = !hasWarband || !canProceed || isSubmitting;

  let actionDisabledReason = "";
  if (actionDisabled) {
    if (!hasWarband) {
      actionDisabledReason = NO_WARBAND_NOTICE;
    } else if (!canProceed) {
      actionDisabledReason = !unitType
        ? "Select who receives the item."
        : (!unitId && RECEIVER_PROMPTS[unitType]) || "Select a receiver to continue.";
    } else {
      actionDisabledReason = isBuying ? "Processing purchase..." : "Processing...";
    }
  }
  return { notice, actionDisabled, actionDisabledReason, overspend };
}

/** "This leaves the warband at -15 gc." (the server's wording for the same warning). */
export const overspendMessage = (goldLeft: number) => `This leaves the warband at ${goldLeft} gc.`;
