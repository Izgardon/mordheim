import { Button } from "@/components/ui/button";
import { CardBackground } from "@/components/ui/card-background";
import { Input } from "@/components/ui/input";

import type { CustomUnitDraft, StatKey } from "./prebattle-types";
import { STAT_FIELDS } from "./prebattle-types";

type PrebattleCustomUnitBuilderProps = {
  open: boolean;
  draft: CustomUnitDraft;
  onToggleOpen: () => void;
  onDraftChange: (next: CustomUnitDraft) => void;
  onDraftStatChange: (key: StatKey, value: string) => void;
  onSave: () => void;
};

export default function PrebattleCustomUnitBuilder({
  open,
  draft,
  onToggleOpen,
  onDraftChange,
  onDraftStatChange,
  onSave,
}: PrebattleCustomUnitBuilderProps) {
  return (
    <CardBackground className="space-y-3 p-3 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
          Temporary Units
        </p>
        <Button variant="secondary" size="sm" onClick={onToggleOpen}>
          {open ? "Close" : "Add Temporary Unit"}
        </Button>
      </div>

      {open ? (
        <div className="space-y-3 rounded-lg border border-border/40 bg-black/25 p-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <Input
              value={draft.name}
              onChange={(event) => onDraftChange({ ...draft, name: event.target.value })}
              placeholder="Unit name"
              maxLength={120}
            />
            <Input
              value={draft.unitType}
              onChange={(event) => onDraftChange({ ...draft, unitType: event.target.value })}
              placeholder="Unit type"
              maxLength={120}
            />
            <Input
              type="number"
              min={0}
              max={9999}
              step={1}
              inputMode="numeric"
              value={draft.rating}
              onChange={(event) => onDraftChange({ ...draft, rating: event.target.value })}
              onFocus={(event) => event.currentTarget.select()}
              placeholder="Rating"
            />
          </div>
          <Input
            value={draft.reason}
            onChange={(event) => onDraftChange({ ...draft, reason: event.target.value })}
            placeholder="Reason this temporary unit is present"
            maxLength={160}
          />

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-10">
            {STAT_FIELDS.map((stat) => (
              <div key={`custom-draft-${stat.key}`} className="space-y-1">
                <label className="text-[0.58rem] uppercase tracking-[0.18em] text-muted-foreground">
                  {stat.label}
                </label>
                <Input
                  type={stat.input}
                  min={stat.input === "number" ? 0 : undefined}
                  max={stat.input === "number" ? 10 : undefined}
                  maxLength={stat.input === "text" ? 20 : undefined}
                  value={draft.stats[stat.key]}
                  onChange={(event) => onDraftStatChange(stat.key, event.target.value)}
                  onFocus={(event) => event.currentTarget.select()}
                  className="h-9 px-2 text-center"
                />
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <Button variant="default" size="sm" onClick={onSave}>
              Save temporary unit
            </Button>
          </div>
        </div>
      ) : null}
    </CardBackground>
  );
}
