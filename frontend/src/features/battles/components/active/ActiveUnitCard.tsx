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

import ActiveKillDialog from "./ActiveKillDialog";
import ActiveUnitExpandedDetails from "./ActiveUnitExpandedDetails";
import { KillTrophyIcon, OutOfActionIcon } from "./ActiveBattleActionIcons";
import { getEffectiveUnitStats, type ActiveBattleUnitOption } from "./active-utils";

const META_LABEL_CLASS =
  "text-center text-[0.5rem] uppercase tracking-[0.16em] text-muted-foreground";
const DANGER_ACTION_BUTTON_CLASS =
  "battle-toolbar-button icon-button flex h-8 w-8 items-center justify-center rounded-md text-red-400/85 transition hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50";
const DANGER_KILL_BUTTON_CLASS =
  "battle-toolbar-button icon-button inline-flex h-8 items-center gap-1 rounded-md px-1.5 text-red-400/85 transition hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50";

type ActiveUnitCardProps = {
  unit: PrebattleUnit;
  unitInformation?: BattleUnitInformationEntry;
  canInteract: boolean;
  killTargetOptions: ActiveBattleUnitOption[];
  onSetOutOfAction: (unitKey: string, outOfAction: boolean) => Promise<void>;
  onAdjustWounds: (unit: PrebattleUnit, delta: number) => Promise<void>;
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
  activeItemActionKey: string | null;
  isSavingUnitConfig?: boolean;
};

