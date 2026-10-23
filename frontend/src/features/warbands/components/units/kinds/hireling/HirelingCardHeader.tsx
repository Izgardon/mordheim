import { personaTermsLine } from "@/features/hirelings/utils/hireling-display";

import {
  hirelingKindLabel,
  isDramatisPersona,
  upkeepReminder,
} from "../../../../units/kinds/hireling-terms";

import type { SummaryHeaderProps } from "../../../../units/unit-slot-types";

/**
 * A hireling's summary header: name; its level and type (a dramatis persona gains no levels, so
 * his type alone); what it is ("Hired sword", "Dramatis persona"); a dramatis persona's stay and
 * pay; and an upkeep formula as a reminder.
 */
export default function HirelingCardHeader({
  unit: hireling,
  level,
}: SummaryHeaderProps<"hireling">) {
  const isPersona = isDramatisPersona(hireling);
  const type = hireling.unit_type || (isPersona ? "Dramatis Persona" : "Hired Sword");
  const terms = isPersona ? personaTermsLine(hireling) : "";
  const upkeep = upkeepReminder(hireling);
  return (
    <div className="flex items-start justify-between gap-3 py-1 pl-4">
      <div>
        <p className="text-xl font-bold">{hireling.name || "Untitled hired sword"}</p>
        <p className="text-sm text-muted-foreground">
          {isPersona ? type : `Level ${level} ${type}`}
        </p>
        <p className="text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">
          {hirelingKindLabel(hireling)}
        </p>
        {terms ? <p className="text-xs text-muted-foreground">{terms}</p> : null}
        {upkeep ? <p className="text-xs text-muted-foreground">{upkeep}</p> : null}
      </div>
    </div>
  );
}
