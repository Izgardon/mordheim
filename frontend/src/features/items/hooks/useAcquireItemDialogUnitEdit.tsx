import { useCallback } from "react";

import type { PendingPurchase } from "@/features/warbands/utils/pending-purchases";
import type {
  AcquireItemDialogSharedParams,
  AcquireItemDialogState,
  AcquireItemMeta,
} from "./useAcquireItemDialogShared";
import { useAcquireItemDialogShared } from "./useAcquireItemDialogShared";

export type AcquireItemDialogUnitEditParams = Omit<AcquireItemDialogSharedParams, "enableHenchmenAutoQuantity"> & {
  onPendingPurchaseAdd?: (purchase: PendingPurchase) => void;
  pendingPurchaseUnitId?: number | string;
};

type AcquireItemHandler = NonNullable<AcquireItemDialogSharedParams["onAcquire"]>;

const buildPendingPurchase = (
  itemId: number,
  itemName: string,
  unitType: PendingPurchase["unitType"],
  unitId: string,
  meta: AcquireItemMeta
): PendingPurchase => ({
  unitType,
  unitId,
  itemId,
  itemName,
  quantity: Math.max(1, meta.quantity),
  unitPrice: Math.max(0, meta.unitPrice),
  isBuying: meta.isBuying,
  reason: meta.reason,
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
        buildPendingPurchase(item.id, item.name, unitType, String(pendingPurchaseUnitId), meta)
      );
    },
    [
      deferCommit,
      onAcquire,
      onPendingPurchaseAdd,
      pendingPurchaseUnitId,
      presetUnitType,
    ]
  );

  return useAcquireItemDialogShared({
    ...rest,
    deferCommit,
    presetUnitType,
    onAcquire: handleAcquire,
    enableHenchmenAutoQuantity: false,
  });
}
