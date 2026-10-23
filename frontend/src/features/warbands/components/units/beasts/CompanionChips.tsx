import { useState } from "react";

import { cn } from "@/lib/utils";
import { BEAST_KIND_TEXT, BeastKindIcon } from "@/features/bestiary/components/BeastKindIcon";
import CompanionProfileDialog from "./CompanionProfileDialog";
import { useCompanionSwitch } from "../../../hooks/units/useCompanionSwitch";
import { ridden } from "../../../utils/companions";

import type { Item } from "@/features/items/types/item-types";
import type { UnitCompanionFields, UnitMount, UnitPet } from "../../../types/companion-types";
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

type Open = { kind: "mount"; companion: UnitMount } | { kind: "pet"; companion: UnitPet };

/**
 * The unit's mount and pets as chips under its name (the plan's unit-card mock). A chip opens the
 * beast's profile, with Switch off. A group shows how many of its mounts are ridden.
 */
export default function CompanionChips<K extends UnitKindKey>({
  kind,
  unit,
  warbandId,
  canManageItems,
  className,
}: CompanionChipsProps<K>) {
  const [open, setOpen] = useState<Open | null>(null);
  const companionSwitch = useCompanionSwitch(kind, warbandId);
  const { mount, pets = [] } = unit;
  if (!mount && pets.length === 0) return null;
  // A group rides its mount once per copy switched on (another mount's copies aren't this one).
  const mounts = unit.henchmen && mount ? ridden(unit.items, mount.item_id) : 1;
  const mountChip = mount && {
    kind: "mount" as const,
    companion: mount,
    key: `mount-${mount.item_row_id}`,
    label: mounts > 1 ? `${mount.name} x ${mounts}` : mount.name,
  };
  const chips: (Open & { label: string; key: string })[] = [
    ...(mountChip ? [mountChip] : []),
    ...pets.map((pet) => ({
      kind: "pet" as const,
      companion: pet,
      key: `pet-${pet.item_row_id}`,
      label: pet.name,
    })),
  ];

  const switchOff = async (companion: UnitMount | UnitPet) => {
    const change = { unitId: unit.id, rowId: companion.item_row_id, on: false };
    await companionSwitch.mutateAsync({ ...change, name: companion.name });
    setOpen(null);
  };

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          aria-label={`${chip.kind === "mount" ? "Mount" : "Pet"}: ${chip.label}`}
          onClick={() => setOpen(chip)}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border border-current/40 bg-black/20 px-2 py-0.5 text-xs transition-colors hover:bg-black/40",
            BEAST_KIND_TEXT[chip.kind]
          )}
        >
          <BeastKindIcon kind={chip.kind} className="h-3 w-3" />
          {chip.label}
        </button>
      ))}
      {open ? (
        <CompanionProfileDialog
          {...open}
          unitName={unit.name || "This unit"}
          canSwitchOff={canManageItems}
          busy={companionSwitch.isPending}
          onSwitchOff={() => void switchOff(open.companion).catch(() => undefined)}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </div>
  );
}
