import { useCallback, useMemo, useState } from "react";

import type { BountyClaimNotification } from "@/features/bounties/types";

export type BountyClaimSlice = {
  bountyClaimNotifications: BountyClaimNotification[];
  addBountyClaimNotification: (notification: BountyClaimNotification) => void;
  removeBountyClaimNotification: (notificationId: string) => void;
  clearBountyClaimNotifications: () => void;
};

/** The bell's claims on your bounties (one per claim, the newest replacing its older copy). */
export function useBountyClaimSlice(): BountyClaimSlice {
  const [items, setItems] = useState<BountyClaimNotification[]>([]);
  const add = useCallback((notification: BountyClaimNotification) => {
    setItems((prev) => [notification, ...prev.filter((entry) => entry.id !== notification.id)]);
  }, []);
  const remove = useCallback((notificationId: string) => {
    setItems((prev) => prev.filter((entry) => entry.id !== notificationId));
  }, []);
  const clear = useCallback(() => setItems([]), []);
  return useMemo(
    () => ({
      bountyClaimNotifications: items,
      addBountyClaimNotification: add,
      removeBountyClaimNotification: remove,
      clearBountyClaimNotifications: clear,
    }),
    [items, add, remove, clear]
  );
}
