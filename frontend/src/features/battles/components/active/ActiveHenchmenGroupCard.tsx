import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";

import basicBar from "@/assets/containers/basic_bar.webp";
import type { BattleUnitInformationEntry } from "@/features/battles/types/battle-types";
import type {
  PrebattleUnit,
  UnitSingleUseItem,
  UnitOverride,
} from "@/features/battles/components/prebattle/prebattle-types";
import UnitStatsTable from "@/features/warbands/components/shared/unit_details/UnitStatsTable";

import ActiveKillDialog from "./ActiveKillDialog";
import ActiveUnitExpandedDetails from "./ActiveUnitExpandedDetails";
import { KillTrophyIcon, OutOfActionIcon } from "./ActiveBattleActionIcons";
import { getEffectiveUnitStats, type ActiveBattleUnitOption } from "./active-utils";

const META_LABEL_CLASS =
  "text-center text-[0.5rem] uppercase tracking-[0.16em] text-muted-foreground";

const statsBarStyle = {
  backgroundImage: `url(${basicBar})`,
  backgroundSize: "100% 100%",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "center",
} as const;

type ActiveHenchmenGroupCardProps = {
  groupName: string;
  groupType: string;
  members: PrebattleUnit[];
  canInteract: boolean;
  unitInformationByKey: Record<string, BattleUnitInformationEntry>;
  killTargetOptions: ActiveBattleUnitOption[];
  onSetOutOfAction: (unitKey: string, outOfAction: boolean) => Promise<void>;
  onAdjustWounds: (unit: PrebattleUnit, delta: number) => Promise<void>;
  onSaveOverride: (unitKey: string, override: UnitOverride | undefined) => Promise<void>;
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
  savingUnitKeys?: Record<string, boolean>;
};

