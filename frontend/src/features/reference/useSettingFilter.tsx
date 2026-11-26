import type { ReactNode } from "react";

import { useSettingsById } from "@/features/campaigns/api/settings-queries";

import { FilterSelect } from "./FilterLine";
import { ALL_SETTINGS, entrySettingKey, settingKeyOptions, type SettingRow } from "./in-play";
import { useOwnWords } from "./own-words";
import type { useReferenceParams } from "./useReferenceParams";

/**
 * A reference page's Setting dropdown over these rows (`?setting=`): `matches` keeps a row of the
 * picked setting, and `select` is the dropdown, shown only where the rows come from two settings
 * or more.
 */
export function useSettingFilter(
  rows: SettingRow[],
  params: ReturnType<typeof useReferenceParams>,
  isMobile: boolean
): { matches: (row: SettingRow) => boolean; select: ReactNode } {
  const settings = useSettingsById();
  const words = useOwnWords();
  const setting = params.get("setting", ALL_SETTINGS);
  const options = settingKeyOptions(
    rows.map((row) => entrySettingKey(row, settings)),
    settings,
    words.Place
  );
  return {
    matches: (row) => setting === ALL_SETTINGS || entrySettingKey(row, settings) === setting,
    select:
      options.length > 2 ? (
        <FilterSelect
          label="Setting"
          options={options}
          value={setting}
          onChange={(next) => params.set({ setting: next === ALL_SETTINGS ? null : next })}
          isMobile={isMobile}
        />
      ) : null,
  };
}
