/**
 * The nine characteristics in profile order: the field a race, a bestiary entry or a hired sword
 * stores each one in, and the label it goes by (an item's statblock is keyed by the label).
 */
export const STAT_FIELDS = [
  { key: "movement", label: "M" },
  { key: "weapon_skill", label: "WS" },
  { key: "ballistic_skill", label: "BS" },
  { key: "strength", label: "S" },
  { key: "toughness", label: "T" },
  { key: "wounds", label: "W" },
  { key: "initiative", label: "I" },
  { key: "attacks", label: "A" },
  { key: "leadership", label: "Ld" },
] as const;

export type StatKey = (typeof STAT_FIELDS)[number]["key"];
export type StatLabel = (typeof STAT_FIELDS)[number]["label"];

export const STAT_LABELS: readonly StatLabel[] = STAT_FIELDS.map((field) => field.label);

/** Each characteristic as text, keyed by field: what the race and bestiary forms edit. */
export type StatInputs = Record<StatKey, string>;

/** Each characteristic as text, keyed by label: an item's statblock as its forms edit it. */
export type ItemStatblock = Record<StatLabel, string>;

/** A stat line of `value` everywhere, with `overrides` (e.g. W and A start at 1 on a creature). */
export function statInputs(value: string, overrides: Partial<StatInputs> = {}): StatInputs {
  const line = Object.fromEntries(STAT_FIELDS.map(({ key }) => [key, value])) as StatInputs;
  return { ...line, ...overrides };
}

/** The form's stat text as numbers; anything that isn't one counts as 0. */
export function statNumbers(stats: StatInputs): Record<StatKey, number> {
  return Object.fromEntries(STAT_FIELDS.map(({ key }) => [key, Number(stats[key]) || 0])) as Record<
    StatKey,
    number
  >;
}

/** A stored profile's characteristics in profile order. */
export const profileValues = (profile: Record<StatKey, number>) =>
  STAT_FIELDS.map(({ key }) => profile[key]);

export const blankItemStatblock = (): ItemStatblock =>
  Object.fromEntries(STAT_LABELS.map((label) => [label, ""])) as ItemStatblock;

/**
 * An item's stored statblock as its forms edit it: JSON (what the forms write), or the older
 * "M: 4, WS: 3" text; anything unreadable leaves the stat blank.
 */
export function parseItemStatblock(statblock?: string | null): ItemStatblock {
  const blank = blankItemStatblock();
  if (!statblock) {
    return blank;
  }
  try {
    const parsed = JSON.parse(statblock) as Record<string, string | number>;
    return STAT_LABELS.reduce(
      (acc, label) => ({
        ...acc,
        [label]: parsed?.[label] !== undefined ? String(parsed[label]) : "",
      }),
      blank
    );
  } catch {
    const next = { ...blank };
    statblock.split(",").forEach((entry) => {
      const match = entry.trim().match(/^([A-Za-z]+)\s*:\s*(.+)$/);
      const label = match?.[1].toUpperCase();
      if (match && STAT_LABELS.includes(label as StatLabel)) {
        next[label as StatLabel] = match[2].trim();
      }
    });
    return next;
  }
}

/**
 * An item's stored statblock for display: JSON, or the older single-quoted or bare-key object
 * text; null when it is neither (it is then shown as written).
 */
export function readItemStatblock(statblock: string): Record<string, string | number> | null {
  try {
    return JSON.parse(statblock) as Record<string, string | number>;
  } catch {
    try {
      const normalized = statblock
        .replace(/'/g, '"')
        .replace(/([,{]\s*)([A-Za-z]+)(\s*:)/g, '$1"$2"$3');
      return JSON.parse(normalized) as Record<string, string | number>;
    } catch {
      return null;
    }
  }
}
