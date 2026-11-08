/**
 * Hire fees and upkeep (the fees and skill lists step), as the server stores them on a hired
 * sword, a dramatis persona and a warband's hireling: a kind, gold, dice, resources and a note.
 * The server owns what a resource line matches (`names`); the pages only show it.
 */
export type FeeKind = "gold" | "replaces_hero" | "special" | "none";

export type FeeResource = {
  resource: string;
  amount: number;
  /** Every name of a warband counter that pays it ("Wyrdstone shards" pays Wyrdstone). */
  names?: string[];
  /** Paid from the warband's default resource whatever the campaign calls it (Wyrdstone). */
  default_resource?: boolean;
};

export type Fee = {
  kind: FeeKind;
  /** Null: no gold in the fee. */
  gold: number | null;
  /** D6 rolled and added when hiring ("70 + 3D6"), times the multiplier when there is one. */
  dice: number | null;
  dice_multiplier: number | null;
  resources: FeeResource[];
  /** The rest: a footnote ("15 gc*"), another way to pay. */
  note: string;
};

export const FEE_KINDS: { value: FeeKind; label: string }[] = [
  { value: "gold", label: "A fee" },
  { value: "replaces_hero", label: "Takes a hero's place" },
  { value: "special", label: "See his rules" },
  { value: "none", label: "None" },
];

/** A hire fee's kinds; an upkeep never takes a hero's place (William, 7 Nov 2026). */
export const HIRE_KINDS: FeeKind[] = FEE_KINDS.map((kind) => kind.value);
export const UPKEEP_KINDS: FeeKind[] = HIRE_KINDS.filter((kind) => kind !== "replaces_hero");

export const blankFee = (): Fee => ({
  kind: "gold",
  gold: null,
  dice: null,
  dice_multiplier: null,
  resources: [],
  note: "",
});

/** An older payload without a fee reads as a blank one. */
export const feeOf = (fee: Fee | null | undefined): Fee => ({ ...blankFee(), ...(fee ?? {}) });

/** "70 gc + 3D6", "90 gc + 5 Campaign points", "1 Wyrdstone", "Takes a hero's place", "-". */
export function formatFee(raw: Fee | null | undefined) {
  const fee = feeOf(raw);
  if (fee.kind === "none") return "None";
  if (fee.kind === "replaces_hero") return "Takes a hero's place";
  if (fee.kind === "special") return "See his rules";
  const parts = [
    fee.gold !== null ? `${fee.gold} gc` : "",
    fee.dice ? `${fee.dice}D6${fee.dice_multiplier ? `×${fee.dice_multiplier}` : ""}` : "",
    ...fee.resources.map((line) => `${line.amount} ${line.resource}`),
  ].filter(Boolean);
  return parts.join(" + ") || "-";
}

/**
 * A fee as the form's line under it reads it (William, 7 Nov 2026: "Hire fee should have a line
 * displaying what it would look like"): "30 + D6 gc and 1 Wyrdstone", "2D6×5 gc", "1 Treasure".
 */
export function feeReads(raw: Fee | null | undefined) {
  const fee = feeOf(raw);
  if (fee.kind !== "gold") return formatFee(fee);
  const dice = fee.dice
    ? `${fee.dice === 1 ? "" : fee.dice}D6${fee.dice_multiplier ? `×${fee.dice_multiplier}` : ""}`
    : "";
  const gold = [fee.gold !== null ? String(fee.gold) : "", dice].filter(Boolean).join(" + ");
  const parts = [
    gold ? `${gold} gc` : "",
    ...fee.resources.map((line) => `${line.amount} ${line.resource}`),
  ];
  return parts.filter(Boolean).join(" and ") || "-";
}

const key = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * The warband's counter that pays a fee's resource line, if any: its default resource for a line
 * the server marks `default_resource`, else the counter of one of the server's `names`.
 */
export function matchCounter<T extends { name: string; is_default?: boolean }>(
  line: Pick<FeeResource, "resource" | "names" | "default_resource">,
  counters: T[]
) {
  const own = line.default_resource ? counters.find((counter) => counter.is_default) : undefined;
  if (own) return own;
  const names = line.names?.length ? line.names : [key(line.resource)];
  return counters.find((counter) => names.includes(key(counter.name))) ?? null;
}

/** The gold a fee asks before anyone edits it: its gold plus the dice roll times the multiplier. */
export function feeGold(raw: Fee | null | undefined, roll: number | null = null) {
  const fee = feeOf(raw);
  if (fee.kind !== "gold") return 0;
  return (fee.gold ?? 0) + (roll !== null && fee.dice ? roll * (fee.dice_multiplier ?? 1) : 0);
}
