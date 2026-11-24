import { ChipLabel } from "@/components/ui/chip";
import { UNIT_MARKER_ICONS } from "@/components/ui/game-icons";
import { cn } from "@/lib/utils";

import {
  isCreature,
  KIND_TRIM,
  unitMarker,
  unitName,
  unitTypeLine,
  type RosterUnit,
} from "./unit-view";

/**
 * A roster card's title, which opens and closes it: its marker (William, 22 Nov 2026: "game icons
 * ... the leader's crown can move into that space and the rest have helmets") in its kind's metal,
 * beside the name and, under it, the type (a group's count after it).
 */
export default function UnitTitle({
  entry,
  open,
  countText,
  onToggle,
}: {
  entry: RosterUnit;
  open: boolean;
  countText: string | null;
  onToggle: () => void;
}) {
  const trim = KIND_TRIM[entry.kind];
  const marker = unitMarker(entry);
  const Marker = UNIT_MARKER_ICONS[marker];
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      className="flex min-w-0 items-center gap-2.5 text-left"
    >
      <Marker
        focusable="false"
        data-marker={marker}
        className={cn("h-5 w-5 shrink-0", trim.text)}
        {...(marker === "leader"
          ? { role: "img", "aria-label": "Leader" }
          : { "aria-hidden": true })}
      />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-display text-[19px] font-semibold leading-tight text-head">
          {unitName(entry.unit)}
          {isCreature(entry) ? (
            // its paw is the marker already
            <ChipLabel className="min-h-0 px-1.5 py-px text-[11px]">Creature</ChipLabel>
          ) : null}
        </span>
        <span className={cn("text-[13px] leading-tight", trim.text)}>
          {unitTypeLine(entry)}
          {countText ? <span className="ml-1.5 font-mono">{countText}</span> : null}
        </span>
      </span>
    </button>
  );
}
