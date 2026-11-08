import { HIRE_KINDS, feeOf, type Fee, type FeeKind, type FeeResource } from "../../fees";

/** A fee's resource line as a form edits it: the amount a string, the server's names kept. */
export type FeeDraftLine = Omit<FeeResource, "amount"> & { amount: string };

/**
 * A fee as a form edits it: every number a string, and at most one resource on top of the gold
 * (William, 7 Nov 2026: "the add resource option is only there once"). A stored fee the form can't
 * hold (two or more resources, or a kind the field doesn't offer) is `kept` whole and shown as it
 * is until Replace, so nothing it holds is lost.
 */
export type FeeDraft = {
  kind: FeeKind;
  gold: string;
  dice: string;
  dice_multiplier: string;
  resources: FeeDraftLine[];
  note: string;
  /** The stored fee kept as it is; null once the form edits it. */
  kept: Fee | null;
  /** Its note box shows: the fee had one (a footnote, "15 gc*"); "See his rules" always shows it. */
  hasNote: boolean;
};

const text = (value: number | null | undefined) =>
  value === null || value === undefined ? "" : String(value);

/** The fee's own draft: its gold, dice, first resource and note (Replace starts from it). */
function editable(fee: Fee): FeeDraft {
  return {
    kind: fee.kind,
    gold: text(fee.gold),
    dice: text(fee.dice),
    dice_multiplier: text(fee.dice_multiplier),
    resources: fee.resources.slice(0, 1).map((line) => ({ ...line, amount: String(line.amount) })),
    note: fee.note,
    kept: null,
    hasNote: Boolean(fee.note.trim()),
  };
}

/** A stored fee as the form edits it; `kinds` are the kinds the field offers (upkeep: no hero's place). */
export function feeDraftOf(raw: Fee | null | undefined, kinds: FeeKind[] = HIRE_KINDS): FeeDraft {
  const fee = feeOf(raw);
  const fits = fee.resources.length <= 1 && kinds.includes(fee.kind);
  return { ...editable(fee), kept: fits ? null : fee };
}

/** Replace on a kept fee: the form edits it from its kind, gold, dice, note and first resource. */
export function replaceKept(draft: FeeDraft, kinds: FeeKind[] = HIRE_KINDS): FeeDraft {
  if (!draft.kept) return draft;
  const next = editable(draft.kept);
  return kinds.includes(next.kind) ? next : { ...next, kind: "gold" };
}

/** A blank number is none; anything else a whole number of 0 or more. */
const count = (value: string) =>
  value.trim() === "" ? null : Math.max(0, Math.trunc(Number(value) || 0));

/**
 * The fee the server stores: a kept fee as it was; a fee that isn't gold keeps only its note; a
 * blank resource is dropped.
 */
export function feeFromDraft(draft: FeeDraft): Fee {
  if (draft.kept) return draft.kept;
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

/** What a write sends for the fee: nothing for a kept one, which the server keeps as it is. */
export const feeWrite = (draft: FeeDraft): Fee | undefined =>
  draft.kept ? undefined : feeFromDraft(draft);
