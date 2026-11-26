import { useState } from "react";

import { Button } from "@/components/ui/button";

import { useDeleteWorkshopList, useWorkshop } from "../api/workshop-queries";
import { workshopListPath } from "../paths";
import HomeSection, { SECTION_BUTTON, workshopState } from "./HomeSection";
import ImportIntoWorkshop from "./ImportIntoWorkshop";
import NewListDialog from "./NewListDialog";
import WorkshopCard from "./WorkshopCard";

/** My workshop's warband lists: each with its code; New, Import by code. */
export default function ListsSection() {
  const workshop = useWorkshop();
  const remove = useDeleteWorkshopList();
  const [making, setMaking] = useState(false);
  const lists = workshop.data?.lists ?? [];
  return (
    <HomeSection
      id="your-lists"
      title="Warband lists"
      state={workshopState(workshop)}
      count={lists.length}
      empty="No custom warband lists yet."
      actions={
        <>
          <ImportIntoWorkshop />
          <Button className={SECTION_BUTTON} onClick={() => setMaking(true)}>
            New list
          </Button>
          <NewListDialog open={making} onOpenChange={setMaking} />
        </>
      }
    >
      {lists.map((row) => (
        <WorkshopCard
          key={row.id}
          to={workshopListPath(row.campaign_id, row.id)}
          name={row.name}
          shareCode={row.share_code}
          onDelete={() => remove.mutateAsync(row)}
        />
      ))}
    </HomeSection>
  );
}
