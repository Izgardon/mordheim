import type { SummaryHeaderProps } from "../../../../units/unit-slot-types";

/** Hired sword summary header: name and level line only (no upkeep or blood pact). */
export default function HirelingCardHeader({
  unit: hireling,
  level,
}: SummaryHeaderProps<"hireling">) {
  return (
    <div className="flex items-start justify-between gap-3 py-1 pl-4">
      <div>
        <p className="text-xl font-bold">{hireling.name || "Untitled hired sword"}</p>
        <p className="text-sm text-muted-foreground">
          Level {level} {hireling.unit_type || "Hired Sword"}
        </p>
      </div>
    </div>
  );
}
