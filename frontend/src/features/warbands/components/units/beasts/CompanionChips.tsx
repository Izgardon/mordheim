import { cn } from "@/lib/utils";
import { BEAST_KIND_TEXT, BeastKindIcon } from "@/features/bestiary/components/BeastKindIcon";
import { useCompanionProfile, type CompanionProfileTarget } from "./useCompanionProfile";
import { ridden } from "../../../utils/companions";

import type { Item } from "@/features/items/types/item-types";
import type { UnitCompanionFields, UnitMount } from "../../../types/companion-types";
import type { UnitKindKey } from "../../../types/units";
import type { UnitKindConfig } from "../../../units/unit-kind-types";

type CompanionUnit = UnitCompanionFields & {
  id: number;
  name: string | null;
  items?: Item[];
  henchmen?: unknown[];
};

type CompanionChipsProps<K extends UnitKindKey> = {
  kind: Pick<UnitKindConfig<K>, "key" | "listKey">;
  unit: CompanionUnit;
  warbandId: number;
  /** `manage_items`: the profile offers Switch off. */
  canManageItems: boolean;
  className?: string;
};

/**
 * The unit's mount and pets as chips under its name (the plan's unit-card mock). A chip opens the
 * beast's profile, with Switch off. A group shows how many of its mounts are ridden, one chip per
 * kind while it rides more than one (the server's `mounts`).
 */
export default function CompanionChips<K extends UnitKindKey>({
  kind,
  unit,
  warbandId,
  canManageItems,
  className,
}: CompanionChipsProps<K>) {
  const profile = useCompanionProfile(kind, unit, warbandId, canManageItems);
  const { mount, pets = [] } = unit;
  if (!mount && pets.length === 0) return null;
  const kinds = unit.henchmen && unit.mounts?.length ? unit.mounts : mount ? [mount] : [];
  // A group rides each kind once per copy switched on (another mount's copies aren't this one).
  const copies = (entry: UnitMount) => (unit.henchmen ? ridden(unit.items, entry.item_id) : 1);
  const chips: { target: CompanionProfileTarget; label: string; key: string }[] = [
    ...kinds.map((entry) => ({
      target: { kind: "mount" as const, companion: entry },
      key: `mount-${entry.item_row_id}`,
      label: copies(entry) > 1 ? `${entry.name} x ${copies(entry)}` : entry.name,
    })),
    ...pets.map((pet) => ({
      target: { kind: "pet" as const, companion: pet },
      key: `pet-${pet.item_row_id}`,
      label: pet.name,
    })),
  ];

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {chips.map(({ label, key, target }) => (
        <button
          key={key}
          type="button"
          aria-label={`${target.kind === "mount" ? "Mount" : "Pet"}: ${label}`}
          onClick={() => profile.open(target)}
          // The pill is its look; on a phone the box grows to a 44 px touch target around it.
          className="touch-target group/chip inline-flex items-center justify-center border-0 bg-transparent p-0"
        >
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border border-current/40 bg-black/20 px-2 py-0.5 text-xs transition-colors group-hover/chip:bg-black/40",
              BEAST_KIND_TEXT[target.kind]
            )}
          >
            <BeastKindIcon kind={target.kind} className="h-3 w-3" />
            {label}
          </span>
        </button>
      ))}
      {profile.dialog}
    </div>
  );
}
