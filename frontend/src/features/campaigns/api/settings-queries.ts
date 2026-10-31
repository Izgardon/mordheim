import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { apiRequest } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

import type { Setting, SettingsList } from "../types/campaign-types";

/** The settings change only with a reseed: the list is read once a session, more or less. */
const SETTINGS_STALE_TIME_MS = 30 * 60_000;

export function listSettings() {
  return apiRequest<SettingsList>("/settings/");
}

/**
 * Every setting with its grade and how many book warband types it holds, and the grade presets
 * (grading phase 1): the "Content in play" card, campaign creation and the greyed-out warnings.
 */
export function useSettingsList({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.settings(),
    queryFn: listSettings,
    staleTime: SETTINGS_STALE_TIME_MS,
    enabled,
  });
}

/** Setting id -> setting, for the "Khemri isn't in this campaign" warnings. */
export function settingsById(settings: Setting[] | undefined) {
  return new Map((settings ?? []).map((setting) => [setting.id, setting]));
}

/**
 * The warning a catalogue row outside the campaign's settings carries ("Khemri isn't in this
 * campaign"), or "" when it is in play (or the list knows no campaign).
 */
export function outOfPlay(
  row: { in_play?: boolean | null; setting_id?: number | null },
  settings: Map<number, Setting>
) {
  if (row.in_play !== false) return "";
  const setting = row.setting_id != null ? settings.get(row.setting_id) : undefined;
  return `${setting?.name ?? "Its setting"} isn't in this campaign`;
}

/** The settings by id from the cached list, for `outOfPlay`. */
export function useSettingsById() {
  const { data } = useSettingsList();
  return useMemo(() => settingsById(data?.settings), [data]);
}
