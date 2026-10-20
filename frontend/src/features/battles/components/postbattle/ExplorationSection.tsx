import DiceRoller from "@/components/dice/DiceRoller";
import { Button } from "@/components/ui/button";
import { CommittedNumberInput } from "@/components/ui/committed-number-input";
import ExplorationDie from "@/features/battles/components/postbattle/ExplorationDie";
import ExplorationInfoTooltip from "@/features/battles/components/postbattle/ExplorationInfoTooltip";
import PostbattleSection, {
  POSTBATTLE_SECTION_LABELS,
} from "@/features/battles/components/postbattle/PostbattleSection";
import { explorationTableRows } from "@/features/battles/components/postbattle/postbattle-rules";
import {
  setLocalExplorationAmountOverride,
  setLocalExplorationDieSelected,
  setLocalExplorationDieValue,
  setLocalExplorationResource,
} from "@/features/battles/components/postbattle/postbattle-utils";
import {
  HELPER_NATIVE_SELECT_CLASS,
  HELPER_NATIVE_SELECT_STYLE,
} from "@/features/battles/components/shared/battle-dialog-styles";
import type { ExplorationState } from "@/features/battles/hooks/useExploration";
import type { WarbandResource } from "@/features/warbands/types/warband-types";

/** Exploration: how many dice, the roll (or typed dice), which count, and the reward. */
export default function ExplorationSection({
  isMobile,
  explore,
  resources,
  isFinalized,
  isSavingDraft,
  draftError,
  diceColor,
}: {
  isMobile: boolean;
  explore: ExplorationState;
  resources: WarbandResource[];
  isFinalized: boolean;
  isSavingDraft: boolean;
  draftError: string;
  diceColor: string;
}) {
  const { exploration, setExploration, isRolling, limits } = explore;
  const chosenCount = exploration?.selectedDice.filter(Boolean).length ?? 0;
  return (
    <PostbattleSection section="exploration" isMobile={isMobile}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="battle-section-title">{POSTBATTLE_SECTION_LABELS.exploration}</p>
          <ExplorationInfoTooltip rows={explorationTableRows(explore.rules)} />
        </div>
        <div className="flex items-center gap-3">
          {isSavingDraft ? (
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
              Saving draft...
            </p>
          ) : null}
          {draftError ? <p className="text-sm text-red-600">{draftError}</p> : null}
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[9rem] flex-1 space-y-1 sm:max-w-[12rem]">
          <span className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
            Dice Count
          </span>
          <CommittedNumberInput
            value={exploration?.diceCount ?? 0}
            min={0}
            max={limits.max}
            fallbackValue={0}
            className="field-surface h-10 !rounded-none"
            disabled={isFinalized || !exploration}
            onCommit={explore.commitDiceCount}
            onFocus={(event) => {
              window.requestAnimationFrame(() => {
                event.currentTarget.select();
              });
            }}
            onMouseUp={(event) => {
              event.preventDefault();
              event.currentTarget.select();
            }}
          />
        </label>
        <Button
          type="button"
          variant="secondary"
          className="h-10 min-w-24 md:h-11"
          disabled={
            isFinalized ||
            isRolling ||
            !exploration ||
            exploration.hasRolledAllDice ||
            exploration.diceCount === 0
          }
          onClick={explore.rollAll}
        >
          {isRolling && explore.rerollIndex === null ? "Rolling..." : "Roll"}
        </Button>
      </div>
      <div className="flex flex-wrap gap-3">
        {(exploration?.diceValues ?? []).map((dieValue, index) => (
          <ExplorationDie
            key={`exploration-die-${index}`}
            index={index}
            value={dieValue}
            chosen={Boolean(exploration?.selectedDice[index])}
            chooseDisabled={
              isFinalized ||
              !exploration ||
              (!exploration.selectedDice[index] && chosenCount >= limits.max_chosen)
            }
            disabled={isFinalized}
            rerollDisabled={isFinalized || !exploration || isRolling}
            onChooseChange={(chosen) =>
              exploration &&
              setExploration(setLocalExplorationDieSelected(exploration, index, chosen, limits))
            }
            onValueChange={(rawValue) =>
              exploration &&
              setExploration(setLocalExplorationDieValue(exploration, index, rawValue))
            }
            onReroll={() => explore.reroll(index)}
          />
        ))}
      </div>
      <div className="space-y-1">
        <span className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
          Exploration Reward
        </span>
        <div className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[7rem_minmax(0,14rem)]">
          <input
            type="number"
            min={0}
            step={1}
            value={exploration?.amountOverride ?? explore.amountFromDice}
            disabled={isFinalized || !exploration}
            className="battle-metric-box flex h-10 w-full items-center px-3 text-sm text-foreground"
            onMouseUp={(event) => event.currentTarget.select()}
            onChange={(event) =>
              exploration &&
              setExploration(setLocalExplorationAmountOverride(exploration, event.target.value))
            }
          />
          <select
            value={exploration?.resourceId ?? ""}
            disabled={isFinalized || resources.length === 0 || !exploration}
            onChange={(event) =>
              exploration &&
              setExploration(
                setLocalExplorationResource(
                  exploration,
                  event.target.value ? Number(event.target.value) : null
                )
              )
            }
            className={`${HELPER_NATIVE_SELECT_CLASS} h-10 max-w-full px-3 sm:max-w-[14rem]`}
            style={HELPER_NATIVE_SELECT_STYLE}
          >
            {resources.length === 0 ? <option value="">No resources</option> : null}
            {resources.map((resource) => (
              <option key={resource.id} value={resource.id}>
                {resource.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <DiceRoller
        mode="fixed"
        fixedNotation={`${Math.max(1, exploration?.diceCount ?? 1)}d6`}
        variant="button-only"
        showRollButton={false}
        themeColor={diceColor}
        rollSignal={explore.rollSignal}
        onRollComplete={explore.completeRoll}
        onRollingChange={explore.setIsRolling}
      />
      <DiceRoller
        mode="fixed"
        fixedNotation="1d6"
        variant="button-only"
        showRollButton={false}
        themeColor={diceColor}
        rollSignal={explore.rerollSignal}
        onRollComplete={explore.completeReroll}
        onRollingChange={explore.setIsRolling}
      />
    </PostbattleSection>
  );
}
