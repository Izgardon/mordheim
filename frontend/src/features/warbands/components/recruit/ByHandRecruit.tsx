import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import RaceField from "@/features/races/components/RaceField";

import {
  blankRecruit,
  useRecruit,
  type RecruitDraft,
  type RecruitKind,
} from "../../hooks/units/useRecruit";

const LABEL = "flex flex-col gap-1 text-xs font-bold text-muted-foreground";
// the race's label line too (RaceField), so the fields line up
const LABEL_TEXT = "flex min-h-5 items-center";

/**
 * A recruit typed by hand (Add hero or Add group; "Someone not in the template"): name, type,
 * race, cost, a group's models and starting XP; once saved, the new card opens in Edit for the
 * rest.
 */
export default function ByHandRecruit({
  kind,
  campaignId,
  warbandId,
  existingIds,
  canCreateRace,
  onCancel,
  onCreated,
}: {
  kind: RecruitKind;
  campaignId: number;
  warbandId: number;
  /** The ids of the kind on the roster now, to find the new one. */
  existingIds: number[];
  canCreateRace: boolean;
  onCancel: () => void;
  /** The new card's key, to open it in Edit. */
  onCreated: (key: string) => void;
}) {
  const [draft, setDraft] = useState(blankRecruit);
  const ids = useId();
  const { recruit, saving } = useRecruit(kind, warbandId, existingIds);
  const set = (change: Partial<RecruitDraft>) => setDraft((current) => ({ ...current, ...change }));
  const text = (label: string, key: "name" | "type") => (
    <label htmlFor={`${ids}-${key}`} className={LABEL}>
      <span className={LABEL_TEXT}>{label}</span>
      <Input
        id={`${ids}-${key}`}
        inputSize="sm"
        autoFocus={key === "name"}
        value={draft[key]}
        onChange={(event) => set({ [key]: event.target.value })}
      />
    </label>
  );
  const number = (label: string, key: "cost" | "count" | "xp", min = 0, max?: number) => (
    <label htmlFor={`${ids}-${key}`} className={LABEL}>
      <span className={LABEL_TEXT}>{label}</span>
      <NumberInput
        id={`${ids}-${key}`}
        inputSize="sm"
        min={min}
        max={max}
        value={draft[key]}
        onChange={(event) => set({ [key]: event.target.value })}
      />
    </label>
  );

  return (
    <form
      aria-label="Recruit"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void recruit(draft).then((key) => (key ? onCreated(key) : undefined));
      }}
    >
      <div className="grid grid-cols-2 gap-2 min-[720px]:grid-cols-[1fr_1fr_1.3fr_0.6fr_0.6fr]">
        {text("Name", "name")}
        {text("Type", "type")}
        <RaceField
          campaignId={campaignId}
          value={draft.race}
          canCreate={canCreateRace}
          onChange={(race) => set({ race })}
        />
        {number(kind === "hero" ? "Cost (gc)" : "Cost each (gc)", "cost")}
        {kind === "henchmen_group" ? number("Models", "count", 1, 20) : null}
        {number("Starting XP", "xp")}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={saving}>
          Recruit
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
