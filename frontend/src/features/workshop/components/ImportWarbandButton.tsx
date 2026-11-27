import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { toastServerWarnings } from "@/features/warbands/utils/server-warnings";
import { queryKeys } from "@/lib/query-keys";

import { importWarbandIntoCampaign } from "../api/workshop-api";
import { contentArrived } from "../api/content-arrived";
import { cleanCode, useWorkshop } from "../api/workshop-queries";
import type { WarbandImportBody } from "../types/workshop-types";
import ImportCodeDialog from "./ImportCodeDialog";
import ImportMenu, { useImportPick } from "./ImportMenu";

/**
 * Import a warband (the workshop), beside raising one: one of my workshop's warbands picked from
 * the menu, or a shared one's code, read first; imported as mine in its exact state, paying what
 * it costs from the starting gold in one row. The page then shows it, with the server's warnings
 * (not in play, over the gold, its list, the custom content it brought).
 */
export default function ImportWarbandButton({ campaignId }: { campaignId: number }) {
  const queryClient = useQueryClient();
  const mine = useWorkshop();
  const [open, setOpen] = useState(false);
  const imported = async (body: WarbandImportBody) => {
    const answer = await importWarbandIntoCampaign(campaignId, body);
    toastServerWarnings(answer.warnings);
    contentArrived(queryClient, campaignId, answer.warnings);
    // your warband here, the players' roster, and Home's card for the campaign
    await queryClient.invalidateQueries({ queryKey: queryKeys.campaign.myWarband(campaignId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.campaign.players(campaignId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.campaigns() });
  };
  const { pending, pick } = useImportPick((warbandId) => imported({ warband_id: warbandId }));
  const picks = (mine.data?.warbands ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    sub: row.warband_type?.name ?? "",
  }));
  return (
    <>
      <ImportMenu
        label="Import a warband"
        picks={picks}
        pending={pending}
        onPick={pick}
        onCode={() => setOpen(true)}
      />
      <ImportCodeDialog
        open={open}
        onOpenChange={setOpen}
        kicker="My warband"
        title="Import a warband"
        note="It pays what it costs from your starting gold."
        onImport={(code) => imported({ code: cleanCode(code) })}
      />
    </>
  );
}
