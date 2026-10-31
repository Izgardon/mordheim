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

/** "N warband types in scope. The rest stay listed, greyed out." */
export function scopeLine(ids: number[], settings: Setting[]) {
  const count = typesInScope(ids, settings);
  return `${count} warband ${count === 1 ? "type" : "types"} in scope. The rest stay listed, greyed out.`;
}
