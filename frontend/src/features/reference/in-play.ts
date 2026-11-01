import type { Setting } from "@/features/campaigns/types/campaign-types";

/**
 * The reference pages and Search everything list only what is in play in the campaign (William,
 * 1 Nov 2026): entries of its ticked and always-on settings, and its own. The server marks the
 * rest `in_play: false`; they don't show at all.
 */
export function inPlayOnly<T extends { in_play?: boolean | null }>(rows: T[]): T[] {
  return rows.filter((row) => row.in_play !== false);
}

/** Mordheim's grades (1a, 1b, 1c and 2a), one "Mordheim" in the Setting filter. */
export const MORDHEIM_SLUGS: ReadonlySet<string> = new Set([
  "mordheim",
  "mordheim-1b",
  "mordheim-1c",
  "mordheim-2a",
]);

export const ALL_SETTINGS = "all";
const MORDHEIM = "mordheim";
/** An entry with no setting: the campaign's own. */
const OWN = "own";

/** A row's Setting filter key: "mordheim" for any of Mordheim's grades, "own", or the setting's id. */
export function settingFilterKey(
  settingId: number | null | undefined,
  settings: Map<number, Setting>
): string {
  if (settingId == null) return OWN;
  const setting = settings.get(settingId);
  return setting && MORDHEIM_SLUGS.has(setting.slug) ? MORDHEIM : String(settingId);
}

/**
 * The Setting filter's options for these rows' settings: All settings, then each one once in the
 * book's order (Mordheim first, its grades as one), the campaign's own last.
 */
export function settingFilterOptions(
  settingIds: (number | null | undefined)[],
  settings: Map<number, Setting>
) {
  const keys = [...new Set(settingIds.map((id) => settingFilterKey(id, settings)))];
  const options = keys.map((key) => {
    if (key === OWN) return { id: key, label: "This campaign", order: Infinity };
    if (key === MORDHEIM) return { id: key, label: "Mordheim", order: -Infinity };
    const setting = settings.get(Number(key));
    return { id: key, label: setting?.name ?? "Unknown", order: setting?.sort_order ?? 998 };
  });
  return [
    { id: ALL_SETTINGS, label: "All settings" },
    ...options.sort((a, b) => a.order - b.order).map(({ id, label }) => ({ id, label })),
  ];
}
