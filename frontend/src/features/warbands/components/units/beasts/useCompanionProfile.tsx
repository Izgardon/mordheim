import { useState } from "react";

import CompanionProfileDialog from "./CompanionProfileDialog";
import { useCompanionSwitch } from "../../../hooks/units/useCompanionSwitch";

import type { UnitCompanionFields, UnitMount, UnitPet } from "../../../types/companion-types";
import type { UnitKindKey } from "../../../types/units";
import type { UnitKindConfig } from "../../../units/unit-kind-types";

export type CompanionProfileTarget =
  | { kind: "mount"; companion: UnitMount }
  | { kind: "pet"; companion: UnitPet };

/** The unit's switched-on mount or pet whose item is `itemId`, or null. */
export function companionOfItem(
  unit: UnitCompanionFields,
  itemId: number
): CompanionProfileTarget | null {
  if (unit.mount?.item_id === itemId) return { kind: "mount", companion: unit.mount };
  const pet = unit.pets?.find((entry) => entry.item_id === itemId);
  return pet ? { kind: "pet", companion: pet } : null;
}

/**
 * A mount's or pet's profile, opened from its chip or its switched-on item row (step 5): its
 * stats, entries and rider rating, with Switch off for editors.
 */
export function useCompanionProfile<K extends UnitKindKey>(
  kind: Pick<UnitKindConfig<K>, "key" | "listKey">,
  unit: { id: number; name: string | null },
  warbandId: number,
  canManageItems: boolean
) {
  const [shown, setShown] = useState<CompanionProfileTarget | null>(null);
  const companionSwitch = useCompanionSwitch(kind, warbandId);

  const switchOff = async (companion: UnitMount | UnitPet) => {
    const change = { unitId: unit.id, rowId: companion.item_row_id, on: false };
    await companionSwitch.mutateAsync({ ...change, name: companion.name });
    setShown(null);
  };

  const dialog = shown ? (
    <CompanionProfileDialog
      {...shown}
      unitName={unit.name || "This unit"}
      canSwitchOff={canManageItems}
      busy={companionSwitch.isPending}
      onSwitchOff={() => void switchOff(shown.companion).catch(() => undefined)}
      onClose={() => setShown(null)}
    />
  ) : null;

  return { open: setShown, dialog };
}
