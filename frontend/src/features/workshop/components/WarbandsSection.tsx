import { useState } from "react";

import { Button } from "@/components/ui/button";

import { useDeleteWorkshopWarband, useWorkshop } from "../api/workshop-queries";
import { workshopWarbandPath, WORKSHOP_ICONS } from "../paths";
import HomeSection, { SECTION_BUTTON, workshopState } from "./HomeSection";
import ImportIntoWorkshop from "./ImportIntoWorkshop";
import NewWarbandDialog from "./NewWarbandDialog";
import WorkshopCard from "./WorkshopCard";

/**
 * My workshop's warbands (a part of Home's Workshop at level 3):
 * each with its type and its code; New, Import by code.
 */
export default function WarbandsSection({ level }: { level?: 2 | 3 }) {
  const workshop = useWorkshop();
  const remove = useDeleteWorkshopWarband();
  const [making, setMaking] = useState(false);
  const warbands = workshop.data?.warbands ?? [];
  return (
    <HomeSection
      level={level}
      id="your-warbands"
      title="Warbands"
      icon={WORKSHOP_ICONS.warbands}
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
          kind={[row.warband_type?.name ?? "Warband", row.no_list && "No list"]
            .filter(Boolean)
            .join(" · ")}
          shareCode={row.share_code}
          onDelete={() => remove.mutateAsync(row.id)}
        />
      ))}
    </HomeSection>
  );
}
