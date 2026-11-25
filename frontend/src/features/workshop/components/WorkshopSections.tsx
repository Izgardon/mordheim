import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { SectionHead } from "@/components/ui/section-title";
import { CAMPAIGN_GRID } from "@/features/campaigns/components/campaigns/CampaignsSkeleton";
import { toastServerWarnings } from "@/features/warbands/utils/server-warnings";
import { getErrorMessage } from "@/lib/get-error-message";

import { useImportIntoWorkshop, useWorkshops } from "../api/workshop-queries";
import ImportCodeDialog from "./ImportCodeDialog";
import NewListDialog from "./NewListDialog";
import NewWarbandDialog from "./NewWarbandDialog";
import WorkshopCard, { CostLine, workshopPath } from "./WorkshopCard";

type Open = "warband" | "list" | "import" | null;

/** A Home section: its title with its buttons, then its cards (or why there are none). */
function Section(props: {
  id: string;
  title: string;
  actions: ReactNode;
  state: { isLoading: boolean; error: string };
  empty: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={props.id} className="flex flex-col gap-4">
      <SectionHead
        id={props.id}
        title={props.title}
        className="flex-wrap items-center"
        aside={
          <div className="flex gap-2 max-[960px]:grid max-[960px]:w-full max-[960px]:grid-cols-2">
            {props.actions}
          </div>
        }
      />
      {props.state.isLoading ? (
        <p className="m-0 text-sm text-text2">Loading…</p>
      ) : props.state.error ? (
        <p role="alert" className="m-0 text-sm text-danger">
          {props.state.error}
        </p>
      ) : props.count === 0 ? (
        <p className="m-0 text-sm text-text2">{props.empty}</p>
      ) : (
        <div className={CAMPAIGN_GRID}>{props.children}</div>
      )}
    </section>
  );
}

const BUTTON = "max-[960px]:min-h-12";

/**
 * The Home page's Warbands and Warband lists (the workshop): my custom warbands, each with its
 * cost against its budget, and my lists with the types they serve; each with its share code and
 * Delete. New and Import by code sit by each title (an import opens what it made).
 */
export default function WorkshopSections() {
  const navigate = useNavigate();
  const workshops = useWorkshops();
  const importing = useImportIntoWorkshop();
  const [open, setOpen] = useState<Open>(null);
  const state = {
    isLoading: workshops.isPending,
    error: workshops.error ? getErrorMessage(workshops.error, "Unable to load your workshop") : "",
  };
  const warbands = workshops.data?.warbands ?? [];
  const lists = workshops.data?.lists ?? [];
  const opener = (name: Open) => (next: boolean) => setOpen(next ? name : null);
  const importButton = (
    <Button variant="secondary" className={BUTTON} onClick={() => setOpen("import")}>
      Import by code
    </Button>
  );

  return (
    <>
      <Section
        id="your-warbands"
        title="Warbands"
        state={state}
        count={warbands.length}
        empty="No custom warbands yet."
        actions={
          <>
            {importButton}
            <Button className={BUTTON} onClick={() => setOpen("warband")}>
              New warband
            </Button>
          </>
        }
      >
        {warbands.map((row) => (
          <WorkshopCard
            key={row.id}
            id={row.id}
            name={row.name}
            kicker={row.warband_type?.name ?? "Warband"}
            shareCode={row.share_code}
            facts={<CostLine cost={row.cost} budget={row.budget} />}
          />
        ))}
      </Section>
      <Section
        id="your-lists"
        title="Warband lists"
        state={state}
        count={lists.length}
        empty="No custom warband lists yet."
        actions={
          <>
            {importButton}
            <Button className={BUTTON} onClick={() => setOpen("list")}>
              New list
            </Button>
          </>
        }
      >
        {lists.map((row) => (
          <WorkshopCard
            key={row.id}
            id={row.id}
            name={row.name}
            kicker={row.warband_types.map((type) => type.name).join(", ") || "Serves no type"}
            shareCode={row.share_code}
          />
        ))}
      </Section>
      <NewWarbandDialog open={open === "warband"} onOpenChange={opener("warband")} />
      <NewListDialog open={open === "list"} onOpenChange={opener("list")} />
      <ImportCodeDialog
        open={open === "import"}
        onOpenChange={opener("import")}
        kicker="Workshop"
        title="Import by code"
        onImport={async (code) => {
          const made = await importing.mutateAsync(code);
          toastServerWarnings(made.warnings);
          navigate(workshopPath(made.id));
        }}
      />
    </>
  );
}
