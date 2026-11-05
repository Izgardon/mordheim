import { Button } from "@/components/ui/button";
import DiceEntry from "@/components/ui/dice-entry";
import {
  mountRollResult,
  setMountSurvival,
  type PostbattleRenderableRow,
} from "@/features/battles/components/postbattle/postbattle-utils";
import type { ParticipantRoster } from "@/features/battles/components/prebattle/prebattle-types";
import type {
  BattlePostbattleRules,
  BattlePostbattleState,
  BattlePostbattleSuggestion,
} from "@/features/battles/types/battle-types";

import {
  injuryDice,
  injuryRows,
  injuryText,
  missesDice,
  withInjuryRoll,
  withMissingTicked,
  withoutLastRoll,
} from "./aftermath-injuries";
import { mutationRows } from "./aftermath-mutation";
import MutationRollCard from "./MutationRollCard";
import RollCard from "./RollCard";

type InjuriesTabProps = {
  draft: BattlePostbattleState;
  roster: ParticipantRoster | undefined;
  rules: BattlePostbattleRules | undefined;
  suggestion: BattlePostbattleSuggestion | undefined;
  isMobile: boolean;
  onChange: (next: BattlePostbattleState) => void;
};

/** A result reads good unless it kills, keeps him out, takes a stat away, mutates him or is left to the chart. */
const good = (row: PostbattleRenderableRow) => {
  const effect = row.seriousInjuryRolls[row.seriousInjuryRolls.length - 1]?.effect;
  if (row.dead || effect?.kind === "manual" || effect?.kind === "mutation" || effect?.misses)
    return false;
  return effect?.kind !== "stat" || (effect.change ?? 0) > 0;
};

/**
 * Injuries (design E): a card per unit taken out of action, rolling its table (heroes and hero-
 * table hired swords D66 or D100, the rest a D6 that kills on 1–2) or taking the dice typed in,
 * with Undo; the missing games a result keeps him out for, ticked to be set at Ready (their dice
 * rolled again or typed over); a D100 Mutation's D66 on the random mutation table; and each
 * rider's mount survival roll.
 */
export default function InjuriesTab(props: InjuriesTabProps) {
  const { draft, rules, onChange } = props;
  const rows = injuryRows(draft, props.roster);
  const mounts = Object.entries(props.suggestion?.mount_survival?.entries ?? {});

  if (!rows.length && !mounts.length) {
    return (
      <p className="m-0 border border-dashed border-strong px-3.5 py-3 text-[13px] text-muted-foreground">
        Nobody was taken out of action.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => {
        const roll = row.seriousInjuryRolls[row.seriousInjuryRolls.length - 1];
        const dice = injuryDice(row.injuryTable, rules);
        const sub = row.injuryTable === "henchman" ? `${dice} · dies on 1–2` : dice;
        const misses = roll?.effect?.misses;
        const missDice = missesDice(misses);
        const offer = misses && row.unitKind !== "henchman" && !row.dead;
        const games = row.missingGames?.games ?? misses?.games ?? 1;
        const text = injuryText(rules, roll);
        return (
          <RollCard
            key={row.unitKey}
            title={row.unitName}
            subtitle={props.isMobile ? sub : `${row.unitType} · serious injury, ${sub}`}
            danger={Boolean(roll) && !good(row)}
            isMobile={props.isMobile}
            rolled={
              roll
                ? {
                    faces: roll.rolls,
                    result: roll.result_label,
                    good: good(row),
                    onUndo: () => onChange(withoutLastRoll(draft, row.unitKey)),
                  }
                : null
            }
            dice={dice}
            onFaces={(faces) => onChange(withInjuryRoll(draft, row, rules, faces))}
          >
            {text ? (
              <p className="m-0 basis-full text-[13px] leading-relaxed text-text2">{text}</p>
            ) : null}
            {offer ? (
              <div className="flex basis-full flex-wrap items-center gap-x-3 gap-y-1.5 border border-accent-line bg-panel px-3 py-2">
                <label className="flex min-h-10 flex-1 cursor-pointer items-center gap-2.5 text-[13px] text-ink">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--color-accent)]"
                    checked={Boolean(row.missingGames)}
                    onChange={(event) =>
                      onChange(withMissingTicked(draft, row, event.target.checked, games))
                    }
                  />
                  Misses {missDice ? `${missDice} games` : `${games} game${games === 1 ? "" : "s"}`}
                  , set at Ready
                </label>
                {missDice ? (
                  <DiceEntry
                    dice={missDice}
                    size="sm"
                    total={row.missingGames?.games ?? null}
                    onFaces={([rolled]) => onChange(withMissingTicked(draft, row, true, rolled))}
                    button={(reroll) => (
                      <Button size="sm" variant="secondary" className="h-9" onClick={reroll}>
                        Roll {missDice}
                      </Button>
                    )}
                  />
                ) : null}
              </div>
            ) : null}
          </RollCard>
        );
      })}
      {mutationRows(rows).map((row) => (
        <MutationRollCard
          key={`mutation-${row.unitKey}`}
          row={row}
          draft={draft}
          roster={props.roster}
          rules={rules}
          isMobile={props.isMobile}
          onChange={onChange}
        />
      ))}
      {mounts.map(([unitKey, risk]) => {
        const saved = draft.mount_survival?.[unitKey];
        const rolled = saved && saved.roll !== null ? saved : null;
        return (
          <RollCard
            key={`mount-${unitKey}`}
            title={risk.mount}
            subtitle={`${risk.unit_name}'s mount · D6, dies on ${risk.dies_on === 1 ? "1" : `1–${risk.dies_on}`}`}
            danger={Boolean(rolled?.dead)}
            isMobile={props.isMobile}
            rolled={
              rolled
                ? {
                    faces: [rolled.roll as number],
                    result: rolled.dead ? "Dead" : "Survives",
                    good: !rolled.dead,
                    onUndo: () =>
                      onChange(setMountSurvival(draft, unitKey, { roll: null, dead: false })),
                  }
                : null
            }
            dice="D6"
            onFaces={([face]) =>
              onChange(setMountSurvival(draft, unitKey, mountRollResult(face, risk.dies_on)))
            }
          />
        );
      })}
    </div>
  );
}
