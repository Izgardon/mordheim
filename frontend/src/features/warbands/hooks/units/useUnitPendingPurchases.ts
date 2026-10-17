import { useCallback, useMemo, useState } from "react";

import { removePendingPurchase, type PendingPurchase } from "../../utils/pending-purchases";

import type { UnitTypeOption } from "@components/unit-selection-section";
import type { UnitForm, UnitKindKey } from "../../types/units";
import type { UnitKindConfig } from "../../units/unit-kind-types";

/** Item purchases queued in edit mode, committed on Save (one trade and log each). */
export function useUnitPendingPurchases<K extends UnitKindKey>(
  kind: UnitKindConfig<K>,
  forms: UnitForm<K>[]
) {
  const [pendingPurchases, setPendingPurchases] = useState<PendingPurchase[]>([]);

  const pendingChanges = useMemo(
    () => kind.editor.buildPendingChanges(pendingPurchases, forms),
    [forms, kind, pendingPurchases]
  );
  const pendingSpend = useMemo(
    () => pendingChanges.reduce((sum, change) => sum + change.amount, 0),
    [pendingChanges]
  );

  const addPendingPurchase = useCallback((purchase: PendingPurchase) => {
    setPendingPurchases((prev) => [...prev, purchase]);
  }, []);

  const removePendingPurchaseFor = useCallback(
    (match: { unitType: UnitTypeOption; unitId: string; itemId: number }) => {
      setPendingPurchases((prev) => removePendingPurchase(prev, match));
    },
    []
  );

  /** A dismissed unit takes its queued purchases with it. */
  const dropUnitPurchases = useCallback((unitId: number) => {
    setPendingPurchases((prev) => prev.filter((entry) => entry.unitId !== String(unitId)));
  }, []);

  return {
    pendingPurchases,
    setPendingPurchases,
    pendingChanges,
    pendingSpend,
    addPendingPurchase,
    removePendingPurchase: removePendingPurchaseFor,
    dropUnitPurchases,
  };
}
