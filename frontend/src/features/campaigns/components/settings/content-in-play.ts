import type { Setting, SettingPreset } from "../../types/campaign-types";

/** The preset a new campaign starts on (the plan's suggestion): every setting up to 1c. */
export const DEFAULT_PRESET = "1c";

const sorted = (ids: number[]) => [...ids].sort((x, y) => x - y).join();
const sameIds = (a: number[], b: number[]) => sorted(a) === sorted(b);

/** The selection with the always-on settings in it, whatever was picked. */
export function withAlwaysOn(ids: number[], settings: Setting[]) {
  const always = settings.filter((setting) => setting.always_on).map((setting) => setting.id);
  return [...new Set([...ids, ...always])];
}

/** The preset the selection is exactly ("1c"), or null once it was adjusted by hand. */
export function presetOf(ids: number[], presets: SettingPreset[], settings: Setting[]) {
  const picked = withAlwaysOn(ids, settings);
  return (
    presets.find((preset) => sameIds(withAlwaysOn(preset.setting_ids, settings), picked))?.grade ??
    null
  );
}

/** Ticks or unticks one setting; an always-on one (Mordheim) stays. */
export function toggleSetting(ids: number[], setting: Setting) {
  if (setting.always_on) return ids;
  return ids.includes(setting.id) ? ids.filter((id) => id !== setting.id) : [...ids, setting.id];
}

/** How many of the book's warband types the selection brings into play. */
export function typesInScope(ids: number[], settings: Setting[]) {
  const picked = new Set(withAlwaysOn(ids, settings));
  return settings.reduce(
    (sum, setting) => sum + (picked.has(setting.id) ? setting.warband_types : 0),
    0
  );
}

/** "N warband types in scope." */
export function scopeLine(ids: number[], settings: Setting[]) {
  const count = typesInScope(ids, settings);
  return `${count} warband ${count === 1 ? "type" : "types"} in scope.`;
}

/**
 * The grades below the highest ticked one that nothing ticked sits at, lowest first. An item's or a
 * rule's setting is the first book that printed it, so a later book takes from earlier grades: one
 * left out in between puts that content out of play (William, 21 Nov 2026). The grade order is the
 * server's, its presets' own. Empty when the ticked grades run unbroken.
 */
export function gradeGaps(ids: number[], settings: Setting[], presets: SettingPreset[]) {
  const order = presets.map((preset) => preset.grade);
  const picked = new Set(withAlwaysOn(ids, settings));
  const ticked = new Set(settings.filter((setting) => picked.has(setting.id)).map((s) => s.grade));
  const top = order.reduce((highest, grade, index) => (ticked.has(grade) ? index : highest), -1);
  return order
    .slice(0, Math.max(top, 0))
    .filter((grade) => !ticked.has(grade) && settings.some((setting) => setting.grade === grade));
}

/** The warning a gap gives ("No 2a setting is ticked, though a 2b one is: ..."), or "" for none. */
export function gapWarning(ids: number[], settings: Setting[], presets: SettingPreset[]) {
  const gaps = gradeGaps(ids, settings, presets);
  if (!gaps.length) return "";
  const picked = new Set(withAlwaysOn(ids, settings));
  const ticked = presets
    .map((preset) => preset.grade)
    .filter((grade) => settings.some((s) => s.grade === grade && picked.has(s.id)));
  const top = ticked[ticked.length - 1];
  const last = gaps[gaps.length - 1];
  const named = gaps.length === 1 ? last : `${gaps.slice(0, -1).join(", ")} or ${last}`;
  const those = gaps.length === 1 ? "that grade" : "those grades";
  return `No ${named} setting is ticked, though a ${top} one is: anything first printed at ${those} won't be in play.`;
}
