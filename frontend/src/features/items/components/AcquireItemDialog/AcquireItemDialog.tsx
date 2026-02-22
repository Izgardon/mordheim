import type { ReactNode } from "react";

import AcquireItemDialogContent from "./AcquireItemDialogContent";
import type { AcquireItemDialogState } from "../../hooks/useAcquireItemDialogShared";
import { useAcquireItemDialogItemsPage } from "../../hooks/useAcquireItemDialogItemsPage";
import { useAcquireItemDialogBuyAgain } from "../../hooks/useAcquireItemDialogBuyAgain";
import { useAcquireItemDialogUnitEdit } from "../../hooks/useAcquireItemDialogUnitEdit";

import type { Item } from "../../types/item-types";
import type { UnitTypeOption } from "@components/unit-selection-section";
import type { PendingPurchase } from "@/features/warbands/utils/pending-purchases";

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
  variant?: "items" | "buy-again" | "unit-edit";
  onAcquire?: (
    item: Item,
    unitType: UnitTypeOption,
    unitId: string,
    meta?: { isBuying: boolean; quantity: number; unitPrice: number; totalPrice: number; reason: string }
  ) => void;
  emitWarbandUpdate?: boolean;
  deferCommit?: boolean;
  reservedGold?: number;
  onPendingPurchaseAdd?: (purchase: PendingPurchase) => void;
  pendingPurchaseUnitId?: number | string;
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
  variant = "items",
  onAcquire,
  emitWarbandUpdate = true,
  deferCommit = false,
  reservedGold = 0,
  onPendingPurchaseAdd,
  pendingPurchaseUnitId,
}: AcquireItemDialogProps) {
  const baseParams = {
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
  };

  const state: AcquireItemDialogState =
    variant === "buy-again"
      ? useAcquireItemDialogBuyAgain(baseParams)
      : variant === "unit-edit"
        ? useAcquireItemDialogUnitEdit({
            ...baseParams,
            onPendingPurchaseAdd,
            pendingPurchaseUnitId,
          })
        : useAcquireItemDialogItemsPage(baseParams);

  return <AcquireItemDialogContent item={item} {...state} />;
}
