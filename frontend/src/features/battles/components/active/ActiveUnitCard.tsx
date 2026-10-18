import { useState } from "react";
import { ChevronDown } from "lucide-react";

import scull2Icon from "@/assets/icons/Scull2.webp";

import type { BattleUnitInformationEntry } from "@/features/battles/types/battle-types";
import {
  type PrebattleUnit,
  type UnitSingleUseItem,
  type UnitOverride,
} from "@/features/battles/components/prebattle/prebattle-types";
import UnitStatsTable from "@/features/warbands/components/shared/unit_details/UnitStatsTable";
import "@/features/warbands/styles/warband.css";
import { getBattleCardThemeStyle } from "@/features/battles/components/shared/battle-card-theme";
import { getErrorMessage } from "@/lib/get-error-message";

import ActiveKillDialog from "./ActiveKillDialog";
import ActiveUnitExpandedDetails from "./ActiveUnitExpandedDetails";
import { ActiveUnitActions } from "./ActiveUnitControls";
import {
  getCurrentUnitWounds,
  getEffectiveUnitStats,
  type ActiveBattleUnitOption,
} from "./active-utils";

type ActiveUnitCardProps = {
  unit: PrebattleUnit;
  unitInformation?: BattleUnitInformationEntry;
  canInteract: boolean;
  killTargetOptions: ActiveBattleUnitOption[];
  onSetOutOfAction: (unitKey: string, outOfAction: boolean) => Promise<void>;
  onAdjustWounds: (unit: PrebattleUnit, delta: number) => Promise<void>;
  /**
   * Not read: no stat-override editor is rendered since ActiveUnitStatEditor was unmounted.
   * Kept (callers still pass it) pending a decision on whether to restore that editor.
   */
  onSaveOverride: (unitKey: string, override: UnitOverride | undefined) => Promise<void>;
  onSaveUnitNotes: (unitKey: string, notes: string) => Promise<void>;
  onRecordKill: (payload: {
    killerUnitKey: string;
    victimUnitKey?: string;
    victimName?: string;
    notes?: string;
    earnedXp: boolean;
  }) => Promise<void>;
  onUseSingleUseItem: (unit: PrebattleUnit, item: UnitSingleUseItem) => Promise<void>;
  getUsedSingleUseItemCount: (unitKey: string, itemId: number) => number;
  onUndoSingleUseItem?: (unit: PrebattleUnit, itemId: number) => Promise<void>;
  activeItemActionKey: string | null;
  isSavingUnitConfig?: boolean;
};

/** The skull over a unit out of action; yours brings it back in action. */
function OutOfActionOverlay({
  name,
  canInteract,
  disabled,
  onBackInAction,
}: {
  name: string;
  canInteract: boolean;
  disabled: boolean;
  onBackInAction: () => void;
}) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/65">
      {canInteract ? (
        <button
          type="button"
          className="icon-button flex h-14 w-14 items-center justify-center rounded-full border-none bg-transparent text-[#d6c8aa] shadow-none transition hover:bg-transparent hover:text-foreground"
          onClick={onBackInAction}
          disabled={disabled}
          aria-label={`Set ${name} back in action`}
        >
          <img src={scull2Icon} alt="" className="h-10 w-10 object-contain" />
        </button>
      ) : (
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-transparent text-[#d6c8aa]">
          <img src={scull2Icon} alt="" className="h-10 w-10 object-contain" />
        </div>
      )}
    </div>
  );
}

