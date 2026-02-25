import { useState } from "react";
import { ChevronDown } from "lucide-react";

import basicBar from "@/assets/containers/basic_bar.webp";
import fightIcon from "@/assets/icons/Fight.webp";
import scullIcon from "@/assets/icons/Scull.webp";
import scull2Icon from "@/assets/icons/Scull2.webp";

import type { BattleUnitInformationEntry } from "@/features/battles/types/battle-types";
import {
  type PrebattleUnit,
} from "@/features/battles/components/prebattle/prebattle-types";
import UnitStatsTable from "@/features/warbands/components/shared/unit_details/UnitStatsTable";

import ActiveKillDialog from "./ActiveKillDialog";
import type { ActiveBattleUnitOption } from "./active-utils";

const statsBarStyle = {
  backgroundImage: `url(${basicBar})`,
  backgroundSize: "100% 100%",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "center",
} as const;

type ActiveUnitCardProps = {
  unit: PrebattleUnit;
  unitInformation?: BattleUnitInformationEntry;
  canInteract: boolean;
  killTargetOptions: ActiveBattleUnitOption[];
  onSetOutOfAction: (unitKey: string, outOfAction: boolean) => Promise<void>;
  onRecordKill: (payload: {
    killerUnitKey: string;
    victimUnitKey?: string;
    victimName?: string;
    earnedXp: boolean;
  }) => Promise<void>;
};

export default function ActiveUnitCard({
  unit,
  unitInformation,
  canInteract,
  killTargetOptions,
  onSetOutOfAction,
  onRecordKill,
}: ActiveUnitCardProps) {
  const [isKillDialogOpen, setIsKillDialogOpen] = useState(false);
  const [isUpdatingOutOfAction, setIsUpdatingOutOfAction] = useState(false);
  const [error, setError] = useState("");

  const outOfAction = Boolean(unitInformation?.out_of_action);
  const killCount = unitInformation?.kill_count ?? 0;
  const statOverrides = unitInformation?.stats_override ?? {};
  const unitStats = { ...unit.stats, ...statOverrides };

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
    <div className="relative overflow-hidden rounded-lg border border-[#6e5a3b]/45 bg-black/60">
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
                  <button
                    type="button"
                    className="icon-button flex h-8 w-8 items-center justify-center rounded-md border border-[#6e5a3b]/45 bg-black/35 text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => void handleSetOutOfAction(true)}
                    disabled={!canInteract || outOfAction || isUpdatingOutOfAction}
                    aria-label="Set unit out of action"
                  >
                    <img src={scullIcon} alt="" className="h-5 w-5 object-contain" />
                  </button>
                  <button
                    type="button"
                    className="icon-button inline-flex h-8 items-center gap-1 rounded-md border border-[#6e5a3b]/45 bg-black/35 px-1.5 text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => setIsKillDialogOpen(true)}
                    disabled={!canInteract || outOfAction}
                    aria-label="Record kill"
                  >
                    <img src={fightIcon} alt="" className="h-5 w-5 object-contain" />
                    <span className="text-xs font-semibold">{killCount}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full md:max-w-[34rem] md:justify-self-start" style={statsBarStyle}>
            <UnitStatsTable
              stats={unitStats}
              variant="summary"
              showTooltips={false}
              wrapperClassName="w-full px-1 py-1"
              className="[&_th]:border [&_th]:border-[hsl(var(--primary)/0.2)] [&_th]:px-1 [&_th]:py-1 [&_th]:text-[0.62rem] [&_th]:uppercase [&_th]:tracking-[0.2em] [&_th]:text-muted-foreground [&_td]:border [&_td]:border-[hsl(var(--primary)/0.2)] [&_td]:px-1 [&_td]:py-1 [&_td]:text-[0.82rem] [&_td]:font-semibold [&_td]:text-foreground"
            />
          </div>

          <div className="hidden md:block">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="icon-button flex h-8 w-8 items-center justify-center rounded-md border border-[#6e5a3b]/45 bg-black/35 text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => void handleSetOutOfAction(true)}
                disabled={!canInteract || outOfAction || isUpdatingOutOfAction}
                aria-label="Set unit out of action"
              >
                <img src={scullIcon} alt="" className="h-5 w-5 object-contain" />
              </button>
              <button
                type="button"
                className="icon-button inline-flex h-8 items-center gap-1 rounded-md border border-[#6e5a3b]/45 bg-black/35 px-1.5 text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => setIsKillDialogOpen(true)}
                disabled={!canInteract || outOfAction}
                aria-label="Record kill"
              >
                <img src={fightIcon} alt="" className="h-5 w-5 object-contain" />
                <span className="text-xs font-semibold">{killCount}</span>
              </button>
            </div>
          </div>
        </div>

        {error ? <p className="mt-2 text-xs text-red-500">{error}</p> : null}
      </div>

      <button
        type="button"
        className="icon-button flex h-8 w-full items-center justify-center border-t border-border/30 bg-black/45 text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Expand unit details"
        disabled={outOfAction}
      >
        <ChevronDown className="h-4 w-4" />
      </button>

      {outOfAction ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/65">
          {canInteract ? (
            <button
              type="button"
              className="icon-button flex h-14 w-14 items-center justify-center rounded-full bg-black/55 text-[#d6c8aa] transition hover:text-foreground"
              onClick={() => void handleSetOutOfAction(false)}
              disabled={isUpdatingOutOfAction}
              aria-label="Set unit back in action"
            >
              <img src={scull2Icon} alt="" className="h-10 w-10 object-contain" />
            </button>
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/55 text-[#d6c8aa]">
              <img src={scull2Icon} alt="" className="h-10 w-10 object-contain" />
            </div>
          )}
        </div>
      ) : null}

      <ActiveKillDialog
        open={isKillDialogOpen}
        onOpenChange={setIsKillDialogOpen}
        killerLabel={`${unit.displayName} (${unit.unitType})`}
        killerUnitKey={unit.key}
        options={killTargetOptions}
        onConfirm={({ victimUnitKey, victimName, earnedXp }) =>
          onRecordKill({
            killerUnitKey: unit.key,
            victimUnitKey,
            victimName,
            earnedXp,
          })
        }
      />
    </div>
  );
}
