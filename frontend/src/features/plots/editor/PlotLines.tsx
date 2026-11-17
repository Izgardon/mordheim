import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, TEXTAREA } from "@/features/campaigns/components/settings/settings-ui";

import { BLANK_SCORING, type PlotDraft, type RungDraft, type ScoringDraft } from "./plot-draft";

type Change = (draft: Partial<PlotDraft>) => void;

/** What the plot scores, in order: points or a die ("D3", "-D3"), and what earns it. */
export function ScoringLines({ lines, onChange }: { lines: ScoringDraft[]; onChange: Change }) {
  const write = (index: number, line: Partial<ScoringDraft>) =>
    onChange({ scoring: lines.map((row, at) => (at === index ? { ...row, ...line } : row)) });

  return (
    <div className="flex flex-col gap-3">
      {lines.map((line, index) => (
        <div key={index} className="flex flex-wrap items-end gap-2">
          <Field label="Points" className="w-20">
            <Input
              aria-label={`Scoring ${index + 1} points`}
              value={line.points}
              onChange={(event) => write(index, { points: event.target.value })}
            />
          </Field>
          <Field label="Dice" className="w-20">
            <Input
              aria-label={`Scoring ${index + 1} dice`}
              value={line.dice}
              placeholder="D3"
              onChange={(event) => write(index, { dice: event.target.value })}
            />
          </Field>
          <Field label="What earns it" className="min-w-[200px] flex-1">
            <Input
              aria-label={`Scoring ${index + 1} text`}
              value={line.text}
              onChange={(event) => write(index, { text: event.target.value })}
            />
          </Field>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Remove scoring ${index + 1}`}
            onClick={() => onChange({ scoring: lines.filter((_row, at) => at !== index) })}
          >
            Remove
          </Button>
        </div>
      ))}
      <Button
        variant="secondary"
        size="sm"
        className="self-start"
        onClick={() => onChange({ scoring: [...lines, { ...BLANK_SCORING }] })}
      >
        Add a scoring line
      </Button>
    </div>
  );
}

/** The ladder: what each campaign point total unlocks. 40 wins the campaign. */
export function LadderRungs({ rungs, onChange }: { rungs: RungDraft[]; onChange: Change }) {
  const write = (index: number, rung: Partial<RungDraft>) =>
    onChange({ achievements: rungs.map((row, at) => (at === index ? { ...row, ...rung } : row)) });

  return (
    <div className="flex flex-col gap-3">
      {rungs.map((rung, index) => (
        <div
          key={index}
          className="flex flex-col gap-2 border-t border-line pt-3 first:border-t-0 first:pt-0"
        >
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Points" className="w-20">
              <Input
                aria-label={`Rung ${index + 1} points`}
                value={rung.points}
                onChange={(event) => write(index, { points: event.target.value })}
              />
            </Field>
            <Field label="Name" className="min-w-[180px] flex-1">
              <Input
                aria-label={`Rung ${index + 1} name`}
                value={rung.name}
                onChange={(event) => write(index, { name: event.target.value })}
              />
            </Field>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Remove rung ${index + 1}`}
              onClick={() => onChange({ achievements: rungs.filter((_row, at) => at !== index) })}
            >
              Remove
            </Button>
          </div>
          <textarea
            aria-label={`Rung ${index + 1} text`}
            value={rung.text}
            className={TEXTAREA}
            onChange={(event) => write(index, { text: event.target.value })}
          />
        </div>
      ))}
      <Button
        variant="secondary"
        size="sm"
        className="self-start"
        onClick={() => onChange({ achievements: [...rungs, { points: "", name: "", text: "" }] })}
      >
        Add a rung
      </Button>
    </div>
  );
}
