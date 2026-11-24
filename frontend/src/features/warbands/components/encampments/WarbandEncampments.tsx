import { useNavigate } from "react-router-dom";

import { Chip } from "@/components/ui/chip";

import type { HeldEncampment } from "../../types/warband-sheet";
import { SECTION_TITLE } from "../page/warband-layout";

/**
 * What the warband holds, on its sheet beside its resources and rules: a line of pills, each
 * opening the encampment on the campaign's Encampments page. Left out when it holds none.
 */
export default function WarbandEncampments({
  campaignId,
  encampments,
}: {
  campaignId: number;
  encampments: HeldEncampment[];
}) {
  const navigate = useNavigate();
  if (!encampments.length) return null;
  return (
    <section aria-label="Encampments" className="flex flex-col gap-2 border-b border-line pb-3">
      <h2 className={SECTION_TITLE}>Encampments</h2>
      <div className="flex flex-wrap gap-2">
        {encampments.map((camp) => (
          <Chip
            key={camp.id}
            onClick={() => navigate(`/campaigns/${campaignId}/encampments?open=${camp.id}`)}
          >
            {camp.name}
            {camp.fortified ? (
              <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-faint">
                Fortified
              </span>
            ) : null}
          </Chip>
        ))}
      </div>
    </section>
  );
}
