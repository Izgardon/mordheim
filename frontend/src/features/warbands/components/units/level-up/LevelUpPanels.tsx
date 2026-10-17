import { Button } from "@components/button";
import { Checkbox } from "@components/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/select";
import DiceRoller from "@/components/dice/DiceRoller";

import type { FollowUpAdvance, LadsGotTalentAdvance } from "../../../hooks/units/level-up-types";

type RollPanelProps = {
  diceColor: string;
  notation: "2d6" | "1d6";
  title: string;
  description: string;
  disabled?: boolean;
  rollSignal: number;
  onRoll: () => void;
  onRollComplete: (results: unknown) => void;
};

/** One die panel: heading, roll button and the fixed-notation dice roller. */
export function RollPanel({
  diceColor,
  notation,
  title,
  description,
  disabled,
  rollSignal,
  onRoll,
  onRollComplete,
}: RollPanelProps) {
  return (
    <div className="flex h-full flex-col gap-3">
      <div>
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="mt-auto flex items-center gap-4">
        <Button type="button" disabled={disabled} onClick={onRoll}>
          {notation}
        </Button>
        <DiceRoller
          mode="fixed"
          fixedNotation={notation}
          themeColor={diceColor}
          showRollButton={false}
          resultMode="total"
          showResultBox
          rollSignal={rollSignal}
          onRollComplete={onRollComplete}
        />
      </div>
    </div>
  );
}

/** Henchmen show the 2d6 result where heroes and hired swords have their 1d6 follow-up. */
export function RollResultPanel({ advance }: { advance: LadsGotTalentAdvance }) {
  return (
    <div className="flex h-full flex-col gap-3">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Result</h3>
        <p className="text-sm text-muted-foreground">
          {advance.hasRolled2d6
            ? `Result: ${advance.roll2d6Total ?? ""}`
            : "Roll the dice to determine the advance."}
        </p>
      </div>
      <div className="mt-auto text-xs text-muted-foreground">Roll to determine the advance.</div>
    </div>
  );
}

type AdvanceOptionsRowProps = {
  advance: FollowUpAdvance;
  selectedStat: string | null;
  onSelect: (statId: string) => void;
};

/** The Skill/Spell/Special placeholders (Spell for casters only). */
export function AdvanceOptionsRow({ advance, selectedStat, onSelect }: AdvanceOptionsRowProps) {
  return (
    <div className="flex items-center justify-center gap-6">
      {advance.otherOptions.map((option) => (
        <label key={option.id} className="flex items-center gap-2 text-sm text-foreground">
          <Checkbox checked={selectedStat === option.id} onChange={() => onSelect(option.id)} />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}

/** Henchmen only: tick Lad's Got Talent, pick the member to promote, re-roll on 10-12. */
export function LadsGotTalentPanel({ advance }: { advance: LadsGotTalentAdvance }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-foreground">
          <Checkbox
            checked={advance.checked}
            onChange={(event) => advance.setChecked(event.target.checked)}
          />
          <span>Lads got talent</span>
        </label>
        <div className="min-w-[200px] flex-1">
          <Select
            value={advance.selectedHenchmanId}
            onValueChange={advance.setSelectedHenchmanId}
            disabled={!advance.checked || advance.options.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select henchman" />
            </SelectTrigger>
            <SelectContent>
              {advance.options.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {advance.shouldPromptReroll ? (
        <p className="text-sm text-amber-500">
          Lads Got Talent rolled - roll again until you get a stat increase.
        </p>
      ) : null}
    </>
  );
}
