import type { AcquireItemDialogSharedParams, AcquireItemDialogState } from "./useAcquireItemDialogShared";
import { useAcquireItemDialogShared } from "./useAcquireItemDialogShared";

export type AcquireItemDialogItemsPageParams = Omit<AcquireItemDialogSharedParams, "enableHenchmenAutoQuantity">;

export function useAcquireItemDialogItemsPage(
  params: AcquireItemDialogItemsPageParams
): AcquireItemDialogState {
  return useAcquireItemDialogShared({
    ...params,
    enableHenchmenAutoQuantity: false,
  });
}
