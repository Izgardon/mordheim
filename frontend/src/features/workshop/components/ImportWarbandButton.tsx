import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { toastServerWarnings } from "@/features/warbands/utils/server-warnings";
import { queryKeys } from "@/lib/query-keys";

import { importWarbandIntoCampaign } from "../api/workshop-api";
import { cleanCode } from "../api/workshop-queries";
import ImportCodeDialog from "./ImportCodeDialog";

/**
 * Import a warband (the workshop), beside raising one: a shared warband's code, read first, then
 * imported as yours in its exact state, paying what it costs from the starting gold in one row.
 * The page then shows it, with the server's warnings (not in play, over the gold, its list).
 */
export default function ImportWarbandButton({ campaignId }: { campaignId: number }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const imported = async (code: string) => {
    const answer = await importWarbandIntoCampaign(campaignId, cleanCode(code));
    toastServerWarnings(answer.warnings);
    // your warband here, the players' roster, and Home's card for the campaign
    await queryClient.invalidateQueries({ queryKey: queryKeys.campaign.myWarband(campaignId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.campaign.players(campaignId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.campaigns() });
  };
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Import a warband
      </Button>
      <ImportCodeDialog
        open={open}
        onOpenChange={setOpen}
        kicker="My warband"
        title="Import a warband"
        note="It pays what it costs from your starting gold."
        onImport={imported}
      />
    </>
  );
}
