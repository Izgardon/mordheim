import { useEffect, useState } from "react";

import BattleUnitStatsAndItems from "@/features/battles/components/shared/BattleUnitStatsAndItems";
import type { BattleUnitInformationEntry } from "@/features/battles/types/battle-types";
import type {
  PrebattleUnit,
  StatKey,
  UnitOverride,
} from "@/features/battles/components/prebattle/prebattle-types";
import {
  toArmourSaveStat,
  toNumericStat,
} from "@/features/battles/components/prebattle/prebattle-utils";

import { normalizeUnitOverride, unitInformationToOverride } from "./active-utils";

type ActiveUnitStatEditorProps = {
  unit: PrebattleUnit;
  unitInformation?: BattleUnitInformationEntry;
  editable: boolean;
  onSaveOverride: (unitKey: string, override: UnitOverride | undefined) => Promise<void>;
  isSaving: boolean;
};

function normalizeDraft(
  unit: PrebattleUnit,
  override: UnitOverride | undefined
): UnitOverride | undefined {
  return normalizeUnitOverride(unit, override);
}

export default function ActiveUnitStatEditor({
  unit,
  unitInformation,
  editable,
  onSaveOverride,
  isSaving,
}: ActiveUnitStatEditorProps) {
  const sourceOverride = unitInformationToOverride(unitInformation);
  const [draftOverride, setDraftOverride] = useState<UnitOverride | undefined>(sourceOverride);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setDraftOverride(sourceOverride);
  }, [JSON.stringify(sourceOverride?.stats ?? {}), unit.key]);

  useEffect(() => {
    if (!editable) {
      setIsEditing(false);
    }
  }, [editable]);

  const updateDraft = (nextOverride: UnitOverride | undefined) => {
    setDraftOverride(normalizeDraft(unit, nextOverride));
  };

  const handleUpdateStat = (key: StatKey, value: string) => {
    const current = draftOverride ?? { stats: {} };
    const nextStats = { ...current.stats };

    if (key === "armour_save") {
      const nextValue = value.trim() === "" ? null : toArmourSaveStat(value);
      if (nextValue === null) {
        delete nextStats.armour_save;
      } else {
        nextStats.armour_save = nextValue;
      }
    } else {
      const nextValue = value.trim() === "" ? undefined : toNumericStat(value);
      if (nextValue === undefined) {
        delete nextStats[key];
      } else {
        nextStats[key] = nextValue;
      }
    }

    updateDraft({ stats: nextStats });
  };

  const handleResetOverride = () => {
    setDraftOverride(undefined);
  };

  const handleApply = async () => {
    setError("");
    try {
      await onSaveOverride(unit.key, draftOverride);
      setIsEditing(false);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setError(errorResponse.message || "Unable to save stat changes");
      } else {
        setError("Unable to save stat changes");
      }
    }
  };

  return (
    <div className="mb-3">
      <BattleUnitStatsAndItems
        unitKey={unit.key}
        baseStats={unit.stats}
        override={draftOverride}
        editable={editable}
        isEditing={isEditing}
        onToggleEditing={() => setIsEditing((prev) => !prev)}
        onUpdateStat={handleUpdateStat}
        onResetOverride={handleResetOverride}
        notes=""
        onApplyStatChanges={() => void handleApply()}
        isApplyingStatChanges={isSaving}
        singleUseItems={[]}
        canUseItems={false}
        onUseItem={() => undefined}
        getUsedItemCount={() => 0}
        activeItemActionKey={null}
        showItemSection={false}
      />
      {error ? <p className="mt-2 text-xs text-red-500">{error}</p> : null}
    </div>
  );
}
