import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { templatesChanged } from "@/features/warband-templates/api/editor-queries";
import { toastServerWarnings } from "@/features/warbands/utils/server-warnings";

import { importListIntoCampaign } from "../api/workshop-api";
import { contentArrived } from "../api/content-arrived";
import { cleanCode, useWorkshop } from "../api/workshop-queries";
import type { ListImportBody } from "../types/workshop-types";
import ImportCodeDialog from "./ImportCodeDialog";
import ImportMenu, { useImportPick } from "./ImportMenu";

/**
 * Import a list (the workshop), on the Warbands page for those who edit the catalogue: one of my
 * workshop's lists picked from the menu, or a shared list's code, read first; copied as the
 * campaign's own template with the custom content it uses (the server's warnings say what came,
 * and whether it came archived).
 */
export default function ImportListButton({
  campaignId,
  className,
}: {
  campaignId: number;
  className?: string;
}) {
  const queryClient = useQueryClient();
  const mine = useWorkshop();
  const [open, setOpen] = useState(false);
  const imported = async (body: ListImportBody) => {
    const answer = await importListIntoCampaign(campaignId, body);
    toast.success(`Imported ${answer.name}.`);
    toastServerWarnings(answer.warnings);
    templatesChanged(queryClient, campaignId);
    contentArrived(queryClient, campaignId, answer.warnings);
  };
  const { pending, pick } = useImportPick((listId) => imported({ list_id: listId }));
  const picks = (mine.data?.lists ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    sub: row.warband_types.map((type) => type.name).join(", "),
  }));
  return (
    <>
      <ImportMenu
        label="Import a list"
        picks={picks}
        pending={pending}
        onPick={pick}
        onCode={() => setOpen(true)}
        className={className}
      />
      <ImportCodeDialog
        open={open}
        onOpenChange={setOpen}
        kicker="Warbands"
        title="Import a list"
        onImport={(code) => imported({ code: cleanCode(code) })}
      />
    </>
  );
}
