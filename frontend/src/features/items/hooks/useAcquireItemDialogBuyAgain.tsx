import type { AcquireItemDialogSharedParams, AcquireItemDialogState } from "./useAcquireItemDialogShared";
import { useAcquireItemDialogShared } from "./useAcquireItemDialogShared";

export type AcquireItemDialogBuyAgainParams = Omit<AcquireItemDialogSharedParams, "enableHenchmenAutoQuantity">;

export function useAcquireItemDialogBuyAgain(
  params: AcquireItemDialogBuyAgainParams
): AcquireItemDialogState {
  return useAcquireItemDialogShared({
    ...params,
    enableHenchmenAutoQuantity: true,
  });
}
