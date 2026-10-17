import { useCallback, useMemo, useState } from "react";

import { removePendingPurchase, type PendingPurchase } from "../../utils/pending-purchases";

import type { UnitTypeOption } from "@components/unit-selection-section";
import type { UnitForm, UnitKindKey } from "../../types/units";
import type { UnitKindConfig } from "../../units/unit-kind-types";

/**
 * What Save will spend: item purchases queued in edit mode (one trade and log each) and the
 * recruits queued in the section (charged by the batch).
 */
export function useUnitPendingPurchases<K extends UnitKindKey>(
  kind: UnitKindConfig<K>,
  forms: UnitForm<K>[]
) {
  const [pendingPurchases, setPendingPurchases] = useState<PendingPurchase[]>([]);

  const pendingChanges = useMemo(
    () => [
      ...forms
        .filter((form) => !form.id)
        .map((form) => {
          const cost = kind.editor.creation.recruitCost(form);
          return {
            label: `${form.name.trim() || kind.labels.newUnit} (recruit)`,
            category: "recruit" as const,
            quantity: 1,
            unitCost: cost,
            amount: cost,
          };
        }),
      ...kind.editor.buildPendingChanges(pendingPurchases, forms),
    ],
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

  /** A dismissed unit or dropped recruit takes its queued purchases with it. */
  const dropUnitPurchases = useCallback((unitKey: number | string) => {
    setPendingPurchases((prev) => prev.filter((entry) => entry.unitId !== String(unitKey)));
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
