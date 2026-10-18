import { useCallback } from "react";

import { purchaseLine } from "../api/purchase";

import type { Item } from "../types/item-types";
import type { PendingPurchase } from "@/features/warbands/utils/pending-purchases";
import type {
  AcquireItemDialogSharedParams,
  AcquireItemDialogState,
  AcquireItemMeta,
} from "./useAcquireItemDialogShared";
import { useAcquireItemDialogShared } from "./useAcquireItemDialogShared";

export type AcquireItemDialogUnitEditParams = Omit<
  AcquireItemDialogSharedParams,
  "enableHenchmenAutoQuantity"
> & {
  onPendingPurchaseAdd?: (purchase: PendingPurchase) => void;
  pendingPurchaseUnitId?: number | string;
};

type AcquireItemHandler = NonNullable<AcquireItemDialogSharedParams["onAcquire"]>;

const buildPendingPurchase = (
  item: Item,
  unitType: PendingPurchase["unitType"],
  unitId: string,
  meta: AcquireItemMeta
): PendingPurchase => ({
  unitType,
  unitId,
  itemId: item.id,
  itemName: item.name,
  quantity: Math.max(1, meta.quantity),
  unitPrice: Math.max(0, meta.unitPrice),
  isBuying: meta.isBuying,
  reason: meta.reason,
  line: meta.line ?? purchaseLine({ item, meta }),
});

export function useAcquireItemDialogUnitEdit(
  params: AcquireItemDialogUnitEditParams
): AcquireItemDialogState {
  const {
    onAcquire,
    onPendingPurchaseAdd,
    pendingPurchaseUnitId,
    deferCommit,
    presetUnitType,
    ...rest
  } = params;

  const handleAcquire = useCallback<AcquireItemHandler>(
    (item, unitType, unitId, meta) => {
      onAcquire?.(item, unitType, unitId, meta);

      if (!deferCommit) {
        return;
      }
      if (!meta || !onPendingPurchaseAdd) {
        return;
      }
      if (pendingPurchaseUnitId === undefined || pendingPurchaseUnitId === null) {
        return;
      }
      if (presetUnitType && unitType !== presetUnitType) {
        return;
      }
      if (String(pendingPurchaseUnitId) !== unitId) {
        return;
      }

      onPendingPurchaseAdd(
        buildPendingPurchase(item, unitType, String(pendingPurchaseUnitId), meta)
      );
    },
    [deferCommit, onAcquire, onPendingPurchaseAdd, pendingPurchaseUnitId, presetUnitType]
  );

  return useAcquireItemDialogShared({
    ...rest,
    deferCommit,
    presetUnitType,
    onAcquire: handleAcquire,
    enableHenchmenAutoQuantity: false,
  });
}