export default function ActiveUnitCard({
  unit,
  unitInformation,
  canInteract,
  killTargetOptions,
  onSetOutOfAction,
  onAdjustWounds,
  onSaveUnitNotes,
  onRecordKill,
  onUseSingleUseItem,
  getUsedSingleUseItemCount,
  onUndoSingleUseItem,
  activeItemActionKey,
  isSavingUnitConfig = false,
}: ActiveUnitCardProps) {
  const [isKillDialogOpen, setIsKillDialogOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isUpdatingOutOfAction, setIsUpdatingOutOfAction] = useState(false);
  const [error, setError] = useState("");

  const outOfAction = Boolean(unitInformation?.out_of_action);
  const name = unit.displayName;
  const canAct = canInteract && !outOfAction && !isSavingUnitConfig;

  const handleSetOutOfAction = async (nextOutOfAction: boolean) => {
    if (!canInteract || isUpdatingOutOfAction) {
      return;
    }
    setIsUpdatingOutOfAction(true);
    setError("");
    try {
      await onSetOutOfAction(unit.key, nextOutOfAction);
    } catch (errorResponse) {
      setError(getErrorMessage(errorResponse, "Unable to update unit state"));
    } finally {
      setIsUpdatingOutOfAction(false);
    }
  };

  const actions = (
    <ActiveUnitActions
      name={name}
      woundsValue={getCurrentUnitWounds(unit, unitInformation)}
      killCount={unitInformation?.kill_count ?? 0}
      canAct={canAct}
      outOfActionDisabled={!canAct || isUpdatingOutOfAction}
      onAdjustWounds={(delta) => void onAdjustWounds(unit, delta)}
      onSetOutOfAction={() => void handleSetOutOfAction(true)}
      onRecordKill={() => setIsKillDialogOpen(true)}
    />
  );

  return (
    <div className="battle-card" style={getBattleCardThemeStyle(unit.kind)}>
      <div className="p-3">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,12rem)_1fr_auto] md:items-center md:gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-2 md:block">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{name}</p>
                <p className="text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground">
                  {unit.unitType}
                </p>
              </div>
              <div className="ml-auto md:hidden">{actions}</div>
            </div>
          </div>

          <div className="battle-stats-shell w-full md:max-w-[34rem] md:justify-self-start">
            <UnitStatsTable
              stats={getEffectiveUnitStats(unit, unitInformation)}
              variant="summary"
              wrapperClassName="w-full max-w-none"
            />
          </div>

          <div className="hidden md:block">{actions}</div>
        </div>

        {error ? <p className="mt-2 text-xs text-red-500">{error}</p> : null}
      </div>

      <button
        type="button"
        className="flex h-11 w-full items-center justify-center border-t border-border/30 bg-black/25 text-muted-foreground transition hover:text-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={`Details for ${name}`}
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded((prev) => !prev)}
        disabled={outOfAction}
      >
        <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
      </button>

      {isExpanded ? (
        <ActiveUnitExpandedDetails
          unit={unit}
          unitInformation={unitInformation}
          canInteract={canInteract}
          onSaveNotes={(notes) => onSaveUnitNotes(unit.key, notes)}
          onUseSingleUseItem={(item) =>
            onUseSingleUseItem(unit, { id: item.id, name: item.name, quantity: item.count })
          }
          getUsedSingleUseItemCount={(itemId) => getUsedSingleUseItemCount(unit.key, itemId)}
          onUndoSingleUseItem={
            onUndoSingleUseItem ? (itemId) => onUndoSingleUseItem(unit, itemId) : undefined
          }
          activeItemActionKey={activeItemActionKey}
        />
      ) : null}

      {outOfAction ? (
        <OutOfActionOverlay
          name={name}
          canInteract={canInteract}
          disabled={isUpdatingOutOfAction}
          onBackInAction={() => void handleSetOutOfAction(false)}
        />
      ) : null}

      <ActiveKillDialog
        open={isKillDialogOpen}
        onOpenChange={setIsKillDialogOpen}
        killerName={name}
        killerUnitKey={unit.key}
        showEarnedXpOption={unit.kind !== "custom"}
        defaultEarnedXp={unit.kind !== "henchman"}
        options={killTargetOptions}
        onConfirm={({ victimUnitKey, victimName, notes, earnedXp }) =>
          onRecordKill({ killerUnitKey: unit.key, victimUnitKey, victimName, notes, earnedXp })
        }
      />
    </div>
  );
}
