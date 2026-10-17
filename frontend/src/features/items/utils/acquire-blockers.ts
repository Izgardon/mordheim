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
 * What stops Buy or Give: `notice` is shown under the buttons, `actionDisabledReason` in their
 * tooltip. A purchase over the gold left is refused today; decision 2 (PR C) makes it a warning.
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
  const spendable =
    gold === null ? null : Math.max(0, gold - Math.max(0, Number(reservedGold) || 0));
  const goldNotice =
    !isBuying || totalPrice <= 0
      ? ""
      : spendable === null
        ? "Gold crowns unknown for this warband."
        : totalPrice > spendable
          ? `Not enough gold crowns. Available: ${spendable} gc.`
          : "";
  const notice = hasWarband ? goldNotice : NO_WARBAND_NOTICE;
  const actionDisabled = !canProceed || isSubmitting || Boolean(notice);

  let actionDisabledReason = "";
  if (actionDisabled) {
    if (!hasWarband) {
      actionDisabledReason = NO_WARBAND_NOTICE;
    } else if (!canProceed) {
      actionDisabledReason = !unitType
        ? "Select who receives the item."
        : (!unitId && RECEIVER_PROMPTS[unitType]) || "Select a receiver to continue.";
    } else if (isSubmitting) {
      actionDisabledReason = isBuying ? "Processing purchase..." : "Processing...";
    } else {
      actionDisabledReason = notice || "Unable to proceed.";
    }
  }
  return { notice, actionDisabled, actionDisabledReason };
}
