import type { MouseEvent } from "react";

import { cn } from "@/lib/utils";
import { BEAST_KIND_TEXT, BeastKindIcon } from "@/features/bestiary/components/BeastKindIcon";

import type { BeastKind } from "@/features/bestiary/bestiary-kinds";

/**
 * A henchmen group's mount row: the switch mounts or dismounts the whole group (every member
 * carries the same gear), named for the group, with how many copies the group holds; while it
 * rides more than one kind (`kinds`), the item it names is the only one a dismount leaves.
 */
export type GroupMount = { name: string; copies: number; kinds?: number; itemName?: string };

/**
 * What the button does, as its title says it: switch a mount or pet on or off, recruit a
 * creature. A group's mount is the group's: "Outriders ride them", "Outriders dismount", and
 * "Outriders dismount (Pony only)" while it rides two kinds.
 */
export function beastActionLabel(kind: BeastKind, on: boolean, group?: GroupMount) {
  if (kind === "creature") return "Recruit as henchmen";
  if (group && kind === "mount") {
    if (!on) return `${group.name} ride ${group.copies > 1 ? "them" : "it"}`;
    const only = (group.kinds ?? 1) > 1 && group.itemName ? ` (${group.itemName} only)` : "";
    return `${group.name} dismount${only}`;
  }
  if (on) return "Switch off";
  return kind === "mount" ? "Ride it" : "Keep as pet";
}

/** Each kind's filled look, for a switch that is on. */
const ON_CLASS: Record<BeastKind, string> = {
  mount: "border-amber-300/70 bg-amber-300/20",
  pet: "border-sky-300/70 bg-sky-300/20",
  creature: "border-orange-300/70 bg-orange-300/20",
};

type BeastItemButtonProps = {
  kind: BeastKind;
  /** A mount's or pet's copies are switched on (the switch is filled); never for a creature. */
  on: boolean;
  /** The row's label ("Warhorse x 2"), which names the button for screen readers. */
  itemLabel: string;
  /** A henchmen group's row: its mount switch acts for the whole group. */
  group?: GroupMount;
  disabled?: boolean;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
};

/**
 * The button beside an Animal item's menu (the plan's mock): a switch for a mount or a pet, filled
 * when on, and a recruit button for a creature. Its title says what a tap does. The 20 px square is
 * its look; on a phone its box grows to a 44 px touch target around it (`touch-target`).
 */
export default function BeastItemButton({
  kind,
  on,
  itemLabel,
  group,
  disabled = false,
  onClick,
}: BeastItemButtonProps) {
  const action = beastActionLabel(kind, on, group);
  const isSwitch = kind !== "creature";
  return (
    <button
      type="button"
      title={action}
      aria-label={`${itemLabel}: ${action}`}
      {...(isSwitch ? { "aria-pressed": on } : {})}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "touch-target group/beast flex h-5 w-5 flex-shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0 disabled:cursor-wait disabled:opacity-50",
        BEAST_KIND_TEXT[kind]
      )}
    >
      <span
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded border transition-colors duration-150",
          isSwitch && on
            ? ON_CLASS[kind]
            : "border-white/15 bg-transparent group-hover/beast:border-white/40"
        )}
      >
        <BeastKindIcon kind={kind} className="h-3 w-3" />
      </span>
    </button>
  );
}
