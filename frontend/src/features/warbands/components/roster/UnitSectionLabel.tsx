import type { ReactNode } from "react";

import { GameIcon, type GameIconName } from "@/components/ui/game-icons";
import { cn } from "@/lib/utils";

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
      <GameIcon name={icon} className="h-4 w-4 text-accent-text" />
      {children}
    </span>
  );
}