export default function ActiveUnitCard({
  unit,
  unitInformation,
  canInteract,
  killTargetOptions,
  onSetOutOfAction,
  onAdjustWounds,
  onSaveOverride,
  onSaveUnitNotes,
  onRecordKill,
  onUseSingleUseItem,
  getUsedSingleUseItemCount,
  activeItemActionKey,
  isSavingUnitConfig = false,
}: ActiveUnitCardProps) {
  const [isKillDialogOpen, setIsKillDialogOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isUpdatingOutOfAction, setIsUpdatingOutOfAction] = useState(false);
  const [error, setError] = useState("");

  const outOfAction = Boolean(unitInformation?.out_of_action);
  const killCount = unitInformation?.kill_count ?? 0;
  const unitStats = getEffectiveUnitStats(unit, unitInformation);
  const woundsValue = unitStats.wounds ?? 0;
  const themeStyle = getBattleCardThemeStyle(unit.kind);

  const handleSetOutOfAction = async (nextOutOfAction: boolean) => {
    if (!canInteract || isUpdatingOutOfAction) {
      return;
    }
    setIsUpdatingOutOfAction(true);
    setError("");
    try {
      await onSetOutOfAction(unit.key, nextOutOfAction);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setError(errorResponse.message || "Unable to update unit state");
      } else {
        setError("Unable to update unit state");
      }
    } finally {
      setIsUpdatingOutOfAction(false);
    }
  };

  return (
    <div className="battle-card" style={themeStyle}>
      <div className="p-3">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,12rem)_1fr_auto] md:items-center md:gap-3">
          <div className="min-w-0">
            <div className="flex items-start justify-between gap-2 md:block">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{unit.displayName}</p>
                <p className="text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground">
                  {unit.unitType}
                </p>
              </div>
              <div className="md:hidden">
                <div className="flex items-center gap-2">
                  <div className="space-y-1">
                    <p className={META_LABEL_CLASS}>Wounds</p>
                    <div className="battle-metric-box inline-flex items-center overflow-hidden rounded-md">
                      <button
                        type="button"
                        className="icon-button flex h-8 w-8 items-center justify-center text-sm text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => void onAdjustWounds(unit, -1)}
                        disabled={!canInteract || outOfAction || isSavingUnitConfig || woundsValue <= 0}
                        aria-label="Decrease wounds"
                      >
                        -
                      </button>
                      <div className="flex h-8 min-w-9 items-center justify-center border-x border-border/50 px-2 text-xs font-semibold text-foreground">
                        {woundsValue}
                      </div>
                      <button
                        type="button"
                        className="icon-button flex h-8 w-8 items-center justify-center text-sm text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => void onAdjustWounds(unit, 1)}
                        disabled={!canInteract || outOfAction || isSavingUnitConfig}
                        aria-label="Increase wounds"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="space-y-1">
                      <p className={META_LABEL_CLASS}>OOA</p>
                      <button
                        type="button"
                        className={DANGER_ACTION_BUTTON_CLASS}
                        onClick={() => void handleSetOutOfAction(true)}
                        disabled={!canInteract || outOfAction || isUpdatingOutOfAction || isSavingUnitConfig}
                        aria-label="Set unit out of action"
                      >
                        <OutOfActionIcon className="h-5 w-5 text-red-400" />
                      </button>
                    </div>
                    <div className="space-y-1">
                      <p className={META_LABEL_CLASS}>Kills</p>
                      <button
                        type="button"
                        className={DANGER_KILL_BUTTON_CLASS}
                        onClick={() => setIsKillDialogOpen(true)}
                        disabled={!canInteract || outOfAction || isSavingUnitConfig}
                        aria-label="Record kill"
                      >
                        <KillTrophyIcon className="h-5 w-5" />
                        <span className="text-xs font-semibold">{killCount}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="battle-stats-shell w-full md:max-w-[34rem] md:justify-self-start">
            <UnitStatsTable stats={unitStats} variant="summary" wrapperClassName="w-full max-w-none" />
          </div>

          <div className="hidden md:block">
            <div className="flex items-center gap-2">
              <div className="space-y-1">
                <p className={META_LABEL_CLASS}>Wounds</p>
                <div className="battle-metric-box inline-flex items-center overflow-hidden rounded-md">
                  <button
                    type="button"
                    className="icon-button flex h-8 w-8 items-center justify-center text-sm text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => void onAdjustWounds(unit, -1)}
                    disabled={!canInteract || outOfAction || isSavingUnitConfig || woundsValue <= 0}
                    aria-label="Decrease wounds"
                  >
                    -
                  </button>
                  <div className="flex h-8 min-w-9 items-center justify-center border-x border-border/50 px-2 text-xs font-semibold text-foreground">
                    {woundsValue}
                  </div>
                  <button
                    type="button"
                    className="icon-button flex h-8 w-8 items-center justify-center text-sm text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => void onAdjustWounds(unit, 1)}
                    disabled={!canInteract || outOfAction || isSavingUnitConfig}
                    aria-label="Increase wounds"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <p className={META_LABEL_CLASS}>OOA</p>
                <button
                  type="button"
                  className={DANGER_ACTION_BUTTON_CLASS}
                  onClick={() => void handleSetOutOfAction(true)}
                  disabled={!canInteract || outOfAction || isUpdatingOutOfAction || isSavingUnitConfig}
                  aria-label="Set unit out of action"
                >
                  <OutOfActionIcon className="h-5 w-5 text-red-400" />
                </button>
              </div>
              <div className="space-y-1">
                <p className={META_LABEL_CLASS}>Kills</p>
                <button
                  type="button"
                  className={DANGER_KILL_BUTTON_CLASS}
                  onClick={() => setIsKillDialogOpen(true)}
                  disabled={!canInteract || outOfAction || isSavingUnitConfig}
                  aria-label="Record kill"
                >
                  <KillTrophyIcon className="h-5 w-5" />
                  <span className="text-xs font-semibold">{killCount}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {error ? <p className="mt-2 text-xs text-red-500">{error}</p> : null}
      </div>

      <button
        type="button"
        className="flex h-8 w-full items-center justify-center border-t border-border/30 bg-black/25 text-muted-foreground transition hover:text-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Expand unit details"
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
            onUseSingleUseItem(unit, {
              id: item.id,
              name: item.name,
              quantity: item.count,
            })
          }
          getUsedSingleUseItemCount={(itemId) => getUsedSingleUseItemCount(unit.key, itemId)}
          activeItemActionKey={activeItemActionKey}
        />
      ) : null}

      {outOfAction ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/65">
          {canInteract ? (
            <button
              type="button"
              className="icon-button flex h-14 w-14 items-center justify-center rounded-full border-none bg-transparent text-[#d6c8aa] shadow-none transition hover:bg-transparent hover:text-foreground"
              onClick={() => void handleSetOutOfAction(false)}
              disabled={isUpdatingOutOfAction}
              aria-label="Set unit back in action"
            >
              <img src={scull2Icon} alt="" className="h-10 w-10 object-contain" />
            </button>
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-transparent text-[#d6c8aa]">
              <img src={scull2Icon} alt="" className="h-10 w-10 object-contain" />
            </div>
          )}
        </div>
      ) : null}

      <ActiveKillDialog
        open={isKillDialogOpen}
        onOpenChange={setIsKillDialogOpen}
        killerName={unit.displayName}
        killerUnitKey={unit.key}
        showEarnedXpOption={unit.kind !== "custom"}
        defaultEarnedXp={unit.kind !== "henchman"}
        options={killTargetOptions}
        onConfirm={({ victimUnitKey, victimName, notes, earnedXp }) =>
          onRecordKill({
            killerUnitKey: unit.key,
            victimUnitKey,
            victimName,
            notes,
            earnedXp,
          })
        }
      />
    </div>
  );
}
