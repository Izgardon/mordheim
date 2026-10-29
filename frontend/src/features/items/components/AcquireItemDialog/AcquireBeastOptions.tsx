import { Checkbox } from "@components/checkbox";
import RecruitTargetPicker from "@/features/warbands/components/units/beasts/RecruitTargetPicker";

import type { AcquireBeastView } from "../../hooks/useAcquireBeastChoice";

type AcquireBeastOptionsProps = {
  itemName: string;
  view: AcquireBeastView | null;
  unlisted: boolean;
};

/**
 * A beast's purchase (the plan's Acquire mock): "<unit> rides it straight away" for a mount or pet
 * bought for a unit, the recruit choice for a creature bought for the stash, and a note when the
 * shop doesn't sell it (it can still be bought; the server warns).
 */
export default function AcquireBeastOptions({
  itemName,
  view,
  unlisted,
}: AcquireBeastOptionsProps) {
  if (!view && !unlisted) return null;
  return (
    <div className="space-y-3 px-1">
      {unlisted ? (
        <p className="text-sm text-amber-300">
          {itemName} isn't sold in this campaign's shop; you can still buy it.
        </p>
      ) : null}
      {view?.kind === "companion" ? (
        <label className="flex items-center gap-2 text-sm text-foreground">
          <Checkbox
            checked={view.checked}
            disabled={view.disabled}
            onChange={(event) => view.onChange(event.target.checked)}
          />
          {view.label}
        </label>
      ) : null}
      {view?.kind === "recruit" ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-muted-foreground">Recruit straight away:</p>
          <RecruitTargetPicker
            groups={view.groups}
            value={view.value}
            onChange={view.onChange}
            name={view.name}
            onNameChange={view.onNameChange}
            defaultName={view.defaultName}
            offerKeep
          />
        </div>
      ) : null}
    </div>
  );
}
