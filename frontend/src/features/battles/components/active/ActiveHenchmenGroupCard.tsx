import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";

import type { BattleUnitInformationEntry } from "@/features/battles/types/battle-types";
import type {
  PrebattleUnit,
  UnitSingleUseItem,
  UnitOverride,
} from "@/features/battles/components/prebattle/prebattle-types";
import UnitStatsTable from "@/features/warbands/components/shared/unit_details/UnitStatsTable";
import "@/features/warbands/styles/warband.css";
import { getBattleCardThemeStyle } from "@/features/battles/components/shared/battle-card-theme";
import { getErrorMessage } from "@/lib/get-error-message";
import CreatureMark from "@/features/warbands/components/units/beasts/CreatureMark";
import { PetChips } from "@/features/battles/components/shared/BattleCompanionParts";
import { groupMountedStats } from "@/features/battles/utils/battle-companions";

import ActiveHenchmanRow from "./ActiveHenchmanRow";
import ActiveKillDialog from "./ActiveKillDialog";
import ActiveUnitExpandedDetails from "./ActiveUnitExpandedDetails";
import ActiveUnitStatEditor from "./ActiveUnitStatEditor";
import { getEffectiveUnitStats, type ActiveBattleUnitOption } from "./active-utils";

type ActiveHenchmenGroupCardProps = {
  groupName: string;
  groupType: string;
  /** A group recruited from a creature carries the creature mark. */
  beastKind?: "mount" | "pet" | "creature" | null;
  members: PrebattleUnit[];
  canInteract: boolean;
  unitInformationByKey: Record<string, BattleUnitInformationEntry>;
  killTargetOptions: ActiveBattleUnitOption[];
  onSetOutOfAction: (unitKey: string, outOfAction: boolean) => Promise<void>;
  onAdjustWounds: (unit: PrebattleUnit, delta: number) => Promise<void>;
  /** Saves a battle stat change for every member of the group (BATL-NEW-07). */
  onSaveOverride: (unitKeys: string[], override: UnitOverride | undefined) => Promise<void>;
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
  savingUnitKeys?: Record<string, boolean>;
};

export default function ActiveHenchmenGroupCard({
  groupName,
  groupType,
  beastKind,
  members,
  canInteract,
  unitInformationByKey,
  killTargetOptions,
  onSetOutOfAction,
  onAdjustWounds,
  onSaveOverride,
  onSaveUnitNotes,
  onRecordKill,
  onUseSingleUseItem,
  getUsedSingleUseItemCount,
  onUndoSingleUseItem,
  activeItemActionKey,
  savingUnitKeys = {},
}: ActiveHenchmenGroupCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [killDialogMember, setKillDialogMember] = useState<PrebattleUnit | null>(null);
  const [updatingOutOfActionKeys, setUpdatingOutOfActionKeys] = useState<Record<string, boolean>>(
    {}
  );
  const [error, setError] = useState("");

  const detailUnit = useMemo(
    () =>
      members.find((member) => {
        const unitInfo = unitInformationByKey[member.key];
        const overrides = unitInfo?.stats_override ?? {};
        return Object.keys(overrides).length > 0 || Boolean(unitInfo?.notes?.trim());
      }) ?? members[0],
    [members, unitInformationByKey]
  );
  const detailUnitInfo = unitInformationByKey[detailUnit.key];
  const detailStats = getEffectiveUnitStats(detailUnit, detailUnitInfo);
  const themeStyle = getBattleCardThemeStyle("henchmen_group");
  const memberGridClass = useMemo(() => {
    if (members.length >= 4) {
      return "md:grid-cols-2 xl:grid-cols-3";
    }
    if (members.length === 3) {
      return "md:grid-cols-3";
    }
    if (members.length === 2) {
      return "md:grid-cols-2";
    }
    return "";
  }, [members.length]);

  const handleSetOutOfAction = async (unitKey: string, nextOutOfAction: boolean) => {
    if (!canInteract || updatingOutOfActionKeys[unitKey]) {
      return;
    }
    setUpdatingOutOfActionKeys((prev) => ({ ...prev, [unitKey]: true }));
    setError("");
    try {
      await onSetOutOfAction(unitKey, nextOutOfAction);
    } catch (errorResponse) {
      setError(getErrorMessage(errorResponse, "Unable to update unit state"));
    } finally {
      setUpdatingOutOfActionKeys((prev) => ({ ...prev, [unitKey]: false }));
    }
  };

  return (
    <div className="battle-card" style={themeStyle}>
      <div className="p-3">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] md:items-start">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5">
              {beastKind === "creature" ? <CreatureMark /> : null}
              <p className="truncate text-sm font-semibold text-foreground">{groupName}</p>
            </div>
            <p className="text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground">
              {groupType}
            </p>
            <p className="mt-1 text-[0.58rem] uppercase tracking-[0.16em] text-muted-foreground">
              {members.length} {members.length === 1 ? "fighter" : "fighters"}
            </p>
            <PetChips pets={members[0]?.pets} />
          </div>

          <div className="battle-stats-shell w-full md:max-w-[30rem] md:justify-self-end">
            <UnitStatsTable
              stats={detailStats}
              mounted={groupMountedStats(members, detailUnitInfo?.stats_override)}
              variant="summary"
              wrapperClassName="w-full max-w-none"
            />
          </div>
        </div>

        <div className={`mt-2 grid gap-2 ${memberGridClass}`}>
          {members.map((member) => (
            <ActiveHenchmanRow
              key={member.key}
              member={member}
              memberInfo={unitInformationByKey[member.key]}
              canInteract={canInteract}
              isUpdating={Boolean(updatingOutOfActionKeys[member.key])}
              isSavingConfig={Boolean(savingUnitKeys[member.key])}
              onAdjustWounds={(delta) => void onAdjustWounds(member, delta)}
              onToggleOutOfAction={(outOfAction) =>
                void handleSetOutOfAction(member.key, outOfAction)
              }
              onRecordKill={() => setKillDialogMember(member)}
            />
          ))}
        </div>

        {error ? <p className="mt-2 text-xs text-red-500">{error}</p> : null}
      </div>

      <button
        type="button"
        className="flex h-11 w-full items-center justify-center border-t border-border/30 bg-black/25 text-muted-foreground transition hover:text-foreground focus-visible:outline-none"
        aria-label={`Details for ${groupName}`}
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded((prev) => !prev)}
      >
        <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
      </button>

      {isExpanded ? (
        <div>
          <div className="px-3 pt-3">
            <ActiveUnitStatEditor
              unit={detailUnit}
              unitInformation={detailUnitInfo}
              editable={canInteract}
              isSaving={members.some((member) => savingUnitKeys[member.key])}
              onSaveOverride={(_, override) =>
                onSaveOverride(
                  members.map((member) => member.key),
                  override
                )
              }
            />
          </div>
          <ActiveUnitExpandedDetails
            unit={detailUnit}
            unitInformation={detailUnitInfo}
            canInteract={canInteract}
            onSaveNotes={(notes) => onSaveUnitNotes(detailUnit.key, notes)}
            onUseSingleUseItem={(item) =>
              onUseSingleUseItem(detailUnit, {
                id: item.id,
                name: item.name,
                quantity: item.count,
              })
            }
            getUsedSingleUseItemCount={(itemId) =>
              getUsedSingleUseItemCount(detailUnit.key, itemId)
            }
            onUndoSingleUseItem={
              onUndoSingleUseItem ? (itemId) => onUndoSingleUseItem(detailUnit, itemId) : undefined
            }
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
