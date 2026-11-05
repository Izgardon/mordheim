import { Switch } from "@/components/ui/switch";

import type { FighterDraft } from "./fighter-draft";

const CASTERS = ["No", "Wizard", "Priest"];

type Flags = Pick<
  FighterDraft,
  "kind" | "caster" | "isLeader" | "large" | "gainsXp" | "promotable"
>;

/** His caster and flags: Leader and Large, and for henchmen gains XP and promotable. */
export default function FighterFlags({
  draft,
  onChange,
}: {
  draft: Flags;
  onChange: (patch: Partial<Flags>) => void;
}) {
  const toggle = (label: string, on: boolean, patch: (on: boolean) => Partial<Flags>) => (
    <Switch
      look="plain"
      className="text-xs"
      checked={on}
      onCheckedChange={(next) => onChange(patch(next))}
    >
      {label}
    </Switch>
  );
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
        Caster
        <select
          className="h-9 border border-strong bg-page px-2 text-sm text-ink"
          value={draft.caster}
          onChange={(event) => onChange({ caster: event.target.value })}
        >
          {CASTERS.map((caster) => (
            <option key={caster} value={caster}>
              {caster}
            </option>
          ))}
        </select>
      </label>
      {toggle("Leader", draft.isLeader, (isLeader) => ({ isLeader }))}
      {toggle("Large", draft.large, (large) => ({ large }))}
      {draft.kind === "henchman" ? (
        <>
          {toggle("Gains XP", draft.gainsXp, (gainsXp) => ({ gainsXp }))}
          {toggle("Promotable", draft.promotable, (promotable) => ({ promotable }))}
        </>
      ) : null}
    </div>
  );
}
