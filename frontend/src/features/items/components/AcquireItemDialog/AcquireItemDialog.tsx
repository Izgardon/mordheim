import type { ReactNode } from "react";

import AcquireItemDialogContent from "./AcquireItemDialogContent";
import type { AcquireItemMeta } from "../../hooks/useAcquireItemDialogShared";
import {
  useAcquireItemDialogItemsPage,
  type AcquireItemDialogItemsPageParams,
} from "../../hooks/useAcquireItemDialogItemsPage";
import {
  useAcquireItemDialogBuyAgain,
  type AcquireItemDialogBuyAgainParams,
} from "../../hooks/useAcquireItemDialogBuyAgain";
import {
  useAcquireItemDialogUnitEdit,
  type AcquireItemDialogUnitEditParams,
} from "../../hooks/useAcquireItemDialogUnitEdit";

import type { Item } from "../../types/item-types";
import type { UnitTypeOption } from "@components/unit-selection-section";
import type { PendingPurchase } from "@/features/warbands/utils/pending-purchases";

type AcquireItemDialogProps = {
  item: Item;
  initialAvailabilityId?: number | null;
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
    meta?: AcquireItemMeta
  ) => void;
  emitWarbandUpdate?: boolean;
  deferCommit?: boolean;
  reservedGold?: number;
  onPendingPurchaseAdd?: (purchase: PendingPurchase) => void;
  pendingPurchaseUnitId?: number | string;
};

export default function AcquireItemDialog({
  item,
  initialAvailabilityId,
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
    initialAvailabilityId,
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

  // One component per variant, so each variant's hooks always run in the same order.
  if (variant === "buy-again") {
    return <BuyAgainAcquireItemDialog {...baseParams} />;
  }

  if (variant === "unit-edit") {
    return (
      <UnitEditAcquireItemDialog
        {...baseParams}
        onPendingPurchaseAdd={onPendingPurchaseAdd}
        pendingPurchaseUnitId={pendingPurchaseUnitId}
      />
    );
  }

  return <ItemsPageAcquireItemDialog {...baseParams} />;
}

function BuyAgainAcquireItemDialog(params: AcquireItemDialogBuyAgainParams) {
  const state = useAcquireItemDialogBuyAgain(params);
  return <AcquireItemDialogContent item={params.item} {...state} />;
}

function UnitEditAcquireItemDialog(params: AcquireItemDialogUnitEditParams) {
  const state = useAcquireItemDialogUnitEdit(params);
  return <AcquireItemDialogContent item={params.item} {...state} />;
}

function ItemsPageAcquireItemDialog(params: AcquireItemDialogItemsPageParams) {
  const state = useAcquireItemDialogItemsPage(params);
  return <AcquireItemDialogContent item={params.item} {...state} />;
}
