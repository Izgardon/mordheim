import type { ReactNode } from "react";

import { GameIcon, type GameIconName } from "@/components/ui/game-icons";
import { cn } from "@/lib/utils";

/**
 * A section's icon in its kind's colour, as its boxes' icons are (William, 25 Nov 2026): items
 * bronze, skills green, specials gold, spells blue; any other section the accent.
 */
const SECTION_COLOURS: Partial<Record<GameIconName, string>> = {
  items: "text-kind-item",
  skills: "text-kind-skill",
  specials: "text-kind-special",
  spells: "text-kind-spell",
};

export const sectionIconColour = (icon: GameIconName) =>
  SECTION_COLOURS[icon] ?? "text-accent-text";

/** A unit's section title (Items, Skills, Spells...) with its game icon, on the card and in Edit. */
export default function UnitSectionLabel({
  icon,
  children,
  className,
}: {
  icon: GameIconName;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-faint",
        className
      )}
    >
      <GameIcon name={icon} className={cn("h-4 w-4", sectionIconColour(icon))} />
      {children}
    </span>
  );
}
