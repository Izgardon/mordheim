import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { templatesChanged } from "@/features/warband-templates/api/editor-queries";
import { toastServerWarnings } from "@/features/warbands/utils/server-warnings";

import { importListIntoCampaign } from "../api/workshop-api";
import { cleanCode } from "../api/workshop-queries";
import ImportCodeDialog from "./ImportCodeDialog";

/**
 * Import a list (the workshop), on the Warbands page for those who edit the catalogue: a shared
 * list's code, read first, then copied as the campaign's own template.
 */
export default function ImportListButton({
  campaignId,
  className,
}: {
  campaignId: number;
  className?: string;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const imported = async (code: string) => {
    const answer = await importListIntoCampaign(campaignId, cleanCode(code));
    toastServerWarnings(answer.warnings);
    templatesChanged(queryClient, campaignId);
  };
  return (
    <>
      <Button variant="secondary" className={className} onClick={() => setOpen(true)}>
        Import a list
      </Button>
      <ImportCodeDialog
        open={open}
        onOpenChange={setOpen}
        kicker="Warbands"
        title="Import a list"
        onImport={imported}
      />
    </>
  );
}
