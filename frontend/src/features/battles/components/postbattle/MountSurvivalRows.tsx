import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { BEAST_KIND_TEXT, BeastKindIcon } from "@/features/bestiary/components/BeastKindIcon";
import type { BattleMountAtRisk } from "@/features/battles/types/battle-types";

import { mountRollResult } from "./postbattle-utils";
import type { PostbattleRowTools } from "./postbattle-row-tools";

const FACES = [1, 2, 3, 4, 5, 6];
const SAVED_BY = { barding: "Barding", farrier: "Farrier" };

const ruleText = (risk: BattleMountAtRisk) => {
  const why = (risk.saved_by ?? []).map((reason) => SAVED_BY[reason]).join(", ");
  return risk.dies_on <= 1
    ? `Dies on a 1${why ? ` (${why})` : ""}`
    : `Dies on a 1 or ${risk.dies_on}`;
};

/**
 * Each rider taken out of action on his mount rolls a D6 for it (step 5): the server says what it
 * dies on, the roll suggests the result, and the result is the player's to change. Nothing
 * happens to the mount until finalise.
 */
export default function MountSurvivalRows({ tools }: { tools: PostbattleRowTools }) {
  const atRisk = Object.entries(tools.suggestion?.mount_survival?.entries ?? {});
  if (atRisk.length === 0 || !tools.draft) return null;
  const saved = tools.draft.mount_survival ?? {};
  const disabled = tools.isFinalized;

  return (
    <div className="space-y-2">
      <p className="battle-section-title">Mounts</p>
      {atRisk.map(([unitKey, risk]) => {
        const name = `${risk.unit_name}'s ${risk.mount}`;
        const value = saved[unitKey] ?? { roll: null, dead: false };
        const roll = (next: number | null) =>
          tools.actions.changeMountSurvival(unitKey, mountRollResult(next, risk.dies_on));
        return (
          <div
            key={unitKey}
            role="group"
            aria-label={name}
            className="battle-card flex flex-wrap items-center justify-between gap-3 p-3 text-sm"
          >
            <div className="space-y-0.5">
              <p className="flex items-center gap-1.5 font-semibold text-foreground">
                <BeastKindIcon kind="mount" className={`h-4 w-4 ${BEAST_KIND_TEXT.mount}`} />
                {name}
              </p>
              <p className="text-xs text-muted-foreground">{ruleText(risk)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label={`D6 for ${name}`}
                value={value.roll ?? ""}
                disabled={disabled}
                onChange={(event) => roll(event.target.value ? Number(event.target.value) : null)}
                className="h-11 rounded-md border border-border bg-[#120e0a] px-3 text-sm"
              >
                <option value="">D6</option>
                {FACES.map((face) => (
                  <option key={face} value={face}>
                    {face}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-11"
                disabled={disabled}
                onClick={() => roll(FACES[Math.floor(Math.random() * FACES.length)])}
              >
                Roll
              </Button>
              <label className="inline-flex min-h-11 items-center gap-2 text-xs">
                <Checkbox
                  checked={value.dead}
                  disabled={disabled}
                  aria-label={`${name} dies`}
                  onChange={(event) =>
                    tools.actions.changeMountSurvival(unitKey, {
                      roll: value.roll,
                      dead: event.currentTarget.checked,
                    })
                  }
                />
                Dies
              </label>
            </div>
          </div>
        );
      })}
    </div>
  );
}
