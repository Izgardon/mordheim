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

/**
 * Stats written as the books print them, by field ("1(2)", "5*", "2D6", "-"; William: "allow free
 * text instead of nums"). The stat's own field holds the number the app does sums with: the one
 * its text starts with, or null when it has none ("D6", "-": not 0).
 */
export type WrittenStats = Partial<Record<StatKey, string>>;

/** The number a written value starts with ("1(2)" is 1, "5*" is 5), or null ("D6", "2D6", "-"). */
export function writtenNumber(text: string): number | null {
  const match = /^(\d+)(?![\dDd])/.exec(text);
  return match ? Number(match[1]) : null;
}

/** What a stat shows: its written value, else its number (a dash for none). */
export const statShown = (number: number | null | undefined, written?: string): string | number =>
  written ?? number ?? "–";

/**
 * A written stat whose number has moved since it was written: an advance or an injury changes the
 * number, never the text, so the player updates it (William: "do alternative, but warn").
 */
export const writtenStale = (number: number | null | undefined, written?: string) =>
  written !== undefined && writtenNumber(written) !== (number ?? null);

/** Whether a stat box holds a written value rather than a plain number (or nothing yet). */
export const isWritten = (value: unknown) => !/^\d*$/.test(String(value ?? "").trim());

/** A stat box's text as a plain number: the one a written value starts with, else empty. */
export const numberOnly = (value: unknown) => {
  const text = String(value ?? "").trim();
  return isWritten(text) ? String(writtenNumber(text) ?? "") : text;
};

/** A stored profile's stats as its form edits them: a written value as written. */
export const profileInputs = (
  profile: Partial<Record<StatKey, number | null>> & { written_stats?: WrittenStats }
): StatInputs =>
  Object.fromEntries(
    STAT_FIELDS.map(({ key }) => [key, statInput(profile[key], profile.written_stats?.[key])])
  ) as StatInputs;

/** A stat as a form edits it: its written value, else its number. */
export const statInput = (number: number | null | undefined, written?: string) =>
  written ?? (number === null || number === undefined ? "" : String(number));

/** A stat as a save sends it: a plain number as a number, a written value as typed, empty as 0. */
export function statToSend(value: unknown): number | string {
  const text = String(value ?? "").trim();
  if (!text) return 0;
  return /^\d+$/.test(text) ? Number(text) : text;
}

/** A profile's stats as a save sends them (`statToSend`), keyed by field. */
export const statsToSend = (stats: StatInputs) =>
  Object.fromEntries(STAT_FIELDS.map(({ key }) => [key, statToSend(stats[key])])) as Record<
    StatKey,
    number | string
  >;

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
