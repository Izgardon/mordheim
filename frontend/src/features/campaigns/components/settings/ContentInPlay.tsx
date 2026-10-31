import { useState } from "react";
import { Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/utils";

import type { Setting, SettingPreset } from "../../types/campaign-types";
import { presetOf, scopeLine, toggleSetting } from "./content-in-play";
import { CAPTION } from "./settings-ui";

type ContentInPlayProps = {
  settings: Setting[];
  presets: SettingPreset[];
  /** The ticked settings' ids. */
  value: number[];
  onChange: (ids: number[]) => void;
  disabled?: boolean;
  /** Campaign creation: the presets and the count, the settings themselves behind Adjust. */
  compact?: boolean;
};

const GRADE = "font-mono text-[11px] font-normal opacity-80";

/**
 * What a campaign plays with (grading phase 1, v5's mock): a grade preset ticks every setting at
 * or below it, then the owner adjusts the settings by hand; Mordheim is always in. Types outside
 * the ticked settings stay listed in the pickers, greyed out.
 */
export default function ContentInPlay(props: ContentInPlayProps) {
  const { settings, presets, value, onChange, disabled } = props;
  const [adjusting, setAdjusting] = useState(!props.compact);
  const preset = presetOf(value, presets, settings);
  const presetInfo = presets.find((entry) => entry.grade === preset);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <span id="content-presets" className={CAPTION}>
          Grade presets
        </span>
        <div role="group" aria-labelledby="content-presets" className="flex flex-wrap gap-1.5">
          {presets.map((entry) => (
            <Chip
              key={entry.grade}
              pressed={entry.grade === preset}
              disabled={disabled}
              title={entry.description}
              onClick={() => onChange(entry.setting_ids)}
              className="font-mono"
            >
              {entry.label}
            </Chip>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">
          {presetInfo
            ? `Up to ${presetInfo.grade}, ${presetInfo.description}: every setting at or below it.`
            : "Adjusted by hand. A preset ticks every setting at or below its grade."}
        </span>
      </div>
      {adjusting ? (
        <div className="flex flex-col gap-1.5">
          <span id="content-settings" className={CAPTION}>
            Settings
          </span>
          <div role="group" aria-labelledby="content-settings" className="flex flex-wrap gap-1.5">
            {settings.map((setting) => (
              <Chip
                key={setting.id}
                pressed={setting.always_on || value.includes(setting.id)}
                disabled={disabled || setting.always_on}
                title={
                  setting.always_on ? "Always in play" : `${setting.grade} ${setting.grade_label}`
                }
                onClick={() => onChange(toggleSetting(value, setting))}
                className={cn(setting.always_on && "disabled:opacity-100")}
              >
                {setting.always_on ? <Lock className="h-3 w-3" aria-hidden="true" /> : null}
                {setting.name}
                <span className={GRADE}>{setting.grade}</span>
              </Chip>
            ))}
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-sm text-text2">{scopeLine(value, settings)}</p>
        {props.compact ? (
          <Button variant="ghost" size="sm" onClick={() => setAdjusting((open) => !open)}>
            {adjusting ? "Hide the settings" : "Adjust the settings"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
