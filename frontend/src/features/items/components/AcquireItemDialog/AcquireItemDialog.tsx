import type { ReactNode } from "react";

import AcquireItemDialogContent from "./AcquireItemDialogContent";
import { useAcquireItemDialogState, type AcquireItemDialogState } from "./useAcquireItemDialogState";

import type { Item } from "../../types/item-types";
import type { UnitTypeOption } from "@components/unit-selection-section";

type AcquireItemDialogProps = {
  item: Item;
  trigger?: ReactNode | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  presetUnitType?: UnitTypeOption;
  presetUnitId?: number | string;
  draftUnit?: { unitType: UnitTypeOption; id: string; name?: string | null; unit_type?: string | null };
  disableUnitSelection?: boolean;
  defaultUnitSectionCollapsed?: boolean;
  defaultRaritySectionCollapsed?: boolean;
  defaultPriceSectionCollapsed?: boolean;
  onAcquire?: (
    item: Item,
    unitType: UnitTypeOption,
    unitId: string,
    meta?: { isBuying: boolean; quantity: number; unitPrice: number; totalPrice: number; reason: string }
  ) => void;
  emitWarbandUpdate?: boolean;
  deferCommit?: boolean;
  reservedGold?: number;
};

export default function AcquireItemDialog({
  item,
  trigger,
  open: openProp,
  onOpenChange,
  presetUnitType,
  presetUnitId,
  draftUnit,
  disableUnitSelection = false,
  defaultUnitSectionCollapsed,
  defaultRaritySectionCollapsed,
  defaultPriceSectionCollapsed,
  onAcquire,
  emitWarbandUpdate = true,
  deferCommit = false,
  reservedGold = 0,
}: AcquireItemDialogProps) {
  const state: AcquireItemDialogState = useAcquireItemDialogState({
    item,
    trigger,
    open: openProp,
    onOpenChange,
    presetUnitType,
    presetUnitId,
    draftUnit,
    disableUnitSelection,
    defaultUnitSectionCollapsed,
    defaultRaritySectionCollapsed,
    defaultPriceSectionCollapsed,
    onAcquire,
    emitWarbandUpdate,
    deferCommit,
    reservedGold,
  });

  return <AcquireItemDialogContent item={item} {...state} />;
}
