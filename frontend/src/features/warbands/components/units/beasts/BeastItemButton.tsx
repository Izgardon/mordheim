import type { MouseEvent } from "react";

import { cn } from "@/lib/utils";
import { BEAST_KIND_TEXT, BeastKindIcon } from "@/features/bestiary/components/BeastKindIcon";

import type { BeastKind } from "@/features/bestiary/bestiary-kinds";

/** What the button does, as its title says it: switch a mount or pet on or off, recruit a creature. */
export function beastActionLabel(kind: BeastKind, on: boolean) {
  if (kind === "creature") return "Recruit as henchmen";
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
  disabled?: boolean;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
};

/**
 * The button beside an Animal item's menu (the plan's mock): a switch for a mount or a pet, filled
 * when on, and a recruit button for a creature. Its title says what a tap does.
 */
export default function BeastItemButton({
  kind,
  on,
  itemLabel,
  disabled = false,
  onClick,
}: BeastItemButtonProps) {
  const action = beastActionLabel(kind, on);
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
        "flex h-5 w-5 flex-shrink-0 cursor-pointer items-center justify-center rounded border p-0 transition-colors duration-150 disabled:cursor-wait disabled:opacity-50",
        BEAST_KIND_TEXT[kind],
        isSwitch && on ? ON_CLASS[kind] : "border-white/15 bg-transparent hover:border-white/40"
      )}
    >
      <BeastKindIcon kind={kind} className="h-3 w-3" />
    </button>
  );
}
