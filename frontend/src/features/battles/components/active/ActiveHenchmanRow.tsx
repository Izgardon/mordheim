import type { PrebattleUnit } from "@/features/battles/components/prebattle/prebattle-types";
import type { BattleUnitInformationEntry } from "@/features/battles/types/battle-types";

import { OutOfActionIcon } from "./ActiveBattleActionIcons";
import {
  ActiveKillButton,
  ActiveWoundStepper,
  BACK_IN_ACTION_BUTTON_CLASS,
  DANGER_ACTION_BUTTON_CLASS,
} from "./ActiveUnitControls";
import { getCurrentUnitWounds } from "./active-utils";
import { RiderMark } from "@/features/battles/components/shared/BattleCompanionParts";
import ActiveDismountToggle from "./ActiveDismountToggle";

/** One henchman in his group's card: wounds, out of action (and back), and kills. */
export default function ActiveHenchmanRow({
  member,
  memberInfo,
  canInteract,
  isUpdating,
  isSavingConfig,
  onAdjustWounds,
  onToggleOutOfAction,
  onRecordKill,
  onSetDismounted,
}: {
  member: PrebattleUnit;
  memberInfo: BattleUnitInformationEntry | undefined;
  canInteract: boolean;
  isUpdating: boolean;
  isSavingConfig: boolean;
  onAdjustWounds: (delta: number) => void;
  onToggleOutOfAction: (outOfAction: boolean) => void;
  onRecordKill: () => void;
  /** A rider off his mount for the rest of the battle, or back on it (step 5). */
  onSetDismounted?: (unitKey: string, dismounted: boolean) => Promise<void>;
}) {
  const outOfAction = Boolean(memberInfo?.out_of_action);
  const woundsValue = getCurrentUnitWounds(member, memberInfo);
  const name = member.displayName;
  const canAct = canInteract && !outOfAction && !isSavingConfig;
  const dismounted = Boolean(memberInfo?.dismounted);

  return (
    <div className={`battle-metric-box px-2.5 py-2 ${outOfAction ? "opacity-85" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <RiderMark mount={member.mount} dismounted={dismounted} />
            <p
              className={`truncate text-sm font-medium ${
                outOfAction ? "text-muted-foreground/80" : "text-foreground"
              }`}
            >
              {name}
            </p>
            {outOfAction ? (
              <span className="rounded-sm border border-red-900/50 bg-red-950/30 px-1.5 py-0.5 text-[0.52rem] uppercase tracking-[0.16em] text-red-300/85">
                OOA
              </span>
            ) : null}
          </div>
          <ActiveDismountToggle
            unitKey={member.key}
            name={name}
            mount={member.mount}
            dismounted={dismounted}
            editable={canAct}
            onSetDismounted={onSetDismounted}
          />
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <ActiveWoundStepper
            name={name}
            value={woundsValue}
            className="battle-metric-box inline-flex h-11 items-center overflow-hidden"
            prefix={
              <span className="flex h-full items-center border-r border-border/50 px-1.5 text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                W
              </span>
            }
            decreaseDisabled={!canAct || woundsValue <= 0}
            increaseDisabled={!canAct}
            onAdjust={onAdjustWounds}
          />
          <button
            type="button"
            className={outOfAction ? BACK_IN_ACTION_BUTTON_CLASS : DANGER_ACTION_BUTTON_CLASS}
            onClick={() => onToggleOutOfAction(!outOfAction)}
            disabled={!canInteract || isUpdating || isSavingConfig}
            aria-label={outOfAction ? `Set ${name} back in action` : `Set ${name} out of action`}
            title={outOfAction ? "Set back in action" : "Set out of action"}
          >
            <OutOfActionIcon className={outOfAction ? "h-6 w-6" : "h-5 w-5 text-red-400"} />
          </button>
          <ActiveKillButton
            name={name}
            killCount={memberInfo?.kill_count ?? 0}
            disabled={!canAct}
            title="Record kill"
            onClick={onRecordKill}
          />
        </div>
      </div>
    </div>
  );
}
