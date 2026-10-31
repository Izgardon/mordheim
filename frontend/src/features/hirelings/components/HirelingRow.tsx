import type { ReactNode } from "react";

import { ReferenceRow } from "@/features/reference/ReferenceList";

import { formatFee } from "../fees";
import { hirelingRace } from "../hireling-catalogue-kinds";
import type { HirelingProfile } from "../types/hireling-catalogue-types";

export const HIRELING_COLUMNS = [
  { label: "Race", className: "w-[160px] shrink-0" },
  { label: "Hire fee", className: "w-[120px] shrink-0" },
  { label: "Upkeep", className: "w-[120px] shrink-0" },
  { label: "Rating", className: "w-[64px] shrink-0" },
];

/** One hired sword or dramatis persona: race, hire fee, upkeep and rating, greyed with a reason. */
export default function HirelingRow({
  entry,
  warning,
  isMobile,
  open,
  onToggle,
  children,
}: {
  entry: HirelingProfile;
  /** Why the warband can't usually hire him (empty when it can). */
  warning: string;
  isMobile: boolean;
  open: boolean;
  onToggle: () => void;
  /** The open row's detail. */
  children: ReactNode;
}) {
  const fee = formatFee(entry.hire_fee);
  const upkeep = formatFee(entry.upkeep_fee);
  return (
    <ReferenceRow
      id={String(entry.id)}
      open={open}
      onToggle={onToggle}
      name={entry.name}
      warn={warning}
      dim={Boolean(warning)}
      sub={
        isMobile
          ? [hirelingRace(entry), entry.rating !== null ? `Rating +${entry.rating}` : ""]
              .filter(Boolean)
              .join(" · ")
          : undefined
      }
      aside={
        <>
          <span className="font-mono text-[13px] font-bold text-ink">{fee}</span>
          <span className="text-xs text-muted-foreground">upkeep {upkeep}</span>
        </>
      }
      cells={
        isMobile
          ? undefined
          : [
              hirelingRace(entry) || "–",
              <span key="fee" className="font-mono font-bold text-ink">
                {fee}
              </span>,
              <span key="upkeep" className="font-mono">
                {upkeep}
              </span>,
              <span key="rating" className="font-mono">
                {entry.rating !== null ? `+${entry.rating}` : "–"}
              </span>,
            ]
      }
    >
      {children}
    </ReferenceRow>
  );
}
