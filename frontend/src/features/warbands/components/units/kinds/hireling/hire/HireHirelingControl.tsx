import { useState } from "react";

import { Button } from "@components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@components/dialog";
import TabSwitcher from "@components/tab-switcher";
import { getRefusalMessage } from "@/lib/get-error-message";

import { useHireHireling } from "../../../../../hooks/units/useHireHireling";
import HireCatalogueList from "./HireCatalogueList";
import HireConfirm from "./HireConfirm";

import type { HireSource } from "../../../../../api/warbands-hirelings";
import type { HirelingProfile } from "@/features/hirelings/types/hireling-catalogue-types";
import type { SectionActionsProps } from "../../../../../units/unit-slot-types";

const SOURCES = [
  { id: "hired_sword", label: "Hired swords" },
  { id: "dramatis_persona", label: "Dramatis personae" },
] as const satisfies readonly { id: HireSource; label: string }[];

/**
 * The hired swords' Hire: one button, one dialog with two lists (the campaign's hired swords and
 * dramatis personae). Picking one asks for a name, then the server hires him: it copies the entry,
 * takes a gold fee and answers the new hireling with any warnings. The hired-sword cap is the
 * server's; a dramatis persona sits outside it.
 */
export default function HireHirelingControl({
  warbandId,
  campaignId,
  units,
  roster,
  availableGold,
  onUnitAdded,
}: SectionActionsProps<"hireling">) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<HireSource>("hired_sword");
  const [picked, setPicked] = useState<HirelingProfile | null>(null);
  const hire = useHireHireling(warbandId, (hireling) => {
    onUnitAdded(hireling);
    setOpen(false);
    setPicked(null);
  });
  const close = () => {
    setOpen(false);
    setPicked(null);
    hire.reset();
  };

  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        Hire
      </Button>
      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Hire</DialogTitle>
            <DialogDescription>
              A hired sword or a dramatis persona from the campaign&apos;s catalogue joins the
              warband with his profile and kit.
            </DialogDescription>
          </DialogHeader>
          {picked ? (
            <HireConfirm
              entry={picked}
              isPersona={source === "dramatis_persona"}
              availableGold={availableGold}
              isHiring={hire.isPending}
              error={hire.error ? getRefusalMessage(hire.error, "Unable to hire.") : ""}
              onHire={(name) => hire.mutate({ source, id: picked.id, name })}
              onBack={() => {
                setPicked(null);
                hire.reset();
              }}
            />
          ) : (
            <>
              <TabSwitcher
                tabs={SOURCES}
                activeTab={source}
                onTabChange={setSource}
                listClassName="justify-start"
              />
              <HireCatalogueList
                key={source}
                source={source}
                campaignId={campaignId}
                enabled={open}
                units={units}
                atCap={roster.hirelingCount >= roster.maxHiredSwords}
                maxHiredSwords={roster.maxHiredSwords}
                onPick={setPicked}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
