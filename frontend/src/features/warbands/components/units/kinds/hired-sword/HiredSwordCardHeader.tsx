import type { SummaryHeaderProps } from "../../../../units/unit-slot-types";

/** Hired sword summary header: name and level line only (no upkeep or blood pact). */
export default function HiredSwordCardHeader({
  unit: hiredSword,
  level,
}: SummaryHeaderProps<"hired_sword">) {
  return (
    <div className="flex items-start justify-between gap-3 py-1 pl-4">
      <div>
        <p className="text-xl font-bold">{hiredSword.name || "Untitled hired sword"}</p>
        <p className="text-sm text-muted-foreground">
          Level {level} {hiredSword.unit_type || "Hired Sword"}
        </p>
      </div>
    </div>
  );
}