export default function ActiveHenchmenGroupCard({
  groupName,
  groupType,
  members,
  canInteract,
  unitInformationByKey,
  killTargetOptions,
  onSetOutOfAction,
  onAdjustWounds,
  onSaveOverride,
  onRecordKill,
  onUseSingleUseItem,
  getUsedSingleUseItemCount,
  activeItemActionKey,
  savingUnitKeys = {},
}: ActiveHenchmenGroupCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [killDialogMember, setKillDialogMember] = useState<PrebattleUnit | null>(null);
  const [updatingOutOfActionKeys, setUpdatingOutOfActionKeys] = useState<Record<string, boolean>>({});
  const [detailUnitKey, setDetailUnitKey] = useState<string | null>(null);
  const [error, setError] = useState("");

  const defaultDetailUnit = useMemo(
    () =>
      members.find((member) => {
        const overrides = unitInformationByKey[member.key]?.stats_override ?? {};
        return Object.keys(overrides).length > 0;
      }) ?? members[0],
    [members, unitInformationByKey]
  );
  useEffect(() => {
    if (!members.some((member) => member.key === detailUnitKey)) {
      setDetailUnitKey(defaultDetailUnit.key);
    }
  }, [defaultDetailUnit.key, detailUnitKey, members]);

  const detailUnit = members.find((member) => member.key === detailUnitKey) ?? defaultDetailUnit;
  const detailUnitInfo = unitInformationByKey[detailUnit.key];
  const detailStats = getEffectiveUnitStats(detailUnit, detailUnitInfo);

  const handleSetOutOfAction = async (unitKey: string, nextOutOfAction: boolean) => {
    if (!canInteract || updatingOutOfActionKeys[unitKey]) {
      return;
    }
    setUpdatingOutOfActionKeys((prev) => ({ ...prev, [unitKey]: true }));
    setError("");
    try {
      await onSetOutOfAction(unitKey, nextOutOfAction);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setError(errorResponse.message || "Unable to update unit state");
      } else {
        setError("Unable to update unit state");
      }
    } finally {
      setUpdatingOutOfActionKeys((prev) => ({ ...prev, [unitKey]: false }));
    }
  };

  return (
    <div className="relative overflow-hidden rounded-lg border border-[#6e5a3b]/45 bg-black/60">
      <div className="p-3">
        <p className="truncate text-sm font-semibold text-foreground">{groupName}</p>
        <p className="text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground">{groupType}</p>

        <div className="mt-2 w-full md:max-w-[34rem] md:justify-self-start" style={statsBarStyle}>
          <UnitStatsTable
            stats={detailStats}
            variant="summary"
            showTooltips={false}
            wrapperClassName="w-full px-1 py-1"
            className="[&_th]:border [&_th]:border-[hsl(var(--primary)/0.2)] [&_th]:px-1 [&_th]:py-1 [&_th]:text-[0.62rem] [&_th]:uppercase [&_th]:tracking-[0.2em] [&_th]:text-muted-foreground [&_td]:border [&_td]:border-[hsl(var(--primary)/0.2)] [&_td]:px-1 [&_td]:py-1 [&_td]:text-[0.82rem] [&_td]:font-semibold [&_td]:text-foreground"
          />
        </div>

        <div className="mt-2 space-y-1.5">
          {members.map((member) => {
            const memberInfo = unitInformationByKey[member.key];
            const outOfAction = Boolean(memberInfo?.out_of_action);
            const killCount = memberInfo?.kill_count ?? 0;
            const isUpdating = Boolean(updatingOutOfActionKeys[member.key]);
            const memberStats = getEffectiveUnitStats(member, memberInfo);
            const woundsValue = memberStats.wounds ?? 0;
            const isSavingConfig = Boolean(savingUnitKeys[member.key]);

            return (
              <div
                key={member.key}
                className={`flex items-center justify-between gap-2 rounded-md border border-[#6e5a3b]/45 px-2 py-1.5 ${
                  outOfAction ? "bg-black/55 opacity-85" : "bg-black/35"
                }`}
              >
                <p
                  className={`truncate text-sm ${outOfAction ? "text-muted-foreground/80" : "text-foreground"}`}
                >
                  {member.displayName}
                </p>
                <div className="flex items-center gap-2">
                  <div className="space-y-1">
                    <p className={META_LABEL_CLASS}>Wounds</p>
                    <div className="inline-flex items-center overflow-hidden rounded-md border border-[#6e5a3b]/45 bg-black/35">
                      <button
                        type="button"
                        className="icon-button flex h-8 w-8 items-center justify-center text-sm text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => void onAdjustWounds(member, -1)}
                        disabled={!canInteract || outOfAction || isSavingConfig || woundsValue <= 0}
                        aria-label={`Decrease wounds for ${member.displayName}`}
                      >
                        -
                      </button>
                      <div className="flex h-8 min-w-9 items-center justify-center border-x border-[#6e5a3b]/45 px-2 text-xs font-semibold text-foreground">
                        {woundsValue}
                      </div>
                      <button
                        type="button"
                        className="icon-button flex h-8 w-8 items-center justify-center text-sm text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => void onAdjustWounds(member, 1)}
                        disabled={!canInteract || outOfAction || isSavingConfig}
                        aria-label={`Increase wounds for ${member.displayName}`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className={META_LABEL_CLASS}>OOA</p>
                    <button
                      type="button"
                      className={`icon-button flex h-8 w-8 items-center justify-center rounded-md border transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        outOfAction
                          ? "border-[#6e5a3b]/45 bg-black/35 text-muted-foreground hover:text-foreground"
                          : "border-red-900/50 bg-red-950/40 text-red-400/80 hover:text-red-300"
                      }`}
                      onClick={() => void handleSetOutOfAction(member.key, !outOfAction)}
                      disabled={!canInteract || isUpdating || isSavingConfig}
                      aria-label={outOfAction ? "Set unit back in action" : "Set unit out of action"}
                    >
                      <OutOfActionIcon className={outOfAction ? "h-6 w-6" : "h-5 w-5"} />
                    </button>
                  </div>
                  <div className="space-y-1">
                    <p className={META_LABEL_CLASS}>Kills</p>
                    <button
                      type="button"
                      className="icon-button inline-flex h-8 items-center gap-1 rounded-md border border-[#6e5a3b]/45 bg-black/35 px-1.5 text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => setKillDialogMember(member)}
                      disabled={!canInteract || outOfAction || isSavingConfig}
                      aria-label="Record kill"
                    >
                      <KillTrophyIcon className="h-5 w-5" />
                      <span className="text-xs font-semibold">{killCount}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {error ? <p className="mt-2 text-xs text-red-500">{error}</p> : null}
      </div>

      <button
        type="button"
        className="flex h-8 w-full items-center justify-center border-t border-border/30 bg-black/45 text-muted-foreground transition hover:text-foreground focus-visible:outline-none"
        aria-label="Expand henchmen group details"
        onClick={() => setIsExpanded((prev) => !prev)}
      >
        <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
      </button>

      {isExpanded ? (
        <div className="px-3 pb-3">
          <div className="mb-3 space-y-1">
            <label
              htmlFor={`henchmen-detail-${groupName}-${groupType}`}
              className="text-[0.55rem] uppercase tracking-[0.18em] text-muted-foreground"
            >
              Member
            </label>
            <select
              id={`henchmen-detail-${groupName}-${groupType}`}
              value={detailUnit.key}
              onChange={(event) => setDetailUnitKey(event.target.value)}
              className="h-9 w-full rounded-md border border-[#6e5a3b]/45 bg-black/35 px-3 text-sm text-foreground outline-none focus:border-[#8c734c]"
            >
              {members.map((member) => (
                <option key={`detail-member-${member.key}`} value={member.key}>
                  {member.displayName}
                </option>
              ))}
            </select>
          </div>
          <ActiveUnitExpandedDetails
            unit={detailUnit}
            canInteract={canInteract}
            unitInformation={detailUnitInfo}
            onUseSingleUseItem={(item) =>
              onUseSingleUseItem(detailUnit, {
                id: item.id,
                name: item.name,
                quantity: item.count,
              })
            }
            getUsedSingleUseItemCount={(itemId) => getUsedSingleUseItemCount(detailUnit.key, itemId)}
            activeItemActionKey={activeItemActionKey}
          />
        </div>
      ) : null}

      {killDialogMember ? (
        <ActiveKillDialog
          open={Boolean(killDialogMember)}
          onOpenChange={(open) => {
            if (!open) {
              setKillDialogMember(null);
            }
          }}
          killerName={killDialogMember.displayName}
          killerUnitKey={killDialogMember.key}
          showEarnedXpOption
          defaultEarnedXp={killDialogMember.kind !== "henchman"}
          options={killTargetOptions}
          onConfirm={({ victimUnitKey, victimName, notes, earnedXp }) =>
            onRecordKill({
              killerUnitKey: killDialogMember.key,
              victimUnitKey,
              victimName,
              notes,
              earnedXp,
            })
          }
        />
      ) : null}
    </div>
  );
}
