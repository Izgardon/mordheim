import { cn } from "@/lib/utils";
import { BEAST_KIND_TEXT, BeastKindIcon } from "@/features/bestiary/components/BeastKindIcon";

import type { BeastKind } from "@/features/bestiary/bestiary-kinds";

const NAMES: Record<BeastKind, string> = { mount: "Mount", pet: "Pet", creature: "Creature" };

/**
 * A beast's mark beside a unit's name, named for screen readers: the paw on a creature group, the
 * horseshoe on a rider ("Rides Warhorse" when `title` says so).
 */
export default function CreatureMark({
  kind = "creature",
  title,
  className,
}: {
  kind?: BeastKind;
  title?: string;
  className?: string;
}) {
  const name = title ?? NAMES[kind];
  return (
    <span
      role="img"
      aria-label={name}
      title={name}
      className={cn("inline-flex shrink-0", BEAST_KIND_TEXT[kind], className)}
    >
      <BeastKindIcon kind={kind} className="h-4 w-4" />
    </span>
  );
}
