import { feeOf, type Fee, type FeeKind } from "../../fees";

/** A fee as a form edits it: every number a string, each resource a line. */
export type FeeDraft = {
  kind: FeeKind;
  gold: string;
  dice: string;
  dice_multiplier: string;
  resources: { resource: string; amount: string }[];
  note: string;
};

const text = (value: number | null | undefined) =>
  value === null || value === undefined ? "" : String(value);

export function feeDraftOf(raw: Fee | null | undefined): FeeDraft {
  const fee = feeOf(raw);
  return {
    kind: fee.kind,
    gold: text(fee.gold),
    dice: text(fee.dice),
    dice_multiplier: text(fee.dice_multiplier),
    resources: fee.resources.map((line) => ({
      resource: line.resource,
      amount: String(line.amount),
    })),
    note: fee.note,
  };
}

/** A blank number is none; anything else a whole number of 0 or more. */
const count = (value: string) =>
  value.trim() === "" ? null : Math.max(0, Math.trunc(Number(value) || 0));

/** The fee the server stores: a fee that isn't gold keeps only its note; a blank resource is dropped. */
export function feeFromDraft(draft: FeeDraft): Fee {
  const gold = draft.kind === "gold";
  const dice = gold ? count(draft.dice) : null;
  return {
    kind: draft.kind,
    gold: gold ? count(draft.gold) : null,
    dice: dice || null,
    dice_multiplier: dice ? count(draft.dice_multiplier) || null : null,
    resources: gold
      ? draft.resources
          .filter((line) => line.resource.trim())
          .map((line) => ({ resource: line.resource.trim(), amount: count(line.amount) ?? 0 }))
      : [],
    note: draft.note.trim(),
  };
}
