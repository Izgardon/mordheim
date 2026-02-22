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
        <div className="space-y-2 rounded-lg border border-border/40 bg-black/25 p-2.5">
          <section className="rounded-md border border-border/35 bg-black/30 p-2">
            <p className="mb-1.5 text-[0.55rem] uppercase tracking-[0.18em] text-muted-foreground">
              Temporary Unit
            </p>
            <div className="grid gap-1 sm:grid-cols-3">
              <div className="space-y-1">
                <label className="text-[0.5rem] uppercase tracking-[0.12em] text-muted-foreground">
                  Name
                </label>
                <Input
                  value={draft.name}
                  onChange={(event) => onDraftChange({ ...draft, name: event.target.value })}
                  placeholder="Unit name"
                  maxLength={120}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[0.5rem] uppercase tracking-[0.12em] text-muted-foreground">
                  Type
                </label>
                <Input
                  value={draft.unitType}
                  onChange={(event) => onDraftChange({ ...draft, unitType: event.target.value })}
                  placeholder="Unit type"
                  maxLength={120}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[0.5rem] uppercase tracking-[0.12em] text-muted-foreground">
                  Rating
                </label>
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
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="mt-1.5 space-y-1">
              <label className="text-[0.5rem] uppercase tracking-[0.12em] text-muted-foreground">
                Reason
              </label>
              <Input
                value={draft.reason}
                onChange={(event) => onDraftChange({ ...draft, reason: event.target.value })}
                placeholder="Reason this temporary unit is present"
                maxLength={160}
                className="h-8 text-xs"
              />
            </div>
          </section>

          <section className="rounded-md border border-border/35 bg-black/30 p-2">
            <p className="mb-1.5 text-[0.55rem] uppercase tracking-[0.18em] text-muted-foreground">
              Stats
            </p>
            <div className="grid grid-cols-5 gap-1 sm:grid-cols-10">
              {STAT_FIELDS.map((stat) => (
                <div key={`custom-draft-${stat.key}`} className="space-y-1">
                  <label className="text-[0.5rem] uppercase tracking-[0.12em] text-muted-foreground">
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
                    className="h-8 px-1 text-center text-xs"
                  />
                </div>
              ))}
            </div>
          </section>

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
