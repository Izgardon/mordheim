import { Tooltip } from "@components/tooltip";

import type { EffectiveStats } from "../../../types/companion-types";

type StatValue = number | string | null | undefined;

const MOUNTED_KEYS = ["movement", "armour_save"] as const;

const asNumber = (value: StatValue) => {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
};

/** A stat as the tables show it: "4", a save as "5+", or "-" for none. */
export const formatStat = (key: string, value: StatValue) => {
  const number = asNumber(value);
  if (number === null) return "-";
  return key === "armour_save" ? `${number}+` : String(number);
};

/**
 * The value a mounted unit shows for `key` (M and Sv only) when it differs from its own, from the
 * server's `effective_stats`; undefined otherwise (on foot, another stat, or the same value).
 */
export function mountedValue(
  mounted: EffectiveStats | null | undefined,
  key: string,
  own: StatValue
): number | undefined {
  if (!mounted || !(MOUNTED_KEYS as readonly string[]).includes(key)) return undefined;
  const value = mounted[key as (typeof MOUNTED_KEYS)[number]];
  if (value === null || value === undefined || value === asNumber(own)) return undefined;
  return value;
}

/** A mounted value, highlighted, with the foot value in a tooltip (never the unit's own stat). */
export default function MountedStatValue({
  statKey,
  value,
  own,
  tooltipContentClassName,
}: {
  statKey: string;
  value: number;
  own: StatValue;
  tooltipContentClassName?: string;
}) {
  return (
    <Tooltip
      trigger={
        <span data-mounted="true" className="font-semibold text-amber-300">
          {formatStat(statKey, value)}
        </span>
      }
      content={`On foot: ${formatStat(statKey, own)}`}
      // Keyboard users open it too, as they do the battle marks.
      tabIndex={0}
      className="inline-flex cursor-help"
      contentClassName={tooltipContentClassName}
      minWidth={120}
      maxWidth={200}
    />
  );
}
