import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";

import { getPendingSpend, removePendingPurchase, type PendingPurchase } from "../../utils/pending-purchases";
import type { UnitTypeOption } from "@components/unit-selection-section";
import type { Warband, WarbandUpdatePayload } from "../../types/warband-types";

type PendingEditFocus = { heroId: number; tab: "skills" | "spells" | "special" };

type UseWarbandEditStateReturn = {
  isEditing: boolean;
  setIsEditing: (value: boolean) => void;
  isLoadingHeroDetails: boolean;
  setIsLoadingHeroDetails: (value: boolean) => void;
  warbandForm: WarbandUpdatePayload;
  setWarbandForm: Dispatch<SetStateAction<WarbandUpdatePayload>>;
  heroPendingPurchases: PendingPurchase[];
  setHeroPendingPurchases: Dispatch<SetStateAction<PendingPurchase[]>>;
  pendingEditFocus: PendingEditFocus | null;
  setPendingEditFocus: (focus: PendingEditFocus | null) => void;
  heroPendingSpend: number;
  handleHeroPendingPurchaseAdd: (purchase: PendingPurchase) => void;
  handleHeroPendingPurchaseRemove: (match: {
    unitType: UnitTypeOption;
    unitId: string;
    itemId: number;
  }) => void;
};

export function useWarbandEditState(warband: Warband | null): UseWarbandEditStateReturn {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoadingHeroDetails, setIsLoadingHeroDetails] = useState(false);
  const [warbandForm, setWarbandForm] = useState<WarbandUpdatePayload>({ name: "", faction: "" });
  const [heroPendingPurchases, setHeroPendingPurchases] = useState<PendingPurchase[]>([]);
  const [pendingEditFocus, setPendingEditFocus] = useState<PendingEditFocus | null>(null);

  useEffect(() => {
    if (warband && !isEditing) {
      setWarbandForm({ name: warband.name, faction: warband.faction });
    }
  }, [warband, isEditing]);

  const heroPendingSpend = useMemo(
    () => getPendingSpend(heroPendingPurchases),
    [heroPendingPurchases]
  );

  const handleHeroPendingPurchaseAdd = useCallback((purchase: PendingPurchase) => {
    setHeroPendingPurchases((prev) => [...prev, purchase]);
  }, []);

  const handleHeroPendingPurchaseRemove = useCallback(
    (match: { unitType: UnitTypeOption; unitId: string; itemId: number }) => {
      setHeroPendingPurchases((prev) => removePendingPurchase(prev, match));
    },
    []
  );

  return {
    isEditing,
    setIsEditing,
    isLoadingHeroDetails,
    setIsLoadingHeroDetails,
    warbandForm,
    setWarbandForm,
    heroPendingPurchases,
    setHeroPendingPurchases,
    pendingEditFocus,
    setPendingEditFocus,
    heroPendingSpend,
    handleHeroPendingPurchaseAdd,
    handleHeroPendingPurchaseRemove,
  };
}
