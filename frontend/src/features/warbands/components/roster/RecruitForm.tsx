import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import FeeEditor from "@/features/hirelings/components/fees/FeeEditor";
import { feeFromDraft } from "@/features/hirelings/components/fees/fee-draft";
import { matchCounter } from "@/features/hirelings/fees";

import { blankRecruit, useRecruit, type RecruitDraft } from "../../hooks/units/useRecruit";
import type { UnitKindKey } from "../../types/units";
import type { WarbandResource } from "../../types/warband-types";
import RaceField from "./edit/RaceField";

const LABEL = "flex flex-col gap-1 text-xs font-bold text-muted-foreground";
const SUBMIT: Record<UnitKindKey, string> = {
  hero: "Recruit",
  henchmen_group: "Recruit",
  hireling: "Hire",
};

/** What each resource line of a hire fee takes, from which counter, and when it runs short. */
function FeeLines({ draft, counters }: { draft: RecruitDraft; counters: WarbandResource[] }) {
  return feeFromDraft(draft.fee).resources.map((line) => {
    const counter = matchCounter(line, counters);
    const short = counter && counter.amount < line.amount;
    return (
      <span
        key={line.resource}
        className={short ? "text-xs font-semibold text-danger" : "text-xs text-text2"}
      >
        {counter
          ? `${line.amount} ${line.resource} from ${counter.name} (holds ${counter.amount})`
          : `${line.amount} ${line.resource}: you have no resource of that name.`}
      </span>
    );
  });
}

/**
 * The inline recruit form at the top of its roster section (William: "an inline form rather
 * than a modal"): Add hero, Add group, or a hired sword not in the list. Name, type, race, cost
 * (a hire fee and upkeep for a hired sword), a group's models and starting XP; once saved, the
 * new card opens in Edit for the rest.
 */
export default function RecruitForm({
  kind,
  campaignId,
  warbandId,
  resources,
  existingIds,
  canCreateRace,
  onCancel,
  onCreated,
}: {
  kind: UnitKindKey;
  campaignId: number;
  warbandId: number;
  resources: WarbandResource[];
  /** The ids of the kind on the roster now, to find the new one. */
  existingIds: number[];
  canCreateRace: boolean;
  onCancel: () => void;
  /** The new card's key, to open it in Edit. */
  onCreated: (key: string) => void;
}) {
  const [draft, setDraft] = useState(blankRecruit);
  const { recruit, saving } = useRecruit(kind, warbandId, existingIds);
  const set = (change: Partial<RecruitDraft>) => setDraft((current) => ({ ...current, ...change }));
  const text = (label: string, key: "name" | "type") => (
    <label className={LABEL}>
      {label}
      <Input
        inputSize="sm"
        autoFocus={key === "name"}
        value={draft[key]}
        onChange={(event) => set({ [key]: event.target.value })}
      />
    </label>
  );
  const number = (label: string, key: "cost" | "count" | "xp", min = 0, max?: number) => (
    <label className={LABEL}>
      {label}
      <NumberInput
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
      aria-label={kind === "hireling" ? "Hire someone not in the list" : "Recruit"}
      className="flex flex-col gap-3 border border-accent-line bg-panel p-3.5"
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
        {kind === "hireling"
          ? null
          : number(kind === "hero" ? "Cost (gc)" : "Cost each (gc)", "cost")}
        {kind === "henchmen_group" ? number("Models", "count", 1, 20) : null}
        {number("Starting XP", "xp")}
      </div>
      {kind === "hireling" ? (
        <div className="grid gap-3 min-[720px]:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <FeeEditor
              label="Hire fee paid"
              idPrefix="recruit-fee"
              value={draft.fee}
              onChange={(fee) => set({ fee })}
            />
            <FeeLines draft={draft} counters={resources} />
          </div>
          <FeeEditor
            label="Upkeep"
            idPrefix="recruit-upkeep"
            value={draft.upkeep}
            onChange={(upkeep) => set({ upkeep })}
          />
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={saving}>
          {SUBMIT[kind]}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
