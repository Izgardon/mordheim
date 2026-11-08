import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { formatFee } from "../../fees";
import { hirelingRace } from "../../hireling-catalogue-kinds";
import type { HirelingProfile } from "../../types/hireling-catalogue-types";

/**
 * One hired sword or dramatis persona in the hire drawer: his name, race and rating, his hire fee
 * and upkeep, and Hire; one the warband can't usually hire is greyed with the server's reason and
 * can still be hired (a guide, not a gatekeeper).
 */
export default function HireDrawerRow({
  entry,
  warning,
  canHire,
  onHire,
}: {
  entry: HirelingProfile;
  /** Why the warband can't usually hire him (empty when it can). */
  warning: string;
  canHire: boolean;
  onHire: () => void;
}) {
  const sub = [hirelingRace(entry), entry.rating !== null ? `Rating +${entry.rating}` : ""]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className="flex items-center gap-3 border-b border-line py-2.5">
      <div className={cn("flex min-w-0 flex-1 flex-col gap-0.5", warning && "opacity-70")}>
        <span className="truncate text-sm font-bold text-ink">{entry.name}</span>
        {sub ? <span className="text-xs text-muted-foreground">{sub}</span> : null}
        {warning ? <span className="text-xs font-semibold text-danger">{warning}</span> : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
        <span className="font-mono text-[13px] font-bold text-ink">
          {formatFee(entry.hire_fee)}
        </span>
        <span className="text-xs text-muted-foreground">upkeep {formatFee(entry.upkeep_fee)}</span>
      </div>
      {canHire ? (
        <Button
          size="sm"
          variant="secondary"
          aria-label={`Hire ${entry.name}`}
          className="shrink-0"
          onClick={onHire}
        >
          Hire
        </Button>
      ) : null}
    </li>
  );
}
