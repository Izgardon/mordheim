import type { HirelingStays } from "../types/hireling-catalogue-types";

/** "One battle" for a dramatis persona who leaves after one battle; nothing for one who stays. */
export const staysLabel = (stays?: HirelingStays | null) =>
  stays === "one_battle" ? "One battle" : "";

/**
 * A dramatis persona's terms on one line: "One battle · Paid in 25 gc or 1 shard", either half
 * left out when it doesn't apply.
 */
export function personaTermsLine(entry: {
  stays?: HirelingStays | null;
  payment_note?: string | null;
}) {
  return [staysLabel(entry.stays), entry.payment_note ? `Paid in ${entry.payment_note}` : ""]
    .filter(Boolean)
    .join(" · ");
}
