/** `GET <kind>/:id/usage/` (and a delete's `usage`): what in the campaign holds the entry. */
export type CatalogueUsage = {
  units?: number;
  warbands?: number;
  stashes?: number;
  bestiary_entries?: number;
};

const counted = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

/**
 * What holds an entry, zero counts left out: "3 units in 2 warbands", "1 unit and 1 stash in 1
 * warband, and by 1 bestiary entry". Null when nothing does.
 */
export function usageSummary({
  units = 0,
  warbands = 0,
  stashes = 0,
  bestiary_entries: entries = 0,
}: CatalogueUsage): string | null {
  const held = [
    units > 0 ? counted(units, "unit", "units") : "",
    stashes > 0 ? counted(stashes, "stash", "stashes") : "",
  ]
    .filter(Boolean)
    .join(" and ");
  const inWarbands =
    held && warbands > 0 ? `${held} in ${counted(warbands, "warband", "warbands")}` : held;
  const parts = [
    inWarbands,
    entries > 0 ? counted(entries, "bestiary entry", "bestiary entries") : "",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", and by ") : null;
}

/** Where a delete's usage check stands: still asking, answered, or failed (delete anyway). */
export type UsageCheck =
  | { state: "checking" }
  | { state: "ready"; usage: CatalogueUsage }
  | { state: "failed" };

type Deleted = { name: string; campaign_id?: number | null };

/**
 * The delete confirm's words, matched to what will happen (decision 5, CAT-TWEAK-04, CAT-NEW-05):
 * an unused custom entry is deleted; a used one is archived and its copies stay; a book entry is
 * removed from this campaign only. Lossy actions say what they lose.
 */
export function deleteWording(entry: Deleted, check: UsageCheck, noun: string) {
  const isBook = entry.campaign_id == null;
  if (check.state === "checking") {
    return {
      confirm: isBook ? `Remove ${noun}` : `Delete ${noun}`,
      message: `Checking what uses ${entry.name}…`,
    };
  }
  const used = check.state === "ready" ? usageSummary(check.usage) : null;
  const keep = used ? ` It is used by ${used}; they keep their copies.` : "";
  if (isBook) {
    return {
      confirm: `Remove ${noun}`,
      message: `Remove ${entry.name} from this campaign only? The book and other campaigns keep it.${keep} You can restore it from Archived.`,
    };
  }
  if (used) {
    return {
      confirm: `Archive ${noun}`,
      message: `Archive ${entry.name}?${keep} It leaves the shops and pickers, and you can restore it from Archived.`,
    };
  }
  if (check.state === "failed") {
    return {
      confirm: `Delete ${noun}`,
      message: `Delete ${entry.name}? If anything uses it, it is archived instead, and its copies stay.`,
    };
  }
  return {
    confirm: `Delete ${noun}`,
    message: `Delete ${entry.name}? Nothing uses it, so it is deleted for good.`,
  };
}
