import { useState } from "react";

import { Button } from "@components/button";
import { CardBackground } from "@components/card-background";

import DeleteForGoodDialog from "./DeleteForGoodDialog";

import type { CampaignCapabilities } from "../../capabilities";
import type { useCampaignLifecycle } from "../../hooks/settings/useCampaignLifecycle";
import type { CampaignSummary } from "../../types/campaign-types";

type ArchivedCampaignCardProps = {
  campaign: CampaignSummary;
  capabilities: CampaignCapabilities;
  lifecycle: ReturnType<typeof useCampaignLifecycle>;
};

const archivedOn = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" }) : "";

/** An archived campaign's owner card: Restore, or Delete for good (decision 5). */
export default function ArchivedCampaignCard({
  campaign,
  capabilities,
  lifecycle,
}: ArchivedCampaignCardProps) {
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const date = archivedOn(campaign.archived_at);

  return (
    <CardBackground className="space-y-3 bg-[rgba(12,9,6,0.92)] p-3 sm:p-6">
      <h3 className="text-lg font-semibold text-foreground">Archived campaign</h3>
      <p className="text-sm text-muted-foreground">
        {`Archived${date ? ` on ${date}` : ""}. Restoring makes it writable again; the battles and trades that closed when it was archived stay closed.`}
      </p>
      {lifecycle.error && !isDeleteOpen ? (
        <p className="text-sm text-red-600">{lifecycle.error}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {capabilities.restore ? (
          <Button
            variant="secondary"
            disabled={lifecycle.pending === "restore"}
            onClick={() => void lifecycle.restore()}
          >
            {lifecycle.pending === "restore" ? "Restoring..." : "Restore campaign"}
          </Button>
        ) : null}
        {capabilities.delete ? (
          <Button variant="destructive" onClick={() => setIsDeleteOpen(true)}>
            Delete for good
          </Button>
        ) : null}
      </div>
      <DeleteForGoodDialog
        campaignName={campaign.name}
        open={isDeleteOpen}
        onOpenChange={(open) => {
          setIsDeleteOpen(open);
          if (!open) lifecycle.clearError();
        }}
        isDeleting={lifecycle.pending === "delete"}
        error={lifecycle.error}
        onDelete={(typedName) => void lifecycle.deleteForGood(typedName)}
      />
    </CardBackground>
  );
}
