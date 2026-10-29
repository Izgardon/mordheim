import { TriangleAlert } from "lucide-react";

import type { BattleWarning } from "@/features/battles/utils/battle-warnings";

/**
 * A henchmen group's mount warnings in prebattle, as the warband page words them: every member
 * carries the same gear, so a group short of mounts, or on more than one kind, can't take the
 * field as it is. A note, never a block: the group can still be picked and the battle readied.
 */
export default function PrebattleGroupMountNote({ warnings }: { warnings?: BattleWarning[] }) {
  if (!warnings?.length) return null;
  return (
    <div role="note" className="mt-2 space-y-1 text-xs text-amber-200/90">
      {warnings.map((warning) => (
        <p key={warning.code} className="flex items-start gap-1.5">
          <TriangleAlert
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400"
            aria-hidden="true"
          />
          <span>{warning.message}</span>
        </p>
      ))}
    </div>
  );
}
