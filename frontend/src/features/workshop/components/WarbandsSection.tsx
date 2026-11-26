import { useState } from "react";

import { Button } from "@/components/ui/button";

import { useDeleteWorkshopWarband, useWorkshop } from "../api/workshop-queries";
import { workshopWarbandPath } from "../paths";
import HomeSection, { SECTION_BUTTON, workshopState } from "./HomeSection";
import ImportIntoWorkshop from "./ImportIntoWorkshop";
import NewWarbandDialog from "./NewWarbandDialog";
import WorkshopCard, { CostLine } from "./WorkshopCard";

/** My workshop's warbands: each with its cost against its budget and its code; New, Import by code. */
export default function WarbandsSection() {
  const workshop = useWorkshop();
  const remove = useDeleteWorkshopWarband();
  const [making, setMaking] = useState(false);
  const warbands = workshop.data?.warbands ?? [];
  return (
    <HomeSection
      id="your-warbands"
      title="Warbands"
      state={workshopState(workshop)}
      count={warbands.length}
      empty="No custom warbands yet."
      actions={
        <>
          <ImportIntoWorkshop />
          <Button className={SECTION_BUTTON} onClick={() => setMaking(true)}>
            New warband
          </Button>
          <NewWarbandDialog
            open={making}
            onOpenChange={setMaking}
            lists={workshop.data?.lists ?? []}
          />
        </>
      }
    >
      {warbands.map((row) => (
        <WorkshopCard
          key={row.id}
          to={workshopWarbandPath(row.campaign_id, row.id)}
          name={row.name}
          kicker={[row.warband_type?.name ?? "Warband", row.no_list && "No list"]
            .filter(Boolean)
            .join(" · ")}
          shareCode={row.share_code}
          facts={<CostLine cost={row.cost} budget={row.budget} />}
          onDelete={() => remove.mutateAsync(row.id)}
        />
      ))}
    </HomeSection>
  );
}
